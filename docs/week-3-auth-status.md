# Week 3 Auth implementation status

## Confirmed platform behavior

- Existing Supabase project: `jvlucchbkelupqgghiau`.
- Google Identity Services redirect mode POSTs the `credential` ID token to
  the configured `login_uri`. This can be the exact `/auth/callback` path.
- Supabase JS `2.117.0` saves the session and emits `SIGNED_IN` after a
  successful `signInWithIdToken`. The official SSR server client applies
  cookie storage changes on that event through `cookies.setAll`.
- The callback must validate Google's double-submit CSRF token and the
  login nonce before accepting a session. A real local Google login returned
  through this callback and established a session that survived page refresh.

## Database baseline (read-only audit, September 28, 2026)

- `public.profiles` does not exist.
- `auth.users` contains 0 users and has no application triggers.
- `storage.buckets` is empty.
- `storage.objects` already has RLS enabled and has no policies.
- The only existing policy is the SELECT policy
  `Enable read access for all users` on `public.tasks` with `qual = true`.
- All-policy fingerprint: `5b54ea973830e3bf709c3b87d36fdc4d`.
- The existing `ensure_rls` event trigger calls `public.rls_auto_enable()`.
  Its inspected definition automatically enables RLS for CREATE TABLE,
  CREATE TABLE AS, and SELECT INTO in the `public` schema.

The policy fingerprint query for the final comparison is:

```sql
select md5(coalesce(string_agg(row_to_json(p)::text, ''
  order by schemaname, tablename, policyname), ''))
from pg_policies p;
```

## Phase 1 verification

The profiles migration and rollback trigger test were executed successfully in
the existing project. PostgreSQL assertions were confirmed enabled. Inserting
a synthetic Auth user created exactly one profile with NULL names and avatar;
updating that user did not create another row. The transaction rolled back:
Auth users and profiles both remained empty, and all 5 tasks remained present.

Both name columns are nullable and the Auth INSERT trigger is enabled. The
platform's existing event trigger enabled RLS automatically on profiles. No
RLS setting or policy was edited. The all-policy fingerprint remains exactly
`5b54ea973830e3bf709c3b87d36fdc4d`.

The private `avatars` Storage bucket was created through the dashboard, with
a 2,097,152-byte limit and JPEG, PNG, and WebP MIME types. It has no policies.
The authenticated local application uploaded a 64-pixel PNG fixture successfully.
After refresh the browser loaded the private signed Storage image at its actual
64 × 64 dimensions. The profile stores only the user-scoped object path.

## Approved server access boundary

On this project, a new `public.profiles` table will have RLS enabled by the
existing platform event trigger. With no policies, authenticated users cannot
read or update profiles. Storage similarly denies uploads without an INSERT
policy. A public bucket changes download access, not upload permission.

The user explicitly approved an exception for a server-only Supabase secret key for
profile access and private avatar storage, with the user's identity checked
through a separate ordinary Auth client on every operation. The key itself
has project-wide privileges; only the application code can limit its usage.
No endpoint accepts a client-supplied user ID as authorization. The secret
client is private to a `server-only` module. Every query filters by the
validated user's ID; every avatar path begins with that ID. The existing key
is stored in ignored `.env.local` and in the existing Vercel project's
Production Secret variable. The initial 77-file scan of sources, tracked
files, public assets, and compiled browser assets found no secret value.
Final staged-file, deployment-bundle, and production log scans are pending.

## Authentication and application verification

The app uses official GIS redirect-mode form POSTs at `/auth/callback` with
Google double-submit CSRF validation and a hashed Google nonce / original
Supabase nonce. `signInWithIdToken` uses the ordinary Supabase SSR client.
Next.js 16 `proxy.ts` refreshes sessions; pages and mutations validate users
again through `getUser` before privileged access.

Profile completion, editing, private Storage avatars, logout, and the gated
`/rate` shell are implemented. Local lint, production compilation, TypeScript,
and the seven security/route tests pass. The local compiler required Webpack
with its separate build worker disabled because the restricted environment
blocked Turbopack's compiler port and stalled the Webpack worker.

Validation commands:

```sh
npm run lint
npm run build -- --webpack
node --experimental-strip-types --test tests/auth-boundaries.test.mjs
node --test tests/public-routes.test.mjs
```

The public-route tests use localhost port 3001 by default, or `AUTH_TEST_ORIGIN`.
They verify anonymous home access, redirects for protected pages, rejection
of callback requests without valid CSRF/nonce, and cross-site nonce denial.
They do not claim to verify a successful Google authentication.

Supabase Site URL is now `https://genai-humor-project.vercel.app`. Its redirect
allowlist contains that origin plus localhost ports 3000 and 3001, each with
the exact `/auth/callback` path and no query parameters or wildcards. The
final commit-specific deployment URL will be added when it exists.

The Google Web client was created in the existing Google Cloud project,
with the owner's consent. Supabase Google is enabled with the client ID only;
no Google client secret is used and nonce checking remains enabled. Exact
application origins and `/auth/callback` redirects are registered for production
and localhost ports 3000/3001. The application requests only basic Google
sign-in information (`openid`, `email`, `profile`). A public `/privacy` page
explains this application's data handling and is linked in Google Branding.
Google Audience will be published after that page is deployed.

A real local Google sign-in created one Auth user and one matching profile
through the trigger. The initial profile prompted for both names; saving them
and refreshing preserved the names and session. Editing both names also persisted
after refresh, and the original names were restored after the test. The
authenticated `/rate` shell loaded successfully. Database inspection confirmed
one matching profile, two nullable name columns, the original five tasks, and
the unchanged RLS policy fingerprint. Avatar upload/display and logout were
tested locally; requesting `/rate` after logout returned to the public sign-in
page. Push, production verification, and the final exact-commit URL remain pending.

## Official sources

- https://developers.google.com/identity/gsi/web/reference/html-reference
- https://developers.google.com/identity/gsi/web/guides/display-button
- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://github.com/supabase/ssr/blob/main/src/createServerClient.ts
- https://supabase.com/docs/guides/storage/security/access-control
