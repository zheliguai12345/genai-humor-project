import assert from 'node:assert/strict';
import test from 'node:test';
import * as jsx from 'react/jsx-runtime';
import { moduleLoader } from './helpers/module-loader.mjs';
import { matchingCsrf, LOGIN_NONCE_COOKIE, LOGIN_RETURN_COOKIE } from '../utils/auth-validation.ts';

async function callback(nextPath) {
  const cleared = [], authCalls = [];
  const cookies = { [LOGIN_NONCE_COOKIE]: 'isolated-nonce', [LOGIN_RETURN_COOKIE]: nextPath, g_csrf_token: 'isolated-csrf' };
  const api = await moduleLoader('app/auth/callback/route.ts', {
    'next/server': { NextResponse: { redirect(url, status) {
      const response = new Response(null, { status, headers: { Location: url.toString() } });
      response.cookies = { set: (name, value, options) => cleared.push({ name, value, options }) }; return response;
    } } },
    'next/headers': { cookies: async () => ({ get: name => cookies[name] ? { value: cookies[name] } : undefined }) },
    '@/utils/auth-validation': { matchingCsrf, LOGIN_NONCE_COOKIE, LOGIN_RETURN_COOKIE },
    '@/utils/supabase/server': { createClient: async () => ({ auth: { signInWithIdToken: async options => { authCalls.push(options); return { error: null }; } } }) },
    '@/utils/supabase/profile': { getCurrentProfile: async () => ({ profile: {} }) },
  });
  const request = new Request('https://local.example/auth/callback', { method: 'POST', body: new URLSearchParams({ credential: 'isolated-token', g_csrf_token: 'isolated-csrf' }) });
  return { response: await api.POST(request), cleared, authCalls };
}
test('successful fixed callback restores the local query/fragment and clears both short-lived cookies', async () => {
  const next = '/journeys/11111111-1111-4111-8111-111111111111?from=new#vote';
  const result = await callback(next);
  assert.equal(result.response.status, 303); assert.equal(result.response.headers.get('location'), `https://local.example${next}`);
  assert.equal(result.authCalls.length, 1);
  assert.deepEqual(result.cleared.map(cookie => cookie.name), [LOGIN_NONCE_COOKIE, LOGIN_RETURN_COOKIE]);
  assert.ok(result.cleared.every(cookie => cookie.value === '' && cookie.options.maxAge === 0 && cookie.options.httpOnly && cookie.options.secure));
});
test('callback revalidates a tampered external return cookie before redirecting', async () => {
  for (const next of ['https://example.com', '//example.com', '/%2fexample.com', '/\\example.com']) {
    const result = await callback(next); assert.equal(result.response.headers.get('location'), 'https://local.example/');
  }
});
test('signin page passes only a safe next to its one central Google component; signed-in users return locally', async () => {
  const deps = { 'react/jsx-runtime': jsx, react: { Suspense: 'suspense' },
    'next/navigation': { redirect: path => { throw { redirect: path }; } },
    '@/utils/supabase/server': { getOptionalUser: async () => null },
    '@/app/components/google-sign-in': { GoogleSignIn: () => null },
  };
  const page = await moduleLoader('app/signin/page.tsx', deps);
  const result = await page.default({ searchParams: Promise.resolve({ next: 'https://example.com' }) });
  const google = result.props.children.props.children[2].props.children.props.children;
  assert.equal(google.props.nextPath, '/');
  const authenticated = await moduleLoader('app/signin/page.tsx', { ...deps, '@/utils/supabase/server': { getOptionalUser: async () => ({ id: 'isolated' }) } });
  await assert.rejects(authenticated.default({ searchParams: Promise.resolve({ next: '/?sort=new' }) }), error => error.redirect === '/?sort=new');
});
