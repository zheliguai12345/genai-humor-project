# Phase 4 Acceptance Report

The product now centers on a compact Journey card with direct voting. One real Google-authenticated generation completed successfully after the user reported upgrading the Gemini project to a paid tier. All work is local; no migration, push, deployment, Vercel setting, or environment-value change was performed in this completion run.

## Product and files

| Area | Result | Main files |
| --- | --- | --- |
| Discover | One responsive card wall; Top uses up minus down, New uses publication time; budget and stop count remain visible on narrow cards | app/page.tsx, app/components/journey-card.tsx, utils/supabase/journeys.ts |
| Voting | Shared card/detail optimistic controls; same direction cancels, opposite direction changes; failures roll back; anonymous clicks open local sign-in guidance | app/components/vote-controls.tsx, app/journey-actions.ts, utils/journeys/presentation.ts, utils/supabase/journeys.ts |
| Detail | Cover, title, hook, metadata and voting; compact numbered stops, Maps, Your move, native More expansion; no premise or separate route overview | app/components/journey-article.tsx, app/journeys/[id]/page.tsx |
| Create | One idea field, single-row scrollable theme tags, collapsed Options, default afternoon/under $25/no vibes, quota/reset line and real stage events | app/create/{page,create-form}.tsx, app/api/journeys/route.ts, utils/journeys/generation-stream.ts |
| Preview | Real private draft card and compact stops; no candidate selector; Publish sends stored index 0, or null for missing photos; success goes to New | app/preview/[id]/{page,preview-editor}.tsx |
| Profile | 96×96 circular cover-fit avatar, initials fallback, hidden native input, Change photo label, local preview/filename/Save hint, immediate validation, compact Your journeys cards | app/profile/{page,profile-form}.tsx |
| Design/docs | Geist body/Newsreader headings, visible focus, 44px vote controls, responsive grid, simplified footer, current README and checklists | app/globals.css, app/layout.tsx, README.md, docs/phase-4/ |
| Generation | Bounded recovery, one quota reservation per submission, actual model persistence, parallel short-timeout photo searches, structured stage timing, short-copy and safety instructions | utils/ai/{gemini,journey-prompt,unsplash,generation-telemetry}.ts, utils/journeys/types.ts, utils/supabase/journeys.ts |

Cancellation lives in a server-only module, checks `auth.getUser()`, and deletes by both the authenticated user ID and Journey ID. Existing database functions/tables/RLS are preserved. Existing Rate redirects, Privacy disclosures and proxy matchers remain intact.

## Generation result and timing

Input: afternoon, under $25, no vibes, `An Alien's First Day on Earth — Explain humanity through New York.`

Result: **Field Notes on the Bipeds**, four stops, Journey `68af6953-8aba-4909-a12e-c05199098840`, saved as an unpublished draft. The corresponding generation_runs record was read back for this Journey only: status `success`, model `gemini-3.8-flash`, no validation history. The exact prompts/model/raw output are in paid-tier-generation-run.json; the full output is in paid-tier-journey-raw.json.

| Stage | Duration |
| --- | --- |
| Gemini request, primary attempt 1 | 7850 ms |
| Output validation | 1 ms |
| Cover search | 454 ms |
| Stop 1 / 2 / 3 / 4 searches | 341 / 447 / 446 / 444 ms |
| All five photo searches in parallel | 455 ms |
| Draft transaction | 142 ms |
| Total generation pipeline | **8974 ms** |

The remaining 526 ms covers reservation, raw-response persistence and orchestration. The Gemini wrapper timing contains the request and is not added twice. One model call, zero provider retries/fallback calls/validation retries, and one quota decrement (3 → 2). The first generation succeeded, so the five-minute retry condition did not apply and no second generation was sent. Timings are server-generation durations, not a claim about complete browser navigation latency.

The previous recovery test returned 503 from both primary attempts and fallback before validation/photos. The minimal `Say hi` diagnostic also returned Google's explicit high-demand 503. This established provider availability as the observed cause; slow output could additionally have been interrupted by the old primary cap. The primary cap is now **60 seconds**, shared deadline **90 seconds**. Recovery remains: 503/504/network timeout → wait two seconds → one primary retry → one fallback, all inside the shared deadline. Other numeric errors do not retry. SDK attempts remain one; photo requests time out after two seconds and become null. The generation route exports maxDuration 120. LOW for 3.8 Flash and MINIMAL for default Flash-Lite follow [Google's official thinking documentation](https://ai.google.dev/gemini-api/docs/generate-content/thinking).

## Verification

- Lint, TypeScript, production webpack build and **63 tests passed**. Evidence: lint-results.txt, typecheck-results.txt, build-results.txt, test-results.txt.
- Tests exercise card vote → cancel → vote/change, rollback after vote/cancel failure, authenticated deletion filtering against another user's vote, anonymous mutation denial, author-only drafts, private metadata, net-score ranking, publication permissions, one quota reservation with correction history/actual fallback model, fragmented progress events, parallel photo starts and bounded timeout-to-null behavior.
- Profile tests exercise real client handlers: local preview without a save/upload call, initials/hidden input, oversized files and spoofed image headers causing immediate errors and disabling Save.
- Real browser: signed-in generation → Preview → Try again, quota 3 → 2, Profile → the new draft, default Options, keyboard More/Options, native Google sign-out scoped only to the separate in-app browser session, signed-out vote guidance without navigation, Create/Preview redirects, draft public 404, Rate redirect and Privacy disclosures.
- Real browser voting on the Museum seed: none → up → none → down → up → none, with refresh persistence and agreement between card/detail. Restored the initial unvoted state; the user's pre-existing Last Day vote was untouched. No Journey was published or profile saved.
- At actual 320px CSS width, Discover, Journey, Create, Preview and Profile had document scrollWidth equal to clientWidth. Desktop had four columns; phone had one. Theme tags scroll inside their own row without page overflow. Vote controls are declared 44×44 CSS pixels. Keyboard focus was visible. The measured text palette has a minimum contrast ratio of 5.38:1; the final build manifest records maxDuration 120 for generation/Create/Preview.
- Screenshots are actual app pages, including the real author's new Preview, with desktop and approximately 375px CSS phone captures. Chrome's existing 90% zoom was preserved; temporary viewport overrides were reset. browser-checks.json records measurements.

## Content acceptance limits

The generated hook has 11 words but two sentences, rather than the requested single sentence. Stop bodies and moves are each one sentence. The fourth move instructs standing on the platform's yellow tactile edge and fails safety acceptance. Specific places/addresses, the route, access and budget are not independently verified. The draft remains unpublished and its original output is preserved. A clear safe/legal/platform-warning-strip instruction was added to the prompt afterward, without an extra model call; improved output from that addition is not claimed as verified. Structural validity is not proof of an executable Journey.

Live publication/new-feed placement, personal avatar persistence, a second real user ownership check, and deployment accessibility remain manual checks. Isolated tests cover their permissions/error boundaries. Actual billed model cost was not inspected.

## User-provided Week 5 rubric coverage

| Rubric | Evidence and remaining acceptance |
| --- | --- |
| End-to-end — 15 | Local real generation/draft/preview/vote verified; live publication still manual |
| Supabase — 10 | Accepted Phase 2 schema retained; success record/raw prompt/model read back; persisted votes refreshed; no migration |
| Authentication — 10 | Real authenticated session plus signed-out/other-author boundaries tested; production OAuth still manual |
| Voting persistence — 10 | Card/detail vote, cancel and change verified after refresh; owner-only cancellation tests pass |
| Deployment — 5 | Official-doc checklist prepared; no new deployment or deployment credit claimed |
| Visual design — 25 | Compact card wall, editorial typography, responsive screenshots and preserved credits |
| Usability — 25 | Visible voting, collapsed copy/options, direct progress, quota/reset, keyboard and mobile checks; publication/photo-save manual |
| Exceptional quality — +5 | Not claimed; safety/place review and reviewer judgment remain necessary |

Week 3–5 assignment specifications are the user-provided requirements summarized in the conversation. Follow manual-acceptance.md and deployment-checklist.md for remaining user-led work. Local implementation/test completion does not mean content or production deployment acceptance has passed.
