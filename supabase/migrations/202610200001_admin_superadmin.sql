-- Independent Elsewhere admin access. No RLS, grants or function changes.
begin;

alter table public.profiles
  add column is_superadmin boolean not null default false;

do $$
declare
  account_id uuid;
  matched integer;
begin
  select count(*) into matched
  from auth.users where lower(email) = 'zheliguai12345@gmail.com';
  if matched <> 1 then
    raise exception 'Expected exactly one superadmin email match; aborting.';
  end if;
  select id into account_id
  from auth.users where lower(email) = 'zheliguai12345@gmail.com';
  update public.profiles set is_superadmin = true where id = account_id;
  if not found then
    raise exception 'The selected account has no profile; aborting.';
  end if;
end
$$;

commit;
