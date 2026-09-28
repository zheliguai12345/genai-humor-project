-- Week 3: profile rows are created by the database when Auth creates a user.
-- Do not add policies or alter any RLS configuration in this migration.
-- The project's existing ensure_rls event trigger automatically protects
-- new public tables. With no policies, ordinary users cannot read/write them.

begin;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  first_name text,
  last_name text,
  avatar_path text,
  created_at timestamptz not null default now()
);

create function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

-- This function is only called by the Auth trigger, not by app clients.
revoke all on function public.handle_new_user_profile()
  from public, anon, authenticated;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

commit;
