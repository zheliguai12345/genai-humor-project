begin;

create table public.admin_role_changes (
  id bigint generated always as identity primary key,
  target_user_id uuid not null,
  changed_by uuid not null,
  granted boolean not null,
  created_at timestamptz not null default now()
);

-- Keep audit IDs even if an account is later deleted.
alter table public.admin_role_changes enable row level security;
revoke all on public.admin_role_changes from public, anon, authenticated, service_role;
grant select on public.admin_role_changes to service_role;

create function public.set_superadmin(actor_id uuid, target_id uuid, granted boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_is_superadmin boolean;
begin
  if actor_id is null or target_id is null or granted is null then
    raise exception 'Actor, target and role are required.' using errcode = '22023';
  end if;

  -- All role changes lock the current superadmins and the two participants
  -- in the same order. Hold the locks until the role and audit row commit.
  perform id
  from public.profiles
  where is_superadmin or id in (actor_id, target_id)
  order by id
  for update;

  if not exists (select 1 from public.profiles where id = actor_id and is_superadmin) then
    raise exception 'Only a superadmin can change this role.' using errcode = '42501';
  end if;

  select is_superadmin into target_is_superadmin from public.profiles where id = target_id;
  if not found then
    raise exception 'The target account has no profile.' using errcode = 'P0002';
  end if;
  if target_is_superadmin = granted then
    return false;
  end if;

  if not granted then
    if not exists (select 1 from public.profiles where is_superadmin and id <> target_id) then
      raise exception 'At least one superadmin must remain.' using errcode = '23514';
    end if;
    if actor_id = target_id then
      raise exception 'You cannot remove your own superadmin access.' using errcode = '42501';
    end if;
  end if;

  update public.profiles set is_superadmin = granted where id = target_id;
  insert into public.admin_role_changes (target_user_id, changed_by, granted)
  values (target_id, actor_id, granted);
  return true;
end;
$$;

revoke all on function public.set_superadmin(uuid, uuid, boolean) from public, anon, authenticated, supabase_auth_admin;
grant execute on function public.set_superadmin(uuid, uuid, boolean) to service_role;

commit;
