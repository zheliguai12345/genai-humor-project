# Elsewhere, NYC.

**One city. A thousand ways to live it.**

An editorial NYC experience magazine built with Next.js 16.4, React, Supabase, Google Gemini, and Unsplash. Ordinary real places become imaginative journeys, with private generation, preview, publication, and persisted reader votes.

## Product routes

- `/`: public Discover, with editor's picks, reader favorites, and newly published community journeys.
- `/journeys/[id]`: published journeys, route overview, Maps links, credits, and voting.
- `/create`: Google-authenticated generation with seven optional starting themes.
- `/preview/[id]`: author's private draft, photo candidate selection, and explicit publication.
- `/profile`: existing name/avatar functionality and Your journeys.
- `/privacy`: account, AI input, image-provider, and voting disclosures.
- `/rate`: retired caption page; redirects to Discover. Its database tables remain intact.

## Local development

```sh
npm ci
npm run dev -- --port 3001
```

Port 3001 matches the existing local Google redirect configuration. Configure environment variables privately; names are documented in [the deployment checklist](docs/phase-3/deployment-checklist.md). Never commit `.env.local` or expose server keys with a `NEXT_PUBLIC_` prefix.

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

Every app generation attempt stores input, prompts, model, and exact raw output. Users receive at most ten attempts per UTC calendar day; the UI displays the reset in New York time. Requests share a 60-second deadline. Long image queries are truncated to six words; empty photo searches broaden once. Publication saves candidate selections transactionally, then sends best-effort Unsplash tracking.

Fonts are self-hosted by Next.js: Geist for readable body text and Newsreader for editorial titles. Photos retain Unsplash's returned hotlink URLs and photographer attribution. Missing images use typographic placeholders.

## Acceptance and deployment

- [Manual Google-authenticated acceptance](docs/phase-3/manual-acceptance.md)
- [Deployment preparation](docs/phase-3/deployment-checklist.md)
- [Phase 2 backend report](docs/phase-2-backend.md)
- [Exact Phase 3 quality outputs](docs/phase-3/quality/)

Phase 3 quality verification is a separate explicit script. It saves local records and never accesses Supabase. Running it incurs real model calls; it refuses to repeat existing cases automatically.

```sh
node --experimental-vm-modules scripts/phase3-quality.mjs --run-live
```

The two requested cases have already run. Do not rerun them as part of normal tests. Actual generate/publish/vote/profile-save flows are left for user-led manual acceptance because they mutate the sole live project. Production deployment accessibility and real-place feasibility must be checked separately from passing local tests.
