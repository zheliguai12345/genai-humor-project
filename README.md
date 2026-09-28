This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Week 4: caption rating

`/rate` retains the Week 3 Google sign-in and profile completion gate. Captions
come from Supabase. Each successful upvote/downvote inserts a new `caption_votes`
row; repeat votes are separate submissions. No vote history UI is implemented.

The schema and three sample captions are in
`supabase/migrations/202609280002_caption_rating.sql` (already applied to the
existing project). It contains no policy or RLS configuration changes. The
project's existing event trigger automatically enables RLS on new public tables.
The server-only rating module verifies `auth.getUser()` before privileged access
and derives the inserted `user_id` exclusively from that authenticated user.

Keep `SUPABASE_SECRET_KEY` server-only and out of Git. The Week 3 environment
variables are sufficient; no new secrets are needed.

Verification:

```bash
npm run lint
npm run build
# If local Turbopack cannot bind its worker port:
npm run build -- --webpack
node --test tests/auth-boundaries.test.mjs
node --experimental-vm-modules --test tests/rating-boundaries.test.mjs
npm run start -- --port 3001
# In a second terminal:
AUTH_TEST_ORIGIN=http://localhost:3001 node --test tests/public-routes.test.mjs tests/rating-http.test.mjs
```

Negative-path unit tests isolate Auth/database dependencies without extracting
session credentials. Browser acceptance uses real Google login and database
votes, with persistence and associations independently checked in Supabase.
For deployed HTTP tests, supply `RATE_TEST_ACTION_ID` from that deployment's
client bundle, since action IDs can differ between builds.
