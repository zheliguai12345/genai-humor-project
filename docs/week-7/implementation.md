# Week 7: Admin Panel with More Observability

## Configuration and migration

`202610260001_admin_observability.sql` creates eleven service-only tables, enables RLS with no public policies, revokes anon/authenticated grants, adds FK/time/filter indexes and update triggers. Primary and fallback roles each have a partial unique index. Linked providers/models cannot be deleted. Temperature support is enforced on both step writes and model updates.

Production `GEMINI_MODEL` was checked through the logged-in Vercel CLI from a directory without local environment files: `gemini-3.8-flash`. The fallback remains `gemini-3.5-flash-lite`. Both seed models omit temperature, matching the current adapter. Seed contains one provider, two models, one chain, one step, one mix entry at 100, 7 themes, 8 vibes, 3 time choices, 3 budgets, all 4 editorial samples (only museum and billionaire active), 2 allowed domains and the owner's email.

After owner approval, the migration was applied through Supabase SQL Editor. Initial exact counts were 1 / 2 / 1 / 1 / 1 / 21 / 4 / 32 / 0 / 2 / 1, in the table order above. The existing superadmin column was already present; its migration commit was local-only at the start.

Historical rows are marked `legacy_backfill`. Received output means provider success even if downstream validation failed. Unknown HTTP status, provider attempt, fallback, duration and prompt hash are NULL. Historical timestamps use the original run start and are explicitly labeled in admin. Empty interrupted reservations do not establish a completed provider call. Hidden provider retries cannot be reconstructed. Live metrics exclude backfill.

## Logging

- `utils/ai/gemini.ts`: `onTiming` reports every actual call, including retry/fallback, raw output or a fixed safe error, call start and duration. Observer errors cannot affect provider recovery.
- `utils/ai/unsplash.ts`: report includes the actual initial/broader query, candidate count, outcome, HTTP/rate metadata, start and duration. Publication download tracking uses the same reporter with a fixed description instead of a credential-bearing URL.
- `utils/supabase/journeys.ts`: associates validation/provider attempts and cover/stop positions with the run. Identical search queries share one provider request and use the first matching position. Writes start concurrently without consuming the generation deadline waiting for them; pending writes drain after commit/failure. Saved searches are linked to the new journey; publication tracking links to both run and journey.
- `utils/ai/observability.ts`: server-only, bounded 1.5-second best-effort inserts; redacts configured secrets and credential-bearing URLs. System prompt is represented by SHA-256. Console telemetry receives only an explicit allowlist of timing fields.

Logging failures may leave incomplete observation records but cannot fail generation or publication. Quota is the latest observed metadata, not a separate Unsplash polling request. Concurrent searches may complete in a different order than their start timestamps, so quota deltas are observational, not usage accounting.

## Admin

Grouped navigation: Overview / Content / Logs / Prompt Config / Models / Access. Every business page and every action independently calls `requireSuperadmin()`; privileged access uses the existing capability-gated server-only `SUPABASE_SECRET_KEY` client. Next.js 16 uses `proxy.ts` for route/session protection.

Added live operational KPIs, run timelines, LLM response filters/full-text expansion, image search filters/quota deltas, journey raw-output image queries/selected images/all candidates/Unsplash attribution/missing-image flags, read-only chains/steps, editable Chain Mix, grouped Terms, JSON Examples, Models, Providers, Domains and Emails. Configuration pages are paged, searchable and server-validated. Deletes require an in-page exact ID confirmation and checkbox, and linked-record or role conflicts return friendly errors. Users remain read only.

## Future runtime configuration (not implemented this week)

1. Replace `configuredModel()` / `configuredFallbackModel()` in `utils/ai/gemini.ts` with a validated server-only model/provider lookup. Preserve timeout/retry limits and enforce active flags and unique roles; map thinking/temperature only for supported models.
2. Add a server-only loader for active `prompt_chains`, ordered `prompt_chain_steps`, and `prompt_chain_mix`. Select an active chain by normalized nonzero weights, validate all referenced models, render the user template using safe JSON substitution, and record a chain/step/config-version snapshot in each run. Define refresh/caching and failure behavior before enabling it.
3. Replace the JSON import and hard-coded few-shot mapping in `utils/ai/journey-prompt.ts` with validated `generation_examples`. Current rows contain original editorial samples including photos, so normalize them into the generated JSON shape (image queries, no selected-photo objects) before assembling examples. Keep the system prompt/schema version aligned with validation.
4. If terms later drive Create, update `utils/journeys/themes.ts`, `types.ts`, `validation.ts` and `app/create/create-form.tsx` together; inactive or edited terms must not break old run inputs.

Model selection, signup-domain checks and whitelisting enforcement remain unchanged. Google OAuth and Supabase Redirect URLs are untouched.

## Validation

- Elsewhere: `npm test` against a production server (set `AUTH_TEST_ORIGIN`); unit/integration coverage includes best-effort writes, redaction, actual per-provider events, actual initial/broader/tracking reports, associations, slow-write isolation, access, quota and existing journey behavior.
- Admin: `npm test`, lint, typecheck and production build; tests cover all six CRUD resources, Chain Mix restrictions, JSON/domain/email/URL validation, role/FK conflicts, confirmation and authorization.
- `supabase/tests/admin_observability.sql` verifies RLS/no policies/no public grants, role uniqueness, temperature constraints and FK deletion behavior in a transaction that rolls back every test write.
- Real local generation: draft `42698c4f-17cb-4fcb-952a-b924f39cbfe9`, run `6cd85531-ae95-4387-8329-34d05b0828a1`, **The Dress Rehearsal**. Verified one successful primary LLM response (8031 ms) and seven image requests, including two broader searches. Stop 4 is missing its image and remains a draft.
- Next.js 16.4.0 reported critical security advisories during build. Upgraded Elsewhere to the audit-recommended 16.4.3 patch, matching admin, and rebuilt successfully. No Google/OAuth configuration was changed.
