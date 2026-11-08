-- Run as a single query after the migration. Only synthetic accounts change.
begin;
set local lock_timeout = '3s';

do $$
declare
  actor uuid := gen_random_uuid();
  target uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
begin
  if not has_function_privilege('service_role', 'public.set_superadmin(uuid,uuid,boolean)', 'execute')
    or has_function_privilege('anon', 'public.set_superadmin(uuid,uuid,boolean)', 'execute')
    or has_function_privilege('authenticated', 'public.set_superadmin(uuid,uuid,boolean)', 'execute')
    or has_function_privilege('supabase_auth_admin', 'public.set_superadmin(uuid,uuid,boolean)', 'execute')
    or has_table_privilege('service_role', 'public.admin_role_changes', 'INSERT')
  then raise exception 'Unexpected role management grants'; end if;

  insert into auth.users (id) values (actor), (target), (outsider);
  update public.profiles set is_superadmin = true where id = actor;

  begin
    perform public.set_superadmin(outsider, target, true);
    raise exception 'Non-superadmin changed a role';
  exception when insufficient_privilege then
    if sqlerrm <> 'Only a superadmin can change this role.' then raise; end if;
  end;

  if not public.set_superadmin(actor, target, true) then raise exception 'Grant was a no-op'; end if;
  if not (select is_superadmin from public.profiles where id = target)
  then raise exception 'Grant did not update the profile'; end if;

  begin
    perform public.set_superadmin(actor, actor, false);
    raise exception 'Self-removal succeeded';
  exception when insufficient_privilege then
    if sqlerrm <> 'You cannot remove your own superadmin access.' then raise; end if;
  end;

  if not public.set_superadmin(actor, target, false) then raise exception 'Removal was a no-op'; end if;
  if (select is_superadmin from public.profiles where id = target)
  then raise exception 'Removal did not update the profile'; end if;

  if public.set_superadmin(actor, target, false) then
    raise exception 'Repeated removal should be a no-op';
  end if;

  if (select array_agg(granted order by id) from public.admin_role_changes
      where changed_by = actor and target_user_id = target) is distinct from array[true, false]
    or (select count(*) from public.admin_role_changes where changed_by in (actor, outsider)) <> 2
  then raise exception 'Expected exactly one audit row per successful role change'; end if;
end;
$$;

-- Run the installed function body against isolated tables with exactly one
-- superadmin. Production superadmin flags are untouched, even transiently.
create schema test_superadmin_singleton;
create table test_superadmin_singleton.profiles (id uuid primary key, is_superadmin boolean not null);
create table test_superadmin_singleton.admin_role_changes (like public.admin_role_changes including all);
do $$
declare
  lone_admin uuid := gen_random_uuid();
begin
  execute replace(pg_get_functiondef('public.set_superadmin(uuid,uuid,boolean)'::regprocedure),
                  'public.', 'test_superadmin_singleton.');
  insert into test_superadmin_singleton.profiles values (lone_admin, true);
  begin
    perform test_superadmin_singleton.set_superadmin(lone_admin, lone_admin, false);
    raise exception 'Last superadmin was removed';
  exception when check_violation then
    if sqlerrm <> 'At least one superadmin must remain.' then raise; end if;
  end;
  if not (select is_superadmin from test_superadmin_singleton.profiles where id = lone_admin)
    or exists (select 1 from test_superadmin_singleton.admin_role_changes)
  then raise exception 'Rejected removal changed state'; end if;
end;
$$;

rollback;
select 'Superadmin grants, removals, safeguards and audit checks passed. Fixtures rolled back.' as result;
