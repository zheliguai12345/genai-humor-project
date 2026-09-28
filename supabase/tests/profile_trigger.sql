-- Run after the profiles migration. This is a database trigger test,
-- not a substitute for testing a real Google login.
-- The transaction rolls back the synthetic user and its profile.

begin;

do $$
declare
  test_user_id uuid := gen_random_uuid();
begin
  assert (
    select count(*) = 2
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name in ('first_name', 'last_name')
      and is_nullable = 'YES'
  ), 'Both name columns must be nullable';

  insert into auth.users (id) values (test_user_id);

  assert (
    select count(*) = 1
    from public.profiles
    where id = test_user_id
      and first_name is null
      and last_name is null
      and avatar_path is null
  ), 'Auth INSERT must automatically create exactly one incomplete profile';

  update auth.users
  set raw_user_meta_data = '{}'::jsonb
  where id = test_user_id;

  assert (
    select count(*) = 1
    from public.profiles
    where id = test_user_id
  ), 'Auth UPDATE must not create a second profile';

  raise notice 'profile_trigger_test_passed';
end;
$$;

rollback;
