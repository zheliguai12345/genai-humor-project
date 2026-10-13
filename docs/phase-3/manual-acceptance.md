# Phase 3 Manual Acceptance

Run against `http://localhost:3001` after `npm run build -- --webpack` and `npm run start -- --port 3001`. Repeat on the approved deployment URL later. These checks require your real Google session. Generation, publication, voting, and profile saves write live account/project data: the agent did not perform these Phase 3 mutations.

## Sign-in and access

- Open a private browser window. Discover, Privacy, and a published editorial Journey must load without sign-in.
- Choose Create while signed out. Expect Discover's sign-in guidance, not a private form.
- Sign in using the existing Google button. When entered from Create, return to Create. No profile name completion is required to generate or vote.
- Visit Profile. Verify your existing names and avatar are present. Saving or uploading is optional and changes your live profile.
- Visit `/rate`. Expect a redirect to Discover.
- Using a second account, open the first account's preview URL. Expect 404. An author draft's public `/journeys/[id]` URL must also return 404.

## Create and private generation

- Select each of the seven theme cards. Confirm the complete theme sentence fills Wild idea and remains editable. Use Tab, Enter, and Space as well as pointer input.
- Choose time, budget, and several interests. Confirm the character count allows at most 200 Unicode characters.
- Check remaining generation attempts and the precise reset date/time in New York time. A validation retry consumes an additional attempt.
- Click Generate once. Buttons and fields lock; phased messages appear while waiting. Repeated clicks must not create concurrent submissions.
- On success, land on `/preview/[id]`. Confirm the new Journey is a private draft in Your journeys and absent from Discover.
- When the allowance is exhausted, verify `0` remaining, a clear reset time, and a disabled Generate button. Do not spend ten live calls merely to test this: the quota boundary is already covered by isolated tests.

## Preview and publish

- Read the complete route and follow each Open in Maps link. Independently check addresses, access conditions, current opening availability, travel order, and budget assumptions before publishing.
- Change a cover candidate and a stop candidate. Confirm selected borders, Selected labels, and photographer credit change. Every position accepts only a stored candidate index; null-photo positions show a placeholder.
- Check mobile at 320 px and 375 px; no horizontal scrolling, cut-off controls, or hidden Publish button.
- Click Publish once. Expect the public Journey page. Reload it in a signed-out window; it must now be readable.
- The chosen photographs must remain selected after reload. API search is not repeated while browsing. Unsplash tracking failures do not undo publication.
- Verify Your journeys labels the Journey Published and links to its public page. Generate another opens Create without replacing or deleting this Journey.

## Voting and discovery

- While signed out, click I'd do this or Not my vibe. Expect sign-in guidance and no saved vote.
- While signed in, vote I'd do this, reload, then change to Not my vibe and reload. The selected state must persist; changing votes updates one row rather than adding a second vote.
- Verify the appropriate totals on the detail page and Discover. Community favorites sorts published Journeys by I'd do this votes, including editorial Journeys readers voted for. New from the community contains published non-editorial Journeys only.
- Try sending a vote for a private draft. Expect rejection and no saved vote. Automated boundary tests already cover this without live mutation.

## Accessibility and visual checks

- Tab through navigation, theme cards, fields, map links, image choices, and action buttons. Focus rings must remain visible.
- Read body text at 200% zoom. Time, addresses, and places remain in ordinary sans-serif type. Italic hooks occupy one truncated line in Discover; detail hooks display fully in regular type.
- Buttons have at least a 44 px touch target. Text color pairs meet 4.5:1 contrast. Check reduced-motion preferences: transitions and smooth scrolling are disabled.
- Verify photographer and Unsplash links include `utm_source=elsewhere_nyc&utm_medium=referral`.

Record failures with the URL, account role (author/other/anonymous), selected option, and visible result. Do not include session cookies, tokens, or keys.
