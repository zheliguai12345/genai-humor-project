begin;

-- These columns are constrained to lowercase by the table definitions.
create function public.is_signup_allowed(email text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    $1 ~ '^[^[:space:]@]+@[^[:space:]@]+$'
    and (
      exists (
        select 1 from public.allowed_signup_domains d
        where d.domain = split_part(lower($1), '@', 2)
      )
      or exists (
        select 1 from public.whitelisted_emails e
        where e.email = lower($1)
      )
    ),
    false
  );
$$;

create function public.hook_enforce_signup_allowlist(event jsonb)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select case when public.is_signup_allowed(event -> 'user' ->> 'email')
    then '{}'::jsonb
    else '{"error":{"http_code":403,"message":"This email is not allowed to sign up for Elsewhere."}}'::jsonb
  end;
$$;

revoke execute on function public.is_signup_allowed(text) from public, anon, authenticated;
grant execute on function public.is_signup_allowed(text) to service_role, supabase_auth_admin;

revoke execute on function public.hook_enforce_signup_allowlist(jsonb) from public, anon, authenticated, service_role;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_enforce_signup_allowlist(jsonb) to supabase_auth_admin;
grant select on public.allowed_signup_domains, public.whitelisted_emails to supabase_auth_admin;

create policy "Auth hook can read signup domains"
  on public.allowed_signup_domains for select to supabase_auth_admin using (true);
create policy "Auth hook can read whitelisted emails"
  on public.whitelisted_emails for select to supabase_auth_admin using (true);

commit;
