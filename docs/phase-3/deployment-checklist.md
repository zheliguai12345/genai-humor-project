# Elsewhere, NYC. Deployment Checklist

Prepared only. No push, deployment, Vercel setting, Google setting, or database change was performed in Phase 3. Week 3–5 assignment requirements are user-provided summaries in the conversation; source implementation alone does not prove production accessibility.

## 1. Environment variable names

Set these newly required server variables on the intended Vercel Production and Preview environments. Enter the values privately; do not add them to Git, screenshots, client code, or logs.

| New variable | Purpose | Exposure |
| --- | --- | --- |
| `GEMINI_API_KEY` | Gemini generation | Server only |
| `GEMINI_MODEL` | Configured model identifier | Server runtime |
| `UNSPLASH_ACCESS_KEY` | Photo search and publication tracking | Server only |

Preserve and verify the existing configuration by name: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Public identifiers and the Supabase publishable key are intentionally used by the browser. The privileged Supabase secret and provider access keys must never use a `NEXT_PUBLIC_` prefix.

Confirm function duration settings allow the application's 60-second generation deadline. Confirm build-time font download succeeds. Do not reapply the Phase 2 migration to the sole project: it was already applied and contains the published editorial seeds. Any further migration/data changes require explicit approval.

## 2. Google authentication

This app uses Google Identity Services redirect mode, followed by a form POST to its own `/auth/callback`, and Supabase `signInWithIdToken`. Do not replace this flow with a code GET or a Supabase callback URL during deployment.

In the existing Google web OAuth client, verify exact Authorized JavaScript origins and Authorized redirect URIs for each URL you will test. Google documents the required origin and redirect registration in [Create a Google API client ID](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

| Target | Authorized JavaScript origin | Authorized redirect URI |
| --- | --- | --- |
| Local verification | `http://localhost` and `http://localhost:3001` | `http://localhost:3001/auth/callback` |
| Existing production domain | `https://genai-humor-project.vercel.app` | `https://genai-humor-project.vercel.app/auth/callback` |
| Commit-specific deployment | Exact generated HTTPS origin | That exact origin followed by `/auth/callback` |

If the actual production domain changes, register that exact domain. Do not assume wildcard preview domains will work. Keep the existing Supabase Google provider/client configuration intact. Check OAuth publishing/test-user restrictions and the consent-screen branding (Elsewhere, NYC.). The button itself is configured in English using the officially supported [locale option](https://developers.google.com/identity/gsi/web/reference/js-reference#locale).

Open a fresh signed-out window, sign in, and confirm nonce/CSRF validation, the return to Create or the selected Journey, and session survival after refresh. Never copy an ID token or session cookie into a report.

## 3. Public deployment access

In Vercel, open the project, Settings, Deployment Protection. Check Vercel Authentication, Password Protection, and any Trusted IP restrictions. For the submitted assignment URLs, choose the configuration that leaves them publicly accessible. A production domain can be public while its generated deployment URL remains protected under Standard Protection; check both. See [Deployment Protection](https://vercel.com/docs/deployment-protection) and [Vercel Authentication](https://vercel.com/docs/deployment-protection/methods-to-protect-deployments/vercel-authentication).

Verify the exact submitted URL in a new private window with no Vercel session and no bypass token. Discover, Privacy, and published Journey pages must return normal content without a Vercel login, password, or access-request screen. A sharable bypass link is not a substitute for the assignment's unprotected deployment requirement. Preserve application-level Google authentication for Create, Preview, Profile, and mutations.

## 4. Commit-specific URL

After you separately authorize push/deployment, find the deployment matching the local commit SHA in Vercel's Deployments tab and open its detail view. Copy the unique deployment URL, and verify the displayed source commit SHA matches the intended commit.

Google/Vercel configuration must use the actual copied origin, not an invented URL. The Git commit URL has the pattern `<project>-<unique-hash>-<scope>.vercel.app`; the `-git-<branch>-` URL is a moving branch alias. Vercel explains the distinction in [Generated URLs](https://vercel.com/docs/deployments/generated-urls).

Record the local commit SHA, deployment source SHA, unique URL, canonical production URL, and the signed-out accessibility result. Then run the manual acceptance checklist on that exact URL. Check public/draft isolation, saved votes, profile/avatar behavior, and a real generate-preview-publish flow only after you authorize its live database writes.

## 5. Known verification limits

- Phase 3 live quality calls save local prompts/output only; they do not prove Vercel runtime key configuration.
- Gemini can still produce incorrect current-place details, specific-price instructions, or impractical access timing. Review content before publishing.
- The prior audit's five high findings remain in the development ESLint/braces dependency chain. Production dependency audit previously returned zero. Do not use `npm audit fix --force` if it downgrades eslint-config-next.
- Frontend styling and passing local tests do not establish rubric deployment credit. The exact deployed URL must be checked by a signed-out reviewer.
