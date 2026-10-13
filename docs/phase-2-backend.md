# Elsewhere, NYC. Phase 2 Backend

The user-approved migration has been applied to the sole production Supabase project. The simplified publication transaction and dependency upgrades passed local checks. Live generation acceptance is recorded in docs/phase-2/. No deployment, production UI, commit, or push was performed.

`docs/design/elsewhere-samples.html` is the content, field, and seed baseline. Its visual treatment is not the final product design. Phase 3 will provide a separate UI direction. The earlier Phase 2A Maps/OSM experimental plan is superseded by the current implementation request.

## Storage and permissions

The reviewed and approved migration is `supabase/migrations/202610120001_elsewhere_journeys.sql`. It creates `journeys`, `journey_stops`, `generation_runs`, and `journey_votes`, enables RLS explicitly on those tables and `profiles`, `captions`, `caption_votes`, and inserts the four exact editorial samples. It does not modify `tasks` or add RLS policies.

New tables deny direct `anon` and `authenticated` access. Four transaction functions are callable only by `service_role`. The private client is created inside `utils/supabase/journeys.ts` and is never exported. Each private read or mutation independently calls the ordinary SSR client's `getUser()`. Identity comes from Auth, never from submitted input. Public reads use a fixed `status = published` filter. Drafts and generation history filter by the authenticated author. Generation and Journey votes do not require profile name completion; existing caption rules remain unchanged.

Quota reservation uses a per-user advisory transaction lock and counts all attempts in the current UTC calendar day. A failed reservation row exists before a model request, making interruption visible and preventing unrecorded requests from bypassing the ten-attempt limit. Successful draft, stops, and run association are saved atomically. Vote upserts lock a published Journey and update the same `(journey_id, user_id)` row.

Publication accepts `{ position, candidate_index }[]`: position zero is the cover; positions one through five are stops. Every position must appear once. A null index is allowed only when no image exists. Extra properties, including image objects and URLs, are rejected. The sole `publish_journey` function locks an author-owned draft, validates the complete selection, selects each image from that position's stored candidates, and publishes in one transaction. It returns the committed selected photos to the server. The server then sends one best-effort Unsplash tracking request per selected position, without a retry state machine. Failures emit only a fixed warning, Journey ID, and position and never change the publication result. The prior token/receipt columns and three publication functions were removed.

## Generation and photos

The official server-only `@google/genai` adapter reads `GEMINI_API_KEY` and `GEMINI_MODEL` at runtime. No credential values were inspected or logged. The supplied system prompt is preserved verbatim, with the Museum and Billionaire sample JSON appended. JSON schema output and server validation enforce required fields, field lengths, three to five stops, and three to six words per image query.

Generation, quota reservation, raw-response persistence, draft persistence, and image search share a 60-second abort deadline. Failure-record cleanup is limited to five seconds within the same deadline; its reserved row already records interruption if cleanup fails or the deadline has expired. Invalid output allows one additional model attempt, with a separate durable run and corrective prompt. Provider failures are not retried. SDK transport retries are disabled with `attempts: 1`. Each run stores exact prompts, configured model, raw response text, status, and a controlled error message. A lost response after a committed draft save never overwrites a successful run as failed. An interrupted provider request may still be billed even after client abort; no automatic background restart exists.

Unique cover/stop queries are searched concurrently through Unsplash, with at most six searches per validated Journey. The first three valid results are stored; the first is selected. Images retain the returned `urls.regular`, photographer information, and `links.download_location`. Failed or empty searches yield null placeholders. Browse reads never search again. After successful publication, tracking calls each selected position's stored download location once, with a ten-second timeout, allowed API origin/path, and no redirects. API credentials are transmitted only in server authorization headers.

Seed samples provide Unsplash CDN `photo-...` identifiers, not API photo IDs or tracking links. Their supplied URLs and photographer information are preserved, with `download_location: null`. They enter as already-published editorial content and do not fabricate tracking links.

## Backend contracts and future routes

| Entry point | Behavior |
| --- | --- |
| `createJourney(input)` Server Action | Authenticated generation; returns draft and run IDs or a safe error. |
| `publishJourney(id, selections)` Server Action | Author-owned draft only; selects stored candidates and publishes atomically, then tracks photos best effort. |
| `vote(id, value)` Server Action | Authenticated, published Journey only; `up` or `down`. |
| `GET /api/journeys` | Public published feed, maximum 50 items. |
| `POST /api/journeys` | Same-origin authenticated generation; body limited to 4,096 bytes. |
| `GET /api/journeys/[id]` | Public published detail or author's private draft; unavailable drafts return 404. |
| `GET /api/journeys/generations` | Authenticated user's most recent 20 attempts, including prompts and raw output. |

Responses use `private, no-store`. Future UI routes are `/discover`, `/create`, `/journeys/[id]`, and `/preview/[id]`. They and the backend endpoints are included in `proxy.ts` for session refresh; handler-level checks remain authoritative. No new product pages were created.

## Verification

Final local checks passed: 23 isolated boundary tests, nine HTTP tests, lint, TypeScript, production webpack build, and `git diff --check`. The migration executed successfully; the live rollback transaction tests passed. See the acceptance artifacts for provider results. The build required network access for the project's existing Google Fonts; no provider generation was invoked by the build.

Run isolated boundary tests without calling providers or writing a database:

```sh
node --experimental-vm-modules --test tests/auth-boundaries.test.mjs tests/rating-boundaries.test.mjs tests/journey-backend.test.mjs
npm run lint
npx tsc --noEmit --incremental false
npm run build -- --webpack
```

Run HTTP boundary checks against the local production server:

```sh
npm run start -- --port 3001
node --test tests/public-routes.test.mjs tests/rating-http.test.mjs tests/journey-http.test.mjs
```

Unit tests execute actual application modules with isolated Auth, database, and provider substitutes. They cover anonymous denial, author filtering, draft vote denial, changed votes, quota rejection before paid calls, retry/run association, raw output retention, prompt fidelity, index-only candidate selection, tracking failures after publication, URL validation, and SDK retry configuration. HTTP tests also passed through the local reverse proxy, whose browser-facing Host differs from Next’s internal port. These checks do not substitute for executing SQL or validating the live provider output.

The file-ending production catalog audit after application returned:

| Existing public table | RLS enabled | RLS forced |
| --- | --- | --- |
| `caption_votes` | true | false |
| `captions` | true | false |
| `generation_runs` | true | false |
| `journey_stops` | true | false |
| `journey_votes` | true | false |
| `journeys` | true | false |
| `profiles` | true | false |
| `tasks` | true | false |

All eight public tables have RLS enabled. The tasks table was not changed. The four editorial seeds are present. `supabase/tests/journey_transactions.sql` additionally verified invalid/missing/duplicate indices, author-only draft publication, null photos, draft vote rejection, vote changes, and RPC grants inside a transaction that rolled back all fixtures.

The user authorized two live acceptance requests after migration: both use `afternoon`, `under $25`, `['absurd', 'history']`; the first has an empty wild idea and the second uses `The Background Character Experience — for one day, you're not the main character.` The local-only `scripts/phase2-acceptance.mjs` harness is gated by `MIGRATION_APPLIED=1`, proxies the existing Google login on port 3001 to Next on port 3002, and displays exact raw JSON, selected images, draft, and the corresponding generation run. Each button runs once per harness session. A request can use at most two model calls when its first output fails validation. No publication is part of this acceptance.

## Remaining limits and rubric

- Both live requests succeeded as drafts. They used four model calls total: two image-query validation failures and two successful retries. The exact JSON, selected images, all four complete generation records, and full migration diff are in `docs/phase-2/acceptance-report.md`. The public feed still returns only the four published seeds.
- The current prompt relies on model knowledge; it does not independently verify locations, historical claims, route geometry, business opening status, or budget. Human review remains necessary. The first generated Journey ends in a written audit report despite the no-homework instruction, and both routes repeat Trinity Church in Lower Manhattan. These editorial limitations were reported without making additional model calls.
- Unsplash API failures become placeholders. Application-wide rate limits can be reached even with per-user model quotas. Attribution display and placeholder design belong to Phase 3.
- Tracking is intentionally best effort after commit. A provider failure or process interruption can leave a published photo untracked; no automatic retry or publication rollback occurs.
- Next.js and eslint-config-next are pinned to 16.4.0. `npm audit fix` installed sharp 0.35.5 and source-map-js 1.2.2. Five high audit entries remain in the ESLint/braces dependency chain; no critical or production dependency findings remain. The suggested force fix downgrades eslint-config-next to 14.2.35 and was not applied.

Week 3–5 assignment specifications are available here only as user-provided requirements summarized in the conversation. This phase supplies backend foundations for end-to-end functionality (15), Supabase (10), authentication/protection (10), and voting persistence (10); live storage is verified and provider results are documented separately. Deployment (5) is unchanged and unverified for Elsewhere. Visual design (25), usability (25), and exceptional-quality review (+5) await the UI phase. Source implementation and passing local tests alone do not establish full rubric credit or production accessibility.

## File inventory

- Migration: `supabase/migrations/202610120001_elsewhere_journeys.sql`.
- Data access and actions: `utils/supabase/journeys.ts`, `app/journey-actions.ts`.
- AI and image adapters: `utils/ai/gemini.ts`, `utils/ai/journey-prompt.ts`, `utils/ai/unsplash.ts`.
- Shared contracts and content: `utils/journeys/types.ts`, `utils/journeys/validation.ts`, `utils/journeys/editorial-samples.json`.
- HTTP endpoints: `app/api/journeys/route.ts`, `app/api/journeys/[id]/route.ts`, `app/api/journeys/generations/route.ts`.
- Database rollback tests: `supabase/tests/journey_transactions.sql`.
- Acceptance and tests: `scripts/phase2-acceptance.mjs`, `tests/journey-backend.test.mjs`, `tests/journey-http.test.mjs`.
- Configuration: `package.json`, `package-lock.json`, `proxy.ts`.
- Reports and evidence: `docs/phase-2-backend.md`, `docs/phase-2/migration-review.diff`, `docs/phase-2/rls-audit.json`, and live acceptance artifacts in `docs/phase-2/`.

Previously existing untracked IDE files, the provided sample HTML, and the superseded Phase 2A document were not edited.
