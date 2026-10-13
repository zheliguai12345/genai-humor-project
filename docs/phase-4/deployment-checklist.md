# Phase 4 Deployment Checklist

Prepared for the user to perform manually. No push or deployment is part of this phase. Do not reapply the accepted Phase 2 migration.

## Runtime variables

Set or verify the following names for the intended Vercel Production and Preview environments; enter values privately.

| Name | Requirement |
| --- | --- |
| `GEMINI_API_KEY` | Server-only key for the paid Gemini project |
| `GEMINI_MODEL` | Primary model; accepted local model is `gemini-3.8-flash` |
| `GEMINI_FALLBACK_MODEL` | New optional server variable; defaults to `gemini-3.5-flash-lite` when absent |
| `UNSPLASH_ACCESS_KEY` | Server-only search/publication tracking key |
| `SUPABASE_SECRET_KEY` | Preserve existing server-only database key |
| `NEXT_PUBLIC_SUPABASE_URL` | Preserve existing project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Preserve existing public client configuration |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Preserve existing Google web OAuth client |
| `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` | New browser-visible key for directions maps on Journey and Preview; enter privately |

No provider/database secret may use a `NEXT_PUBLIC_` prefix. The same Gemini key is used for the primary and fallback models. Verify paid billing and access privately; one local success does not establish production runtime configuration or guaranteed model availability.

## Route maps

Set `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` before building each intended environment; Next.js embeds this public value into browser assets. Enable Maps Embed API in the key's Google Cloud project. Apply website/HTTP referrer restrictions for the actual local, production, and preview origins, plus an API restriction to Maps Embed API. The user performs these settings manually; this phase does not access any cloud account settings. See [Google's setup guide](https://developers.google.com/maps/documentation/embed/get-api-key).

The iframe uses `directions`, walking mode, URL-encoded place queries, and `strict-origin-when-cross-origin` so the website origin reaches Google for restriction checks. See [the official embedding guide](https://developers.google.com/maps/documentation/embed/embedding-map). Without the key, pages render only the full-route link. Recheck a published Journey and an owned Preview on the submitted deployment URL; a local map rendering does not verify production restrictions. Generic place instructions are skipped, with a few code-only editorial anchors; map rendering does not certify business existence, hours, route safety, or feasibility.

## Function duration

The Node.js generation route and Create page export `maxDuration = 120`. The shared generation deadline is 90 seconds; a primary request is capped at 60 seconds and the fallback retains its existing 12-second cap, each bounded by the shared deadline. The browser has a 100-second cancellation deadline.

Confirm the project uses Fluid Compute and that the resulting `/api/journeys` function allows at least 120 seconds. The [official duration documentation](https://vercel.com/docs/functions/configuring-functions/duration) supports App Router's named `maxDuration` export. The [current function limits](https://vercel.com/docs/functions/limitations) list a 300-second default and maximum for Hobby with Fluid Compute, and an 800-second generally available maximum for Pro/Enterprise. A streamed response still counts toward execution duration. These are published platform limits, not a fresh inspection of the user's account settings. The user owns all dashboard configuration and security prompts.

After a separately authorized deployment, inspect its build/function configuration and logs for the 120-second route setting. Verify progress events arrive without buffering, photos become placeholders after bounded timeouts, and no provider key or raw provider error is printed in logs.

## Google authentication

The app uses Google Identity Services redirect POST to its own `/auth/callback`, then Supabase `signInWithIdToken`. Keep this flow and the existing Supabase Google provider intact. Following [Google's registration guide](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), verify exact Authorized JavaScript origins and Authorized redirect URIs:

| Target | JavaScript origin | Redirect URI |
| --- | --- | --- |
| Local | `http://localhost` and `http://localhost:3001` | `http://localhost:3001/auth/callback` |
| Current production domain | `https://genai-humor-project.vercel.app` | `https://genai-humor-project.vercel.app/auth/callback` |
| Commit-specific deployment | Exact generated HTTPS origin | The same origin plus `/auth/callback` |

Register the actual new origin if it differs. Do not assume wildcard preview domains work. Check OAuth publishing/test-user restrictions, Google consent branding, and session/nonce validation on the actual submitted URL.

The local real-login check still showed the old Google app name, `The Humor Project`, on Google's account chooser. Update OAuth consent branding to `Elsewhere, NYC.` manually if desired. `/signin?next=...` is now the app's login entry; the registered callback remains `/auth/callback`. Return cookies are HttpOnly, Secure, scoped to that callback and expire after ten minutes. Verify a signed-out vote → Sign in with Google → Google login → original page round trip on the deployment URL.

## Public access and commit-specific URL

In the user's Vercel dashboard, inspect Settings → Deployment Protection for Vercel Authentication, Password Protection, and IP restrictions. Verify both the production domain and the exact submitted deployment URL in a fresh private window, without a Vercel session or bypass token. Discover, Privacy, and published Journey pages must render publicly; application authentication must still protect Create, Preview, Profile and mutations. See [Deployment Protection](https://vercel.com/docs/deployment-protection).

Find the deployment matching the final local commit SHA in Deployments, open its details, confirm its source commit, and copy the unique generated deployment URL. A branch alias moves with later deployments and is not a substitute for this commit-specific URL. See [Generated URLs](https://vercel.com/docs/deployments/generated-urls). Record the source SHA, immutable URL, production URL and signed-out accessibility result, then run manual-acceptance.md.
