# Elsewhere, NYC.

**One city. A thousand ways to live it.**

An editorial NYC experience magazine built with Next.js 16.4, React, Supabase, Google Gemini, and Unsplash. Ordinary real places become imaginative journeys, with private generation, preview, publication, and persisted reader votes.

## Product routes

- `/`: public card wall with Top (net score) and New (publication time), and voting directly on each card.
- `/journeys/[id]`: compact published journeys, Maps links, expandable stop descriptions, credits, and the same voting controls.
- `/create`: one idea field, seven starting-theme tags, collapsed Options, and server-driven generation progress.
- `/preview/[id]`: author's private draft card and stops, explicit publication using stored photo candidate 0, and Try again.
- `/profile`: circular avatar with a local unsaved preview, names, Save profile, and Your journeys cards.
- `/privacy`: account, AI input, image-provider, and voting disclosures.
- `/rate`: retired caption page; redirects to Discover. Its database tables remain intact.

## Local development

```sh
npm ci
npm run dev -- --port 3001
```

Port 3001 matches the existing local Google redirect configuration. Configure environment variables privately; names are documented in [the deployment checklist](docs/phase-4/deployment-checklist.md). Never commit `.env.local` or expose server keys with a `NEXT_PUBLIC_` prefix.

Production verification:

```sh
npm run lint
npx next typegen
npx tsc --noEmit --incremental false
npm run build -- --webpack
npm run start -- --port 3001
# In another terminal, while the server is running:
node --experimental-vm-modules --test tests/*.test.mjs
```

Tests isolate paid generation and database writes. HTTP tests use anonymous requests to the local server. They require the Phase 2 schema and published editorial seeds in the already-configured Supabase project.

## Architecture and boundaries

Server-only data modules validate `auth.getUser()` before private reads or mutations, then use private privileged clients. Public reads filter `published`. Drafts and generation history belong only to their author. New tables have RLS enabled and no direct anon/authenticated grants. The applied Phase 2 migration includes service-role-only transactional quota reservation, draft persistence, index-only publication, and changed-vote upserts. Do not reapply it to production.

Every generation submission stores input, prompts, the actual model, and exact raw output. Users receive at most ten submissions per UTC calendar day; provider recovery and validation correction share one quota reservation. The UI displays the reset in New York time. Requests share a 90-second deadline; primary calls have a 60-second cap. A 503, 504 or network timeout waits two seconds and retries once before using `GEMINI_FALLBACK_MODEL` (default `gemini-3.5-flash-lite`) once. Other provider statuses do not retry. At most one validation correction is allowed; earlier output is retained in the same run's validation history.

Long image queries are truncated to six words. Photo searches run concurrently, each with a two-second timeout; only an empty successful search broadens once. Missing/error photos become placeholders. Publication saves candidate indices transactionally, then sends best-effort Unsplash tracking. Votes have three states: up, down, and none; canceling deletes only the authenticated user's vote in the server-only module.

Fonts are self-hosted by Next.js: Geist for readable body text and Newsreader for editorial titles. Photos retain Unsplash's returned hotlink URLs and photographer attribution. Missing images use typographic placeholders.

## Acceptance and deployment

- [Phase 4 acceptance report](docs/phase-4/acceptance-report.md)
- [Remaining manual acceptance](docs/phase-4/manual-acceptance.md)
- [Deployment preparation](docs/phase-4/deployment-checklist.md)
- [Phase 2 backend report](docs/phase-2-backend.md)
- [Exact Phase 3 quality outputs](docs/phase-3/quality/)

Phase 3 quality verification is a separate explicit script. It saves local records and never accesses Supabase. Running it incurs real model calls; it refuses to repeat existing cases automatically.

```sh
node --experimental-vm-modules scripts/phase3-quality.mjs --run-live
```

The two Phase 3 cases have already run. Do not rerun them as part of normal tests. Phase 4 verified one real authenticated generation and refresh-persisted card/detail voting, restoring the temporary test vote. The generated Journey remains a private draft; publication and personal profile upload remain user-led acceptance. Production deployment accessibility and real-place feasibility must be checked separately from passing local tests.
