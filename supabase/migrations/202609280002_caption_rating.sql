-- Week 4: every successful rating creates a new row.
-- No policy or RLS configuration changes. The existing ensure_rls event
-- trigger automatically protects new public tables.
begin;

create table public.captions (
  id uuid primary key default gen_random_uuid(),
  text text not null check (length(btrim(text)) > 0)
);

create table public.caption_votes (
  id uuid primary key default gen_random_uuid(),
  caption_id uuid not null references public.captions (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  vote text not null check (vote in ('up', 'down')),
  created_at timestamptz not null default now()
);

insert into public.captions (text) values
  ('My laptop has 47 tabs open. Apparently, we both have trouble letting go.'),
  ('The group project is going great. We have successfully formed a group chat.'),
  ('I asked AI to organize my life. It suggested starting with the Downloads folder.');

commit;
