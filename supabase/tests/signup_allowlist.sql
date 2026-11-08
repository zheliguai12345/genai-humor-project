-- Run as a single query after the signup allowlist migration.
-- All fixture writes, including the empty-list setup, are rolled back.
begin;
set local lock_timeout = '2s';

delete from public.allowed_signup_domains;
delete from public.whitelisted_emails;

do $$
begin
  if public.hook_enforce_signup_allowlist('{"user":{"email":"person@campus.example"}}')
    is distinct from '{"error":{"http_code":403,"message":"This email is not allowed to sign up for Elsewhere."}}'::jsonb
  then raise exception 'Empty allowlists must block signup'; end if;
end $$;

insert into public.allowed_signup_domains (domain) values ('campus.example');
insert into public.whitelisted_emails (email) values ('guest@outside.example');

do $$
declare
  fixture record;
  expected jsonb;
  actual jsonb;
begin
  for fixture in
    select * from (values
      ('person@campus.example', true),
      ('guest@outside.example', true),
      ('stranger@outside.example', false),
      ('Person@Campus.Example', true),
      ('Guest@OUTSIDE.Example', true),
      ('person@sub.campus.example', false),
      ('person@campus.example@outside.example', false),
      (null, false)
    ) as cases(email, allowed)
  loop
    expected := case when fixture.allowed then '{}'::jsonb
      else '{"error":{"http_code":403,"message":"This email is not allowed to sign up for Elsewhere."}}'::jsonb end;
    actual := public.hook_enforce_signup_allowlist(
      jsonb_build_object('user', jsonb_build_object('email', fixture.email))
    );
    if actual is distinct from expected then
      raise exception 'Unexpected signup hook response for %: %', fixture.email, actual;
    end if;
  end loop;

  if not has_function_privilege('service_role', 'public.is_signup_allowed(text)', 'execute')
    or not has_function_privilege('supabase_auth_admin', 'public.is_signup_allowed(text)', 'execute')
    or not has_function_privilege('supabase_auth_admin', 'public.hook_enforce_signup_allowlist(jsonb)', 'execute')
    or has_function_privilege('authenticated', 'public.is_signup_allowed(text)', 'execute')
    or has_function_privilege('anon', 'public.hook_enforce_signup_allowlist(jsonb)', 'execute')
  then raise exception 'Unexpected signup function grants'; end if;
end $$;

rollback;
select 'Signup allowlist: 9 hook cases and grants passed. All fixtures rolled back.' as result;
