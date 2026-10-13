# Elsewhere, NYC. Phase 3 Acceptance Report

## Scope and result

Implemented the complete product interface and the requested server generation-quality changes. No new migration, live project data mutation, push, or deployment occurred. Existing Phase 2 prerequisites were already present as uncommitted source and are included in the local product commit.

The new visual system uses Geist body text, Newsreader titles, warm paper, forest ink, and restrained rust accents. Discover keeps images subordinate to editorial text. Hooks are a single italic line in list rows; full detail hooks use regular text. Missing images use a typographic placeholder. Text palette pairs pass 4.5:1 contrast; body measure is capped at 65ch, native controls have visible focus, and action targets exceed 44px.

## Pages and source

- Discover: three published sections, up-vote ranking, honest community empty states, public Google sign-in.
- Public Journey: published-only detail and metadata, route overview, stop rows, encoded Maps links, Unsplash credit/referral links, persisted selected-vote UI and anonymous sign-in guidance.
- Create: authenticated page, seven editable starting themes, time/budget/vibes, 200-codepoint idea limit, quota/reset feedback, duplicate-submit guard, phased waiting messages.
- Preview: author's draft only, three stored photo candidates per available position, index-only publication, Generate another, public redirect after publication.
- Profile: original name/avatar functionality retained; author-only Your journeys with draft/public links.
- Rate: redirect to Discover; caption data and legacy backend preserved.
- Privacy, metadata, navigation, favicon, errors and 404: Elsewhere branding and provider disclosure.
- All new routes included in proxy matcher. Google return paths are local and allowlisted. New Server Action pages declare a 60-second maximum duration.

Main files: app/page.tsx, app/journeys/[id]/page.tsx, app/create/{page,create-form}.tsx, app/preview/[id]/{page,preview-editor}.tsx, app/profile/page.tsx, app/privacy/page.tsx, app/components/{site-header,navigation,journey-list,journey-article,photo,vote-controls}.tsx, app/globals.css, app/layout.tsx, app/auth/{nonce,callback}/route.ts, utils/supabase/journeys.ts, utils/ai/{journey-prompt,unsplash}.ts, utils/journeys/{validation,presentation,themes}.ts, proxy.ts, tests/*.

## Generation quality changes

Image queries longer than six words are truncated on the server rather than retried as validation failures. Successful empty Unsplash searches broaden once to the final three words plus New York. A second empty search stores null; provider errors and rate limits do not trigger repeated searches. The four requested prompt additions are present verbatim. Paid model/database behavior is isolated from normal tests.

## Live quality verification

Configured model: gemini-3.8-flash. Two successful complete outputs are below. The first Alien request failed without raw output; its cause was not established from the controlled error record. One explicitly bounded local retry succeeded. Total: three actual model requests, two successful outputs. No Unsplash API search, publication tracking, Supabase generation_runs insertion, or Journey save was performed by this quality script.

Local records retain input, complete system/user prompts, model, timestamp, raw output, normalized output, status and safe error: quality/run-1.json, quality/run-1-retry.json, quality/run-2.json. The exact raw JSON files are quality/journey-1-raw.json and quality/journey-2-raw.json. Long query normalization is recorded separately; original responses are unchanged. Actual billed cost is not verified.

| Evaluation | Alien case | Food/night case |
| --- | --- | --- |
| Creativity | Alien field-research premise produces distinct ordinary-city encounters | Canceled-flight premise connects a Queens meal route |
| Curation | Ordinary outdoor places and a small shop; exact dog-run access unverified | Diverse food contexts; unspecified bakery cannot yet be individually verified |
| Composition | Physical moves; hook says four hours while time window says three; one grammar error | Physical moves and coherent food progression |
| Diversity | Union Square/East Village; no museum/church/landmark stop | Jackson Heights/Elmhurst; moves away from Manhattan default |
| Reality and feasibility gate | Not accepted: fixed five-dollar payment, opening/access and historical detail unverified | Not accepted: nightly bakery availability, park address/access and late timing unverified |

These are creative samples, not independently verified executable itineraries. Prompt compliance is probabilistic; a passing JSON schema is not a reality check. No original output or existing seed was silently rewritten.

## Tests and evidence

- npm run lint: passed, including the isolated visual-review script.
- npx tsc --noEmit: passed.
- npm run build -- --webpack: passed; all product routes generated successfully.
- 36 isolated unit/boundary tests: passed.
- 10 production-server HTTP tests: passed.
- Production dependency audit (npm audit --omit=dev): zero vulnerabilities. Prior development-only ESLint/braces findings remain; no forced downgrade.
- Browser: actual public Discover, Journey, Privacy and 404 rendered while signed out. Discover and Journey captured at 1000px and 375px. At 320px, all public pages plus isolated Create/Preview components had scrollWidth equal to clientWidth. Keyboard skip-link focus was visible; anonymous vote displayed sign-in guidance. Actual Create/Preview redirected before private content rendered.
- Author versus other-user draft boundaries, anonymous mutation denial, published-only metadata, quota ownership, vote aggregation and photo fallback are tested with isolated dependencies. No private UI interaction is claimed as authenticated browser acceptance.

Evidence: browser-checks.json and screenshots/. Full-page screenshots and first-screen screenshots are both included. Create and Preview screenshots are read-only renders of the real components with a sanitized local Phase 2 sample, visibly labeled Local visual review. They are not evidence of a real Google-authenticated generation/publication flow. The isolated server never imports environment files or Supabase; it is not a shipped app route or an auth bypass.

## User acceptance and deployment

Follow manual-acceptance.md for actual Google sign-in, theme selection/editing, generation, candidate selection, publication, refresh-persisted changed votes and preserved profile/avatar functionality. These live mutations are left to the user.

Follow deployment-checklist.md for server variable names, exact Google origins/callbacks, unprotected assignment URLs, and the immutable deployment URL matching the commit SHA. No deployment URL was fabricated or deployment credit claimed.

| User-provided Week 5 rubric | Coverage / remaining evidence |
| --- | --- |
| End-to-end functionality — 15 | Product routes/actions implemented and local boundaries pass; real Google generate/preview/publish flow awaits manual acceptance |
| Supabase integration — 10 | Existing accepted Phase 2 schema/RLS/RPC preserved; public read verified; no Phase 3 mutation |
| Authentication and route protection — 10 | Anonymous and ownership boundaries tested; real Google return/session acceptance remains manual |
| Voting persistence — 10 | Authenticated association/upsert preserved and tested; live vote/change/reload acceptance remains manual |
| Deployment — 5 | Checklist ready; not deployed or independently accessible at a new commit URL |
| Visual design — 25 | New magazine design, responsive evidence, accessible palette and semantic controls |
| Usability — 25 | Editable themes, quota/reset, phased waiting, draft/publish separation, route overview and friendly errors; authenticated interaction checks remain manual |
| Exceptional quality — +5 | Not claimed; requires reviewer judgment and real-place/route quality verification |

Week 3–5 specifications are the user-provided requirements summarized in the conversation, not independently retrieved assignment documents.

## Exact raw output: Alien

```json
{
  "title": "First Contact on 14th Street",
  "kicker": "Field research",
  "hook": "Your craft landed at midday. You have four hours, twenty dollars of local currency, and orders to explain this species to high command.",
  "premise": "Assume Earth is entirely uncataloged. The tall bipeds moving along 14th Street into the East Village are not your neighbors or fellow students. They are an baffling terrestrial species engaged in ritual consumption, fur worship, and daily skin-swapping. You are here to take physical inventory.",
  "when_label": "Saturday · 1–4 PM",
  "budget_label": "Under $25",
  "area": "Union Square → East Village",
  "mode": "Walking · 4 stops",
  "ending": "Field report concluded. The species is fragile, carbon-based, and hopelessly devoted to four-legged rulers. Re-entry sequence begins.",
  "cover_image_query": "Union Square crowd shadows New York",
  "stops": [
    {
      "time_label": "1:00 PM",
      "title": "The Sorting Ground",
      "place": "Union Square South Plaza, 14th St & Broadway",
      "body": "Subterranean tubes discharge hundreds of bipeds every sixty seconds onto a slab of stone. They scatter without colliding, guided by handheld glowing tablets that dictate their velocity and path.",
      "move": "Stand near the south steps. Count forty bipeds with glowing screens before taking a single step forward.",
      "image_query": "Union Square pedestrian plaza New York"
    },
    {
      "time_label": "1:50 PM",
      "title": "Exoskeleton Replacement Center",
      "place": "St. Marks Place, between 3rd Ave & 2nd Ave",
      "body": "Unlike mollusks, humans shed their outer shells daily. Here they barter for dyed textiles printed with territorial emblems, obsolete musical ensembles, and optical shields.",
      "move": "Stop at an outdoor rack. Touch three different shirts made of different fabric blends with your thumb and forefinger.",
      "image_query": "St Marks Place street vendors New York"
    },
    {
      "time_label": "2:40 PM",
      "title": "Synthetic Fuel Dispenser",
      "place": "Ray's Candy Store, 113 Avenue A",
      "body": "The colony maintains emergency fueling depots operated by lone elders. This station has poured liquid glucose, milk solids, and pressurized seltzer into paper vessels since 1974.",
      "move": "Hand over five dollars in cash. Order an egg cream. Drink it on the curb without altering your facial expression.",
      "image_query": "Rays Candy Store neon Avenue A"
    },
    {
      "time_label": "3:25 PM",
      "title": "The Master Species Enclosure",
      "place": "Tompkins Square Park Dog Run, Avenue B & 9th St",
      "body": "A fenced reservation reveals the true hierarchy of the planet. Small furry quadrupeds run in circles while the tall bipeds stand along the perimeter, gathering canine excrement into plastic satchels as an act of devotion.",
      "move": "Grip the chain-link fence with both hands. Stay motionless until one quadruped makes direct eye contact with you.",
      "image_query": "Tompkins Square Park dog run New York"
    }
  ]
}
```

## Exact raw output: Food/night

```json
{
  "title": "The Canceled Flight",
  "kicker": "A night journey in four courses",
  "hook": "Your plane never left the runway. The boulevard below serves dinner from every hemisphere anyway.",
  "premise": "Pretend your flight out of Queens was grounded until dawn and you have fifty dollars in your pocket. Roosevelt Avenue runs beneath an iron sky of elevated train tracks, where neon signs glow like terminal departure boards. You do not need a boarding pass to eat like a stranded traveler.",
  "when_label": "Friday · 7:00 – 10:15 PM",
  "budget_label": "Under $40",
  "area": "Jackson Heights → Elmhurst",
  "mode": "Walking · 4 stops",
  "ending": "Your plane never took off. By midnight, your shoes smell like cumin, citrus, and train grease, and you are already somewhere else.",
  "cover_image_query": "Roosevelt Avenue elevated train Queens night",
  "stops": [
    {
      "time_label": "7:00 PM",
      "title": "Terminal One: The Steam Valley",
      "place": "Diversity Plaza, 73rd St & 37th Rd, Jackson Heights",
      "body": "The street was closed to cars years ago so crowds could congregate under the steam of sidewalk kitchens. Men in woolen caps argue beside folding tables. Counters nearby steam dumplings folded with scallions and chili paste.",
      "move": "Order a plate of steamed beef momos at any counter facing the plaza. Eat them standing on the brick paving while the train rumbles overhead.",
      "image_query": "Diversity Plaza Jackson Heights Queens night"
    },
    {
      "time_label": "8:00 PM",
      "title": "Terminal Two: The Red Broth",
      "place": "Birria-Landia, Roosevelt Ave & 77th St",
      "body": "Beneath the green steel trestle, a plain white truck holds court under sodium lamps. The menu has four items, all ladled from the same slow-simmered pot of spiced beef. The grease on the paper bowl turns translucent red.",
      "move": "Order two mulitas and a small cup of consommé. Dip the fried tortilla into the broth and eat it leaning against the subway column.",
      "image_query": "Birria Landia taco truck night Queens"
    },
    {
      "time_label": "9:00 PM",
      "title": "Terminal Three: The Panadería Glass",
      "place": "Roosevelt Avenue, between 81st & 83rd St",
      "body": "Every few storefronts, glass display cases glow with warm yellow bulbs. Behind the glass are stacked guava pastries, corn cakes, and cheese breads fresh from sheet pans.",
      "move": "Walk into the first lit bakery you pass. Point through the display glass to one warm pan de bono, pay with cash, and hold the wax paper in your palm.",
      "image_query": "bakery window display night Queens"
    },
    {
      "time_label": "9:50 PM",
      "title": "Terminal Four: The Elmhurst Curve",
      "place": "Moore Homestead Playground, Broadway & 82nd St, Elmhurst",
      "body": "Follow the avenue south where Spanish signage shifts into Thai script and Cantonese characters. The park sits at the crook where Elmhurst opens up, quiet and dark against the roar of Broadway buses.",
      "move": "Sit on a bench near the perimeter fence. Stay until three separate trains pass overhead on the distant trestle.",
      "image_query": "Elmhurst Queens street corner night"
    }
  ]
}
```
