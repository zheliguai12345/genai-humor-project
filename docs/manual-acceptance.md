# Manual Acceptance

Completed locally with the real Google-authenticated account: one /create generation, persisted model/prompts/raw output, author-only Preview, quota decrement by one, Profile journey link, card voting and detail voting, vote cancellation/change, refresh persistence, and restoration of the original test vote state. Signed-out browsing and vote guidance were checked separately. Test fixtures cover anonymous and other-author denial, failure rollback, photo timeouts, and bounded provider recovery.

Remaining live checks should be run by the user on the exact deployment URL after deployment configuration:

- On Discover, check the full-height landing Hero and both decorative filmstrips; Browse journeys must scroll to Discover beneath the sticky header. Top/New links and successful publication now target the `#discover` anchor. At widths up to 900px, films are hidden and steps stack. With reduced motion enabled, film and Scroll animations stop and anchor scrolling is immediate.
- Share a published Journey from a card and its public detail page. On a real device supporting native sharing, cancel once and confirm no error; choose a recipient only when intended. Other browsers copy the absolute detail URL and show `Link copied` for two seconds. Card sharing must not open the card. Drafts expose no Share button. Metadata tests cover hook descriptions, Open Graph/Twitter cover images, and omission when no cover exists; native-sheet delivery to an external app remains a device acceptance check.

- Start signed out on `/?sort=new`, click a card vote, then Sign in with Google. Confirm login returns to that same URL; `/signin?next=https://example.com` must return to Discover after login. This complete flow passed locally, alongside single-popup, outside-click/Esc close, and focus restoration checks.
- Check embedded walking maps on Journey and Preview at desktop and phone widths, including the full-route link. Verify deployment key restrictions manually. Generic stops may be absent from the map; confirm mapped places, hours and safe walking access separately.
- In Profile, cancel a Delete confirmation and confirm the card remains. On a disposable own Journey, confirm deletion, the immediate list update and `Journey deleted` message; published Journeys additionally warn that votes will be removed. Editorial seeds have no Delete button. Ownership/authentication and existing cascade contracts are covered by isolated tests; no unrelated Journey was deleted during this UI verification.
- Sign in through Google, return to Create, and refresh. Confirm the same profile and journeys remain available.
- On a separately reviewed, safe draft, click Publish once. Confirm navigation to `/?sort=new#discover`, publication at the top of New, selected image candidate 0 at each non-null position, and public detail access in a signed-out window. The acceptance draft `68af6953-8aba-4909-a12e-c05199098840` has received the approved place, platform-safety and daytime-photo corrections below; full itinerary feasibility review and publication remain manual checks.
- Vote on a card, cancel the same direction, vote again, change direction, and refresh. Check the detail page agrees. Restore any temporary test vote when finished.
- Select a personal avatar and confirm the 96×96 circular local preview, filename, and Save hint. Click Save profile only when ready to upload that photo; refresh and confirm persistence. Invalid/spoofed formats and files over 2 MB must show an immediate error. Local acceptance selected a test photo but did not save or change profile data.
- Check a 320px phone viewport: one card column, no page overflow, visible keyboard focus, 44px voting controls, collapsed Options/More, and access to all seven horizontally scrollable theme tags. The page itself must not scroll horizontally.
- During actual provider recovery, confirm the fallback stage reads `Busy right now — trying a faster model…`. Isolated tests cover this stage; the successful paid-tier verification did not need a fallback.

Publication, profile upload, deployed provider recovery, and a second-account ownership check are not claimed as completed live acceptance. Their server boundaries and error paths are covered by isolated tests.

After explicit user approval on October 13, 2026, `Field Notes on the Bipeds` remained a draft while stop 3's place was changed to `48th Ave & 43rd St, Sunnyside` and stop 4's move to `Wait on the platform, well behind the yellow line, until two trains have rattled past.` Read-back verification confirmed exactly these two field changes; bodies and images were unchanged by the text update. Stop 1's separately approved daytime photograph is Crystal Jo's `mLLhlv_FVjU`, with one successful download-tracking request.

## One-time photo maintenance

`node scripts/repair-published-images.mjs --dry-run --plan /tmp/elsewhere-image-repair-plan.json` reads published Journeys and lists null-photo rows plus the two explicitly requested test-Journey deletion counts. It uses one Unsplash search to inspect quota, without database writes or download tracking. Add `--database-only` to omit that quota request. Keep the resulting plan outside Git and obtain explicit approval before using `--apply-images` or `--delete-approved-journeys` with the same `--plan` path.

Cover searches use the first stop; stop searches use their own place. The shared map-query helper keeps the venue name and address/cross-street segments separated by commas or middle dots, while removing narrative fragments. Repairs keep the first Unsplash result's hotlink and attribution, update only a still-null image, and request its download location once. Calls are sequential, capped at one fresh quota probe plus two requests per approved image, with a five-request reserve and no retries. Unknown/insufficient quota or provider failure stops the operation. A tracking failure after a saved image is reported and stops the batch; it does not trigger another download request.

Map queries use `New York City` as the locality; origin, destination and pipe-separated waypoints are encoded with `URLSearchParams`, including `%26` for literal ampersands. On October 13, 2026, live Embed verification completed within the twenty-minute diagnostic window: The Familiar Procurement Route (already published at verification time) and all four editorial seeds showed neighborhood-scale walking routes. No real Embed key was printed or read back from an iframe URL; encoding tests use an isolated dummy key. New generations also receive the exact time-of-day image-query instruction.

`Friendly Neighborhood Surveillance` (`6403573b-eb79-4d9b-915a-fc188ca15133`) was also verified live on October 13, 2026. Google Maps could not resolve its third stop's `49th Avenue Viaduct` name; a map-only anchor uses the existing `49th Ave & 21st St` intersection while preserving the displayed and stored place. The third query is now `49th Ave & 21st St, Queens, New York City`, with its ampersand encoded as `%26`. The final address-first Embed shows the Queens walking route, approximately 4.0 miles and 1 hour 31 minutes. Generic `Any`/`A` places containing `on` discard the complete venue prefix before parsing street and neighborhood segments. Its approved cover is Erik Mclean's Unsplash photo `8SeJUmfahu0`; metadata lookup and the single download-tracking request both returned HTTP 200.

Route queries now prefer one explicit street address or intersection plus available locality fragments, omitting the preceding venue name. Queries without such a segment retain the existing name-based behavior; generic `Any`/`A` processing is unchanged. Photo maintenance explicitly keeps venue names in its search queries instead of inheriting the new route preference. Address-first verification also exposed a misleading first-stop intersection in the Friendly Journey: its map-only origin uses `Queens Blvd & 46th St, Queens`, the Bliss Street station intersection, without editing the stored or displayed `Roosevelt Ave` copy.

Deletion rechecks IDs, titles, publication status and all reviewed counts. Existing foreign keys cascade stops/votes; generation history is retained with `journey_id` cleared. If counts change before execution, obtain a fresh review. Deleting the two test Journeys may remove all current missing-photo targets, in which case skip repair calls.

## Seed route check

Google Maps walking directions, opened from the shared route-query URLs on October 13, 2026, returned the following totals. Walking times exclude time spent at stops. App place text remains unchanged; map queries retain venue names, street addresses and cross streets while discarding narrative fragments.

| Journey | Distance | Walking time |
| --- | --- | --- |
| The Museum That Doesn't Exist | 1.0 mile | 22 min |
| The Last Day on Earth | 2.2 miles | 52 min |
| New York's Secret Time Machine | 1.3 miles | 29 min |
| A Billionaire's Day on $25 | 2.5 miles | 56 min |

The two reviewed test Journeys were deleted with their eight stops and one vote after explicit approval. Their two generation records were retained with cleared Journey associations. The post-deletion dry-run found no missing photos among the five remaining published Journeys; no repair searches or tracking calls were needed.
