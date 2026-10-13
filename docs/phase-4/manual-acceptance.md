# Phase 4 Manual Acceptance

Completed locally with the real Google-authenticated account: one /create generation, persisted model/prompts/raw output, author-only Preview, quota decrement by one, Profile journey link, card voting and detail voting, vote cancellation/change, refresh persistence, and restoration of the original test vote state. Signed-out browsing and vote guidance were checked separately. Test fixtures cover anonymous and other-author denial, failure rollback, photo timeouts, and bounded provider recovery.

Remaining live checks should be run by the user on the exact deployment URL after deployment configuration:

- Start signed out on `/?sort=new`, click a card vote, then Sign in with Google. Confirm login returns to that same URL; `/signin?next=https://example.com` must return to Discover after login. This complete flow passed locally, alongside single-popup, outside-click/Esc close, and focus restoration checks.
- Check embedded walking maps on Journey and Preview at desktop and phone widths, including the full-route link. Verify deployment key restrictions manually. Generic stops may be absent from the map; confirm mapped places, hours and safe walking access separately.
- Sign in through Google, return to Create, and refresh. Confirm the same profile and journeys remain available.
- On a separately reviewed, safe draft, click Publish once. Confirm navigation to `/?sort=new`, publication at the top of New, selected image candidate 0 at each non-null position, and public detail access in a signed-out window. Do not publish the acceptance draft `68af6953-8aba-4909-a12e-c05199098840`: its fourth move instructs standing on the platform warning edge and has not passed safety/place review.
- Vote on a card, cancel the same direction, vote again, change direction, and refresh. Check the detail page agrees. Restore any temporary test vote when finished.
- Select a personal avatar and confirm the 96×96 circular local preview, filename, and Save hint. Click Save profile only when ready to upload that photo; refresh and confirm persistence. Invalid/spoofed formats and files over 2 MB must show an immediate error. Local acceptance selected a test photo but did not save or change profile data.
- Check a 320px phone viewport: one card column, no page overflow, visible keyboard focus, 44px voting controls, collapsed Options/More, and access to all seven horizontally scrollable theme tags. The page itself must not scroll horizontally.
- During actual provider recovery, confirm the fallback stage reads `Busy right now — trying a faster model…`. Isolated tests cover this stage; the successful paid-tier verification did not need a fallback.

Publication, profile upload, deployed provider recovery, and a second-account ownership check are not claimed as completed live acceptance. Their server boundaries and error paths are covered by isolated tests.
