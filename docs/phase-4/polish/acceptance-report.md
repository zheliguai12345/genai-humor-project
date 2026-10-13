# Phase 4 Finishing Acceptance

Completed locally on October 13, 2026. No new migration, Gemini call, database content edit, push, or deployment was performed for this finishing pass. Reading existing Journeys and the authorized real Google sign-in were part of browser acceptance.

## Changes

- Global app text now has a 14px minimum, with narrative text at least 16px. Card hooks allow two lines and metadata wraps without single-line truncation.
- Discover has the exact compact introduction and Create link. Photographer credits appear over photos on desktop hover or keyboard focus; a 44px information button toggles them on phones. Existing photographer and Unsplash referral links are retained.
- Journey and Preview show every stop's photograph or a matching placeholder, with inline credits. Desktop stop photos are 160×120; phone photos span the available width above the stop title.
- Journey and Preview share a lazy Google Maps Embed walking route and a full-route link. Specific stops remain in order; generic instructions are excluded. A few editorial seed queries have code-only anchors. No stored place fields were rewritten. Missing keys, or fewer than two specific locations, omit the iframe while retaining the link.
- The exact specific-place instruction was added to REALITY RULES. The older category fallback was removed because it contradicted that rule. No new generation was requested to test this prompt change.
- `/signin` contains the existing Google component. Protected page redirects and signed-out voting use this entry. Return paths are validated on both initialization and callback; existing callback-scoped HttpOnly/Secure cookies expire after ten minutes and are cleared after callback handling.
- Only one vote sign-in popup can remain open. Opening focuses its login link; outside click or Esc closes it and restores the originating vote button's focus. Card and detail share the same component.

## Validation

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript, no emit | Passed |
| Production build, webpack | Passed; the sandbox's initial Google Fonts DNS failure was resolved by the authorized network-enabled build |
| Full test suite | 70 passed, 0 failed, 0 skipped |
| Real anonymous vote → Sign in with Google → existing Google account → original URL | Passed; returned to `http://localhost:3001/?sort=new` with an authenticated header |
| External `next=https://example.com` | Anonymous sign-in stayed local; authenticated request redirected to `/`, never the external domain |
| Popup uniqueness, outside click, Esc and focus restoration | Passed in the actual browser |
| Discover desktop first screen | First photo began at 306px in an 840px-high viewport, with its entire 190px height visible |
| Discover, Create, Preview, Profile at 320px | Document scroll width equaled viewport width; no horizontal page overflow |
| Journey at 375px | No page overflow; full-width stop images above titles; route iframe 200px high |
| Desktop Journey | All four stop photos loaded at 160×120; route map rendered at 240px high |
| App font checks | No Journey text below 14px; Discover, Create and Profile minimum measured font size 14px |
| Missing Maps key | Isolated test confirms full-route link remains and iframe is absent |

Tests additionally cover safe local return queries/fragments, encoded/external redirects, callback cookie clearing, ten-minute return-cookie lifetime, ordered/encoded Maps queries, seed anchors, anonymous and other-author access boundaries, optimistic vote cancellation/change, rollback, and denial of other-user vote deletion. Tests isolate paid model calls and database writes. External Google iframe text is controlled by Google rather than app CSS.

## Files

UI: `app/globals.css`, `app/page.tsx`, `app/components/{photo,journey-card,journey-article,route-map,site-header,sign-in-link,vote-controls}.tsx`, `app/signin/page.tsx`, and the protected Create, Preview, Profile pages/editor.

Authentication/maps/prompt: `app/auth/{nonce,callback}/route.ts`, `app/components/google-sign-in.tsx`, `utils/{auth-return,auth-validation}.ts`, `utils/journeys/maps.ts`, `utils/ai/journey-prompt.ts`, `proxy.ts`.

Tests/documentation: authentication, voting, Journey page/HTTP and route tests; new Maps and sign-in return tests; README, deployment/manual checklists, this report, logs and screenshots.

## Rubric coverage and remaining checks

This pass supports usability and visual design through readable cards, direct voting, accessible login guidance, mobile layouts and route context. Authentication/route protection and voting persistence retain their existing server boundaries, now with return-path and popup coverage. Backend and Supabase behavior remain covered by the complete suite; no schema was changed. Deployment points remain unverified until the user deploys and checks public access on the submitted URL.

Set `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` in the intended Vercel environments before building, and manually verify Maps Embed API enablement and key restrictions as described in the deployment checklist. Local Maps rendering does not verify those deployment settings. Google's account chooser still shows the existing OAuth app name, `The Humor Project`; consent branding is a manual cloud configuration item.

Maps query filtering is not factual verification. Generated business existence, exact routing, hours and safe access still require review. The older private acceptance draft remains unpublished and retains its previously reported unsafe platform-edge move; no database correction or publication was performed. The new specific-place prompt does not retroactively change existing Journeys. Publication, avatar upload and deployment acceptance remain on the manual checklist.

No further approval is required for this local finishing pass. Work stops after its local commit; a later phase or deployment requires separate instructions.

## Screenshots

| Page | Desktop | Phone |
| --- | --- | --- |
| Discover | [Desktop](screenshots/discover-desktop.jpg) | [320px](screenshots/discover-mobile.jpg) |
| Journey | [Desktop](screenshots/journey-desktop.jpg) | [375px](screenshots/journey-mobile.jpg) |
| Create | [Desktop](screenshots/create-desktop.jpg) | [320px](screenshots/create-mobile.jpg) |
| Preview | [Desktop](screenshots/preview-desktop.jpg) | [320px](screenshots/preview-mobile.jpg) |

[Photo credit overlay](screenshots/discover-attribution.jpg), [central sign-in](screenshots/signin.jpg), [successful return](screenshots/signin-return.jpg).
