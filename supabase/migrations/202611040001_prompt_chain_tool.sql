begin;

create table public.prompt_chain_runs (
  id uuid primary key default gen_random_uuid(),
  chain_id uuid not null references public.prompt_chains(id) on delete cascade,
  input_text text not null,
  input_image_path text unique,
  status text not null check (status in ('running', 'success', 'error')),
  final_output text,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prompt_chain_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.prompt_chain_runs(id) on delete cascade,
  step_id uuid references public.prompt_chain_steps(id) on delete set null,
  step_order integer not null check (step_order > 0),
  purpose text not null,
  model_name text not null,
  rendered_system_prompt text not null,
  rendered_user_prompt text not null,
  output text,
  status text not null check (status in ('success', 'error', 'timeout')),
  error_message text,
  is_fallback boolean not null default false,
  duration_ms integer not null check (duration_ms >= 0),
  unknown_variables text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (run_id, step_order)
);

create index prompt_chain_runs_history on public.prompt_chain_runs (chain_id, created_at desc, id desc);
create index prompt_chain_run_steps_step on public.prompt_chain_run_steps (step_id);

alter table public.prompt_chain_runs enable row level security;
alter table public.prompt_chain_run_steps enable row level security;
revoke all on public.prompt_chain_runs, public.prompt_chain_run_steps from public, anon, authenticated;
grant all on public.prompt_chain_runs, public.prompt_chain_run_steps to service_role;
create trigger touch_updated_at before update on public.prompt_chain_runs
  for each row execute function public.week7_touch_updated_at();
create trigger touch_updated_at before update on public.prompt_chain_run_steps
  for each row execute function public.week7_touch_updated_at();

-- All ordering RPCs lock the parent first so moves, appends and deletes serialize.
create function public.move_prompt_chain_step(p_step_id uuid, p_direction text)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  target_chain uuid;
  current_order integer;
  adjacent_step uuid;
  adjacent_order integer;
  temporary_order integer;
begin
  if p_direction is null or p_direction not in ('up', 'down') then
    raise exception 'Direction must be up or down.' using errcode = '22023';
  end if;
  select chain_id into target_chain from public.prompt_chain_steps where id = p_step_id;
  perform 1 from public.prompt_chains where id = target_chain for update;
  perform 1 from public.prompt_chain_steps where chain_id = target_chain order by step_order for update;
  select step_order into current_order from public.prompt_chain_steps where id = p_step_id;
  adjacent_order := current_order + case when p_direction = 'up' then -1 else 1 end;
  select id into adjacent_step from public.prompt_chain_steps
    where chain_id = target_chain and step_order = adjacent_order;
  if adjacent_step is null then return; end if;
  select max(step_order) + 1 into temporary_order from public.prompt_chain_steps where chain_id = target_chain;
  update public.prompt_chain_steps set step_order = temporary_order where id = p_step_id;
  update public.prompt_chain_steps set step_order = current_order where id = adjacent_step;
  update public.prompt_chain_steps set step_order = adjacent_order where id = p_step_id;
end $$;

create function public.delete_prompt_chain_step(p_step_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  target_chain uuid;
  removed_order integer;
  following record;
begin
  select chain_id into target_chain from public.prompt_chain_steps where id = p_step_id;
  perform 1 from public.prompt_chains where id = target_chain for update;
  perform 1 from public.prompt_chain_steps where chain_id = target_chain order by step_order for update;
  delete from public.prompt_chain_steps where id = p_step_id returning step_order into removed_order;
  for following in
    select id, step_order from public.prompt_chain_steps
      where chain_id = target_chain and step_order > removed_order order by step_order
  loop
    update public.prompt_chain_steps set step_order = following.step_order - 1 where id = following.id;
  end loop;
end $$;

create function public.append_prompt_chain_step(
  p_chain_id uuid, p_model_id uuid, p_purpose text, p_system_prompt text,
  p_user_prompt_template text, p_temperature numeric
)
returns void language plpgsql security invoker set search_path = '' as $$
declare next_order integer;
begin
  perform 1 from public.prompt_chains where id = p_chain_id for update;
  select coalesce(max(step_order), 0) + 1 into next_order
    from public.prompt_chain_steps where chain_id = p_chain_id;
  insert into public.prompt_chain_steps
    (chain_id, step_order, model_id, purpose, system_prompt, user_prompt_template, temperature)
  values (p_chain_id, next_order, p_model_id, p_purpose, p_system_prompt, p_user_prompt_template, p_temperature);
end $$;

create function public.protect_journey_prompt_chain()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'The Elsewhere journey generation chain is protected because the configuration snapshot references it.'
    using errcode = '23514';
end $$;

create trigger protect_journey_prompt_chain before delete on public.prompt_chains
  for each row when (old.id = '70000000-0000-4000-8000-000000000004')
  execute function public.protect_journey_prompt_chain();

-- Lock the chain while confirming its name and collecting image paths for Storage cleanup.
create function public.delete_prompt_chain(p_chain_id uuid, p_name text)
returns text[] language plpgsql security invoker set search_path = '' as $$
declare
  actual_name text;
  image_paths text[];
begin
  select name into actual_name from public.prompt_chains where id = p_chain_id for update;
  if actual_name is null or actual_name is distinct from p_name then
    raise exception 'Type the exact current chain name to confirm deletion.' using errcode = '22023';
  end if;
  if exists (select 1 from public.prompt_chain_runs where chain_id = p_chain_id
    and status = 'running' and started_at > now() - interval '10 minutes') then
    raise exception 'Wait for the active run to finish before deleting this chain.' using errcode = '55000';
  end if;
  select coalesce(array_agg(input_image_path) filter (where input_image_path is not null), '{}')
    into image_paths from public.prompt_chain_runs where chain_id = p_chain_id;
  delete from public.prompt_chains where id = p_chain_id;
  return image_paths;
end $$;

revoke all on function public.delete_prompt_chain(uuid, text) from public, anon, authenticated;
grant execute on function public.delete_prompt_chain(uuid, text) to service_role;

revoke all on function public.move_prompt_chain_step(uuid, text), public.delete_prompt_chain_step(uuid),
  public.append_prompt_chain_step(uuid, uuid, text, text, text, numeric), public.protect_journey_prompt_chain()
  from public, anon, authenticated;
grant execute on function public.move_prompt_chain_step(uuid, text), public.delete_prompt_chain_step(uuid),
  public.append_prompt_chain_step(uuid, uuid, text, text, text, numeric) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chain-inputs', 'chain-inputs', false, 5242880, array['image/png', 'image/jpeg', 'image/webp']);

insert into public.prompt_chains (id, name, description)
values ('71000000-0000-4000-8000-000000000001', 'Image to Captions',
  'Describe an image, identify comic angles, and write five captions.');

insert into public.prompt_chain_steps
  (chain_id, step_order, model_id, purpose, system_prompt, user_prompt_template, temperature)
select '71000000-0000-4000-8000-000000000001', seed.step_order, (select id from public.llm_models where role = 'primary'),
  seed.purpose, seed.system_prompt, seed.user_prompt, null
from (values
  (1, 'Describe the image',
    'Describe visible subjects, actions, setting, and unusual details in two or three objective sentences. Avoid invented context.',
    E'Describe the attached image. Optional context:\n{{input}}'),
  (2, 'Find what''s funny',
    'Identify three distinct comic angles grounded in the description. Name the specific detail and the expectation it breaks.',
    E'Find comic angles in this description:\n{{previous_output}}'),
  (3, 'Write five captions',
    'Write five distinct, short captions grounded in the comic angles. Output one caption per line, with no numbering or commentary.',
    E'Write captions using these comic angles:\n{{previous_output}}')
) as seed(step_order, purpose, system_prompt, user_prompt);

commit;
