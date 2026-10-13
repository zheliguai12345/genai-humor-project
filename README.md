# Elsewhere, NYC.

**One city. A thousand ways to live it.**

Elsewhere, NYC. turns real New York places into imaginative themed journeys. Browse and vote on published journeys, or sign in with Google to generate a private draft, preview it, and publish it. Built with Next.js 16.4, React, TypeScript, Supabase, Google Gemini, Unsplash, and Google Maps Embed.

## Environment

Configure `.env.local` privately; never commit its values. Required variable names: `GEMINI_API_KEY`, `GEMINI_MODEL`, `UNSPLASH_ACCESS_KEY`, `SUPABASE_SECRET_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Optional names: `GEMINI_FALLBACK_MODEL` and `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` (embedded maps; without it, full-route links remain available). Provider/database secrets must stay server-only.

## Run locally

```sh
npm ci
npm run dev -- --port 3001
```

Port 3001 matches the local Google callback, `/auth/callback`. Use the already-configured Supabase schema; do not reapply previously applied migrations.

## Verify

```sh
npm run lint
npx next typegen
npx tsc --noEmit --incremental false
npm run build -- --webpack
npm run start -- --port 3001
# In another terminal, with the local server running:
node --experimental-vm-modules --test tests/*.test.mjs
```

Tests mock model calls and database writes. HTTP checks make anonymous requests to the local app and require the configured Supabase project and its published editorial seeds. Normal tests do not request paid AI generations.

See the [deployment checklist](docs/deployment-checklist.md) and [manual acceptance checklist](docs/manual-acceptance.md) for OAuth, Maps key restrictions, public deployment access, and live user flows.
