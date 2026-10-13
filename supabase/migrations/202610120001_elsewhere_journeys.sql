-- Elsewhere, NYC. Phase 2. Review and approve before applying to production.
-- No policies are added. All application operations use server-only service access.
-- tasks is intentionally not modified.
begin;

create table public.journeys (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references auth.users(id) on delete cascade,
  is_editorial boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  title text not null, kicker text not null, hook text not null, premise text not null,
  when_label text not null, budget_label text not null, area text not null,
  mode text not null, ending text not null, cover_image jsonb,
  generation_run_id uuid unique,
  created_at timestamptz not null default now(),
  check (author_id is not null or is_editorial),
  check ((status = 'draft' and published_at is null) or
         (status = 'published' and published_at is not null))
);
create table public.journey_stops (
  journey_id uuid not null references public.journeys(id) on delete cascade,
  position integer not null check (position between 1 and 5),
  time_label text not null, title text not null, place text not null,
  body text not null, move text not null, image jsonb,
  primary key (journey_id, position)
);
create table public.generation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  input jsonb not null, system_prompt text not null, user_prompt text not null,
  model text not null, raw_output text,
  status text not null check (status in ('success', 'failed')),
  error text,
  journey_id uuid references public.journeys(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.journeys add foreign key (generation_run_id)
  references public.generation_runs(id) on delete set null;
create table public.journey_votes (
  journey_id uuid not null references public.journeys(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value text not null check (value in ('up', 'down')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (journey_id, user_id)
);
create index journeys_published_feed on public.journeys (published_at desc, id) where status = 'published';
create index journeys_author on public.journeys (author_id, created_at desc);
create index generation_runs_user_day on public.generation_runs (user_id, created_at);

alter table public.journeys enable row level security;
alter table public.journey_stops enable row level security;
alter table public.generation_runs enable row level security;
alter table public.journey_votes enable row level security;
alter table public.profiles enable row level security;
alter table public.captions enable row level security;
alter table public.caption_votes enable row level security;
revoke all on public.journeys, public.journey_stops, public.generation_runs, public.journey_votes from anon, authenticated;
grant all on public.journeys, public.journey_stops, public.generation_runs, public.journey_votes to service_role;

-- Reserve a durable audit row BEFORE a paid call. Retries count as new attempts.
-- A UTC calendar day and advisory transaction lock make the quota race-safe.
create function public.reserve_journey_generation(p_user_id uuid, p_input jsonb,
  p_system_prompt text, p_user_prompt text, p_model text) returns uuid
language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if (select count(*) from public.generation_runs where user_id = p_user_id
      and created_at >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC') >= 10 then
    raise exception 'daily_generation_limit' using errcode = 'P0001';
  end if;
  insert into public.generation_runs(user_id,input,system_prompt,user_prompt,model,status,error)
  values(p_user_id,p_input,p_system_prompt,p_user_prompt,p_model,'failed','Generation interrupted before completion.')
  returning id into v_id;
  return v_id;
end;
$$;

-- Save the draft, stops, and success association together, or roll all of them back.
create function public.save_generated_journey(p_user_id uuid, p_run_id uuid, p_journey jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare v_id uuid;
begin
  perform 1 from public.generation_runs where id=p_run_id and user_id=p_user_id
    and status='failed' and journey_id is null for update;
  if not found then raise exception 'invalid_generation_run'; end if;
  if jsonb_array_length(p_journey->'stops') not between 3 and 5 then raise exception 'invalid_stops'; end if;
  insert into public.journeys(author_id,generation_run_id,title,kicker,hook,premise,when_label,budget_label,area,mode,ending,cover_image)
  values(p_user_id,p_run_id,p_journey->>'title',p_journey->>'kicker',p_journey->>'hook',p_journey->>'premise',
    p_journey->>'when_label',p_journey->>'budget_label',p_journey->>'area',p_journey->>'mode',p_journey->>'ending',p_journey->'cover_image')
  returning id into v_id;
  insert into public.journey_stops(journey_id,position,time_label,title,place,body,move,image)
  select v_id, ordinality::integer, stop->>'time_label',stop->>'title',stop->>'place',stop->>'body',stop->>'move',stop->'image'
  from jsonb_array_elements(p_journey->'stops') with ordinality as x(stop,ordinality);
  update public.generation_runs set status='success',error=null,journey_id=v_id where id=p_run_id and user_id=p_user_id;
  return v_id;
end;
$$;

-- Publish from stored candidates only. Any invalid selection rolls back all changes.
create function public.publish_journey(p_user_id uuid,p_journey_id uuid,p_selection jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_journey public.journeys; v_selection jsonb; v_position integer; v_index integer;
  v_image jsonb; v_candidate jsonb; v_images jsonb := '[]'::jsonb;
  v_seen integer[] := '{}'; v_expected integer;
begin
  select * into v_journey from public.journeys
    where id=p_journey_id and author_id=p_user_id and status='draft' for update;
  if not found then raise exception 'draft_not_found'; end if;
  select 1+count(*) into v_expected from public.journey_stops where journey_id=p_journey_id;
  if jsonb_typeof(p_selection) is distinct from 'array' then raise exception 'invalid_image_selection'; end if;
  if jsonb_array_length(p_selection) <> v_expected then raise exception 'invalid_image_selection'; end if;
  for v_selection in select value from jsonb_array_elements(p_selection) loop
    if jsonb_typeof(v_selection) is distinct from 'object'
       or not (v_selection ? 'position' and v_selection ? 'candidate_index')
       or (v_selection - 'position' - 'candidate_index') <> '{}'::jsonb
       or jsonb_typeof(v_selection->'position') is distinct from 'number'
       or (v_selection->>'position') !~ '^[0-5]$' then
      raise exception 'invalid_image_selection';
    end if;
    v_position := (v_selection->>'position')::integer;
    if v_position = any(v_seen) then raise exception 'duplicate_image_position'; end if;
    v_seen := array_append(v_seen,v_position);
    if v_position=0 then
      v_image := v_journey.cover_image;
    else
      select image into v_image from public.journey_stops
        where journey_id=p_journey_id and position=v_position for update;
      if not found then raise exception 'invalid_stop_position'; end if;
    end if;
    if v_image is null or v_image='null'::jsonb then
      if v_selection->'candidate_index' <> 'null'::jsonb then raise exception 'image_not_available'; end if;
      v_candidate := 'null'::jsonb;
    else
      if jsonb_typeof(v_selection->'candidate_index') is distinct from 'number'
         or (v_selection->>'candidate_index') !~ '^[0-9]+$'
         or jsonb_typeof(v_image->'candidates') is distinct from 'array' then
        raise exception 'invalid_candidate_index';
      end if;
      v_index := (v_selection->>'candidate_index')::integer;
      if v_index >= jsonb_array_length(v_image->'candidates') then raise exception 'invalid_candidate_index'; end if;
      v_candidate := v_image->'candidates'->v_index;
      if jsonb_typeof(v_candidate) is distinct from 'object' then raise exception 'invalid_candidate'; end if;
      v_candidate := v_candidate || jsonb_build_object('candidates',v_image->'candidates');
    end if;
    if v_position=0 then
      update public.journeys set cover_image=v_candidate where id=p_journey_id;
    else
      update public.journey_stops set image=v_candidate where journey_id=p_journey_id and position=v_position;
    end if;
    v_images := v_images || jsonb_build_array(jsonb_build_object('position',v_position,'image',v_candidate));
  end loop;
  -- Count, valid positions, and uniqueness ensure every stop and the cover are present.
  if not (0=any(v_seen)) then raise exception 'missing_cover_position'; end if;
  update public.journeys set status='published',published_at=now() where id=p_journey_id;
  return v_images;
end;
$$;

create function public.vote_on_journey(p_user_id uuid,p_journey_id uuid,p_value text)
returns void language plpgsql set search_path = '' as $$
begin
  -- Lock the target through the vote insert to avoid a status-change race.
  perform 1 from public.journeys where id=p_journey_id and status='published' for share;
  if not found then raise exception 'published_journey_not_found'; end if;
  insert into public.journey_votes(journey_id,user_id,value) values(p_journey_id,p_user_id,p_value)
    on conflict(journey_id,user_id) do update set value=excluded.value,updated_at=now();
end;
$$;

revoke all on function public.reserve_journey_generation(uuid,jsonb,text,text,text),
  public.save_generated_journey(uuid,uuid,jsonb),public.publish_journey(uuid,uuid,jsonb),
  public.vote_on_journey(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_journey_generation(uuid,jsonb,text,text,text),
  public.save_generated_journey(uuid,uuid,jsonb),public.publish_journey(uuid,uuid,jsonb),
  public.vote_on_journey(uuid,uuid,text) to service_role;

-- The seed copy and photographs are taken verbatim from docs/design/elsewhere-samples.html.
-- Sample photo-... identifiers are CDN IDs, not API photo IDs; download_location stays null.
insert into public.journeys (id, is_editorial, status, published_at, title, kicker, hook, premise, when_label, budget_label, area, mode, ending, cover_image)
select 'e15e0000-0000-4000-8000-000000000001', true, 'published', now(), title, kicker, hook, premise, when_label, budget_label, area, mode, ending, cover_image
from jsonb_to_record('{"title":"The Museum That Doesn''t Exist","kicker":"Art and attention","hook":"Nothing you''ll see today was made to be art. That''s what makes it the collection.","premise":"Somewhere between SoHo and Chinatown hangs a collection no curator ever chose: façades, rooftops, shop windows, a crooked street, a crowd. Today you walk it like a gallery.","when_label":"Saturday · 1–4 PM","budget_label":"Under $20","area":"SoHo → Chinatown","mode":"Walking · 5 stops","ending":"The exhibition closes when you stop looking. Tomorrow, the same streets will be just streets.","cover_image":{"url":"https://images.unsplash.com/photo-1739382120673-54ec4d63dc62?auto=format&fit=crop&w=1200&q=80","photographer_name":"Lerone Pieters","photographer_username":"leronep","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1739382120673-54ec4d63dc62?auto=format&fit=crop&w=1200&q=80","photographer_name":"Lerone Pieters","photographer_username":"leronep","download_location":null}]}}'::jsonb) as x(title text,kicker text,hook text,premise text,when_label text,budget_label text,area text,mode text,ending text,cover_image jsonb);
insert into public.journey_stops (journey_id, position, time_label, title, place, body, move, image)
select 'e15e0000-0000-4000-8000-000000000001', position, time_label, title, place, body, move, image
from jsonb_to_recordset('[{"position":1,"time_label":"1:00 PM","title":"Gallery I — The Forgeries","place":"Greene Street, between Canal & Grand St","body":"These grand stone façades are lying. They''re cast iron, poured in molds and painted to impersonate stone.","move":"Bring a fridge magnet. Touch a column. If it sticks, you''ve caught a forgery.","image":{"url":"https://images.unsplash.com/photo-1765728614264-6bc32ec6f8ce?auto=format&fit=crop&w=1200&q=80","photographer_name":"Allen Boguslavsky","photographer_username":"allenboguslavsky","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1765728614264-6bc32ec6f8ce?auto=format&fit=crop&w=1200&q=80","photographer_name":"Allen Boguslavsky","photographer_username":"allenboguslavsky","download_location":null}]}},{"position":2,"time_label":"1:40 PM","title":"Gallery II — The Hat Collection","place":"Look up, anywhere north of Canal St","body":"Wooden water tanks perch on the roofs like hats nobody took off. No two sit at quite the same angle.","move":"Stand on one corner and count every tank you can see. Pick a favorite.","image":{"url":"https://images.unsplash.com/photo-1564941547248-f347cc760189?auto=format&fit=crop&w=1200&q=80","photographer_name":"Megan Bucknall","photographer_username":"meganmarkham","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1564941547248-f347cc760189?auto=format&fit=crop&w=1200&q=80","photographer_name":"Megan Bucknall","photographer_username":"meganmarkham","download_location":null}]}},{"position":3,"time_label":"2:10 PM","title":"Gallery III — Still Life with Merchandise","place":"Canal Street, heading east","body":"Every window here was arranged by someone who never thought of it as composition. Some of them are masterpieces anyway.","move":"Choose the one window you''d hang in a museum. Give it a title.","image":{"url":"https://images.unsplash.com/photo-1599394271366-56f8835da2eb?auto=format&fit=crop&w=1200&q=80","photographer_name":"Magnus Andersson","photographer_username":"majolixious","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1599394271366-56f8835da2eb?auto=format&fit=crop&w=1200&q=80","photographer_name":"Magnus Andersson","photographer_username":"majolixious","download_location":null}]}},{"position":4,"time_label":"2:50 PM","title":"Gallery IV — The Street That Refused the Grid","place":"Doyers Street, Chinatown · café stop: Nom Wah Tea Parlor, 13 Doyers St","body":"Manhattan is a grid. This street bends anyway. Halfway along, the museum café has been serving dumplings since 1920.","move":"Walk the whole curve without checking your phone. Then sit down and order.","image":{"url":"https://images.unsplash.com/photo-1599394270952-e6127be8743b?auto=format&fit=crop&w=1200&q=80","photographer_name":"Magnus Andersson","photographer_username":"majolixious","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1599394270952-e6127be8743b?auto=format&fit=crop&w=1200&q=80","photographer_name":"Magnus Andersson","photographer_username":"majolixious","download_location":null}]}},{"position":5,"time_label":"3:40 PM","title":"Gallery V — The Performance","place":"Columbus Park, Mulberry & Bayard St","body":"The final piece runs every afternoon with no curator: card games, chess boards, arguments, laughter.","move":"Find a bench. Watch until you forget you''re watching.","image":{"url":"https://images.unsplash.com/photo-1752250135835-0b3640b7c559?auto=format&fit=crop&w=1200&q=80","photographer_name":"Oleksandra Kyrleiza","photographer_username":"ssh_krl","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1752250135835-0b3640b7c559?auto=format&fit=crop&w=1200&q=80","photographer_name":"Oleksandra Kyrleiza","photographer_username":"ssh_krl","download_location":null}]}}]'::jsonb) as x(position integer,time_label text,title text,place text,body text,move text,image jsonb);

insert into public.journeys (id, is_editorial, status, published_at, title, kicker, hook, premise, when_label, budget_label, area, mode, ending, cover_image)
select 'e15e0000-0000-4000-8000-000000000002', true, 'published', now(), title, kicker, hook, premise, when_label, budget_label, area, mode, ending, cover_image
from jsonb_to_record('{"title":"The Last Day on Earth","kicker":"A hypothetical","hook":"If the world ended at midnight, how would you spend your last six hours in New York?","premise":"The sky closes at midnight. You have six hours, one city, and no reason left to be careful.","when_label":"Saturday · 6 PM – midnight","budget_label":"About $30","area":"East Village → Lower East Side","mode":"Walking · 4 stops","ending":"Midnight comes. Nothing ends. You walk home carrying a record, a postmark, and a city you finally looked at.","cover_image":{"url":"https://images.unsplash.com/photo-1768270946541-c3e1cfdf80f9?auto=format&fit=crop&w=1200&q=80","photographer_name":"Aho","photographer_username":"ahoroom","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1768270946541-c3e1cfdf80f9?auto=format&fit=crop&w=1200&q=80","photographer_name":"Aho","photographer_username":"ahoroom","download_location":null}]}}'::jsonb) as x(title text,kicker text,hook text,premise text,when_label text,budget_label text,area text,mode text,ending text,cover_image jsonb);
insert into public.journey_stops (journey_id, position, time_label, title, place, body, move, image)
select 'e15e0000-0000-4000-8000-000000000002', position, time_label, title, place, body, move, image
from jsonb_to_recordset('[{"position":1,"time_label":"6:00 PM","title":"The Last Song","place":"A-1 Record Shop, 439 E 6th St","body":"Someone, someday, will find whatever survives. Dig through the crates until one record feels like the right thing to leave behind.","move":"Choose one record for the end of the world. Don''t overthink it. There''s no time.","image":{"url":"https://images.unsplash.com/photo-1582751836565-74f64cc184cb?auto=format&fit=crop&w=1200&q=80","photographer_name":"Mick Haupt","photographer_username":"rocinante_11","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1582751836565-74f64cc184cb?auto=format&fit=crop&w=1200&q=80","photographer_name":"Mick Haupt","photographer_username":"rocinante_11","download_location":null}]}},{"position":2,"time_label":"7:00 PM","title":"The Last Letter","place":"Any blue mailbox on your way south","body":"Buy a postcard from the nearest bodega. Write to the person you keep meaning to call.","move":"Mail it before you can change your mind.","image":{"url":"https://images.unsplash.com/photo-1746912890419-52fa3e39e482?auto=format&fit=crop&w=1200&q=80","photographer_name":"Chris Johnson","photographer_username":"cj580","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1746912890419-52fa3e39e482?auto=format&fit=crop&w=1200&q=80","photographer_name":"Chris Johnson","photographer_username":"cj580","download_location":null}]}},{"position":3,"time_label":"7:45 PM","title":"The Last Supper","place":"Veselka, 144 Second Ave","body":"Not the best restaurant in New York. The one that''s been feeding whoever walks in since 1954.","move":"Order the thing you always skip.","image":{"url":"https://images.unsplash.com/photo-1765087909999-754261788116?auto=format&fit=crop&w=1200&q=80","photographer_name":"Angel Maldonado","photographer_username":"angelmalrey","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1765087909999-754261788116?auto=format&fit=crop&w=1200&q=80","photographer_name":"Angel Maldonado","photographer_username":"angelmalrey","download_location":null}]}},{"position":4,"time_label":"9:30 PM","title":"The Last Look","place":"Williamsburg Bridge walkway, from Delancey & Clinton St","body":"Walk until the whole skyline fits in one view. Every lit window is someone else spending their last night.","move":"Stay until you stop counting the windows.","image":{"url":"https://images.unsplash.com/photo-1790216846565-2ffcfc45f849?auto=format&fit=crop&w=1200&q=80","photographer_name":"Christy Situ","photographer_username":"mning_99","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1790216846565-2ffcfc45f849?auto=format&fit=crop&w=1200&q=80","photographer_name":"Christy Situ","photographer_username":"mning_99","download_location":null}]}}]'::jsonb) as x(position integer,time_label text,title text,place text,body text,move text,image jsonb);

insert into public.journeys (id, is_editorial, status, published_at, title, kicker, hook, premise, when_label, budget_label, area, mode, ending, cover_image)
select 'e15e0000-0000-4000-8000-000000000003', true, 'published', now(), title, kicker, hook, premise, when_label, budget_label, area, mode, ending, cover_image
from jsonb_to_record('{"title":"New York''s Secret Time Machine","kicker":"History, layered","hook":"Travel through three centuries without leaving Manhattan.","premise":"Manhattan never erased its past. It just built on top of it. This afternoon, you dig.","when_label":"Saturday · 1–5 PM","budget_label":"About $12","area":"Financial District → City Hall","mode":"Walking + one subway ride · 5 stops","ending":"Three centuries, one afternoon, one subway fare. The time machine was the city all along.","cover_image":{"url":"https://images.unsplash.com/photo-1737926536344-653de4ad24fe?auto=format&fit=crop&w=1200&q=80","photographer_name":"The New York Public Library","photographer_username":"nypl","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1737926536344-653de4ad24fe?auto=format&fit=crop&w=1200&q=80","photographer_name":"The New York Public Library","photographer_username":"nypl","download_location":null}]}}'::jsonb) as x(title text,kicker text,hook text,premise text,when_label text,budget_label text,area text,mode text,ending text,cover_image jsonb);
insert into public.journey_stops (journey_id, position, time_label, title, place, body, move, image)
select 'e15e0000-0000-4000-8000-000000000003', position, time_label, title, place, body, move, image
from jsonb_to_recordset('[{"position":1,"time_label":"1650s","title":"The Edge of the Island","place":"Pearl Street, Lower Manhattan","body":"Pearl Street was the waterfront. Everything east of here — Water Street, Front Street, the towers — stands on landfill.","move":"Walk two blocks toward the East River. You''ve just walked into the river.","image":{"url":"https://images.unsplash.com/photo-1575775424127-28bc80754cf5?auto=format&fit=crop&w=1200&q=80","photographer_name":"David Nieto","photographer_username":"nietramos_d","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1575775424127-28bc80754cf5?auto=format&fit=crop&w=1200&q=80","photographer_name":"David Nieto","photographer_username":"nietramos_d","download_location":null}]}},{"position":2,"time_label":"1783","title":"The Farewell Room","place":"Fraunces Tavern, 54 Pearl St","body":"Washington said goodbye to his officers here in 1783. The building has been rebuilt since, which is very New York: the city keeps the story, not the bricks.","move":"Find the oldest-looking detail on the block. Then ask yourself if it''s really old.","image":{"url":"https://images.unsplash.com/photo-1738090235115-bf108940a1b4?auto=format&fit=crop&w=1200&q=80","photographer_name":"The New York Public Library","photographer_username":"nypl","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1738090235115-bf108940a1b4?auto=format&fit=crop&w=1200&q=80","photographer_name":"The New York Public Library","photographer_username":"nypl","download_location":null}]}},{"position":3,"time_label":"1836","title":"The Street That Burned","place":"Stone Street","body":"The Great Fire of 1835 flattened this neighborhood. The low buildings that rose afterward are still here, with tables spilling onto the street.","move":"Get a drink outside. You''re sitting in the year after the fire.","image":{"url":"https://images.unsplash.com/photo-1769702936920-4b2d6233d273?auto=format&fit=crop&w=1200&q=80","photographer_name":"Ayman Akil","photographer_username":"vymvnv","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1769702936920-4b2d6233d273?auto=format&fit=crop&w=1200&q=80","photographer_name":"Ayman Akil","photographer_username":"vymvnv","download_location":null}]}},{"position":4,"time_label":"1904","title":"The Station That Closed","place":"Brooklyn Bridge–City Hall, downtown 6 train","body":"The subway opened with a jewel box: City Hall station, all tile arches, skylights and brass chandeliers. It closed in 1945, but the 6 still loops through it.","move":"Stay on the 6 after the last stop. Watch the windows as the train turns.","image":{"url":"https://images.unsplash.com/photo-1666312547951-5825f0803bd6?auto=format&fit=crop&w=1200&q=80","photographer_name":"Sharkie","photographer_username":"wzy7","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1666312547951-5825f0803bd6?auto=format&fit=crop&w=1200&q=80","photographer_name":"Sharkie","photographer_username":"wzy7","download_location":null}]}},{"position":5,"time_label":"Now","title":"The View Back","place":"Brooklyn Bridge walkway, near City Hall","body":"Opened in 1883. Walk out until you want to turn around.","move":"Turn around. Find all three centuries in one skyline.","image":{"url":"https://images.unsplash.com/photo-1716067802412-31735ab71837?auto=format&fit=crop&w=1200&q=80","photographer_name":"Marloes van der Veer","photographer_username":"mvdv99","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1716067802412-31735ab71837?auto=format&fit=crop&w=1200&q=80","photographer_name":"Marloes van der Veer","photographer_username":"mvdv99","download_location":null}]}}]'::jsonb) as x(position integer,time_label text,title text,place text,body text,move text,image jsonb);

insert into public.journeys (id, is_editorial, status, published_at, title, kicker, hook, premise, when_label, budget_label, area, mode, ending, cover_image)
select 'e15e0000-0000-4000-8000-000000000004', true, 'published', now(), title, kicker, hook, premise, when_label, budget_label, area, mode, ending, cover_image
from jsonb_to_record('{"title":"A Billionaire''s Day on $25","kicker":"Absurd luxury","hook":"Experience the absurd luxury of New York without actually being rich.","premise":"Old money doesn''t rush. Today, neither do you. Budget: $25. Attitude: unlimited.","when_label":"Sunday · 10 AM – 4 PM","budget_label":"Under $25","area":"Upper East Side → Fifth Avenue","mode":"Walking · 5 stops","ending":"Total spent: under $25. Total feeling: inherited.","cover_image":{"url":"https://images.unsplash.com/photo-1703294205613-5321d5a12017?auto=format&fit=crop&w=1200&q=80","photographer_name":"Jen Dries","photographer_username":"jennys_eye0","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1703294205613-5321d5a12017?auto=format&fit=crop&w=1200&q=80","photographer_name":"Jen Dries","photographer_username":"jennys_eye0","download_location":null}]}}'::jsonb) as x(title text,kicker text,hook text,premise text,when_label text,budget_label text,area text,mode text,ending text,cover_image jsonb);
insert into public.journey_stops (journey_id, position, time_label, title, place, body, move, image)
select 'e15e0000-0000-4000-8000-000000000004', position, time_label, title, place, body, move, image
from jsonb_to_recordset('[{"position":1,"time_label":"10:00 AM","title":"Your Estate","place":"Conservatory Garden, Central Park · Fifth Ave & 105th St","body":"Six acres of formal gardens, fountains, and hedges. Walk it as if the gardeners report to you.","move":"Inspect the fountain. Find one thing to have the staff fix.","image":{"url":"https://images.unsplash.com/photo-1770914910110-fc7ac74e3912?auto=format&fit=crop&w=1200&q=80","photographer_name":"Adarsh Chauhan","photographer_username":"dyno8426","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1770914910110-fc7ac74e3912?auto=format&fit=crop&w=1200&q=80","photographer_name":"Adarsh Chauhan","photographer_username":"dyno8426","download_location":null}]}},{"position":2,"time_label":"11:15 AM","title":"House Hunting","place":"Fifth Avenue, 105th St → 82nd St","body":"Walk down Museum Mile and shop for a mansion. Andrew Carnegie''s, at 91st Street, is now the Cooper Hewitt. Too modest? Keep walking.","move":"Pick the house you''d buy. Name your butler.","image":{"url":"https://images.unsplash.com/photo-1626197113408-9d8db8f7b8d0?auto=format&fit=crop&w=1200&q=80","photographer_name":"Brendan Stephens","photographer_username":"brendan_stephens","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1626197113408-9d8db8f7b8d0?auto=format&fit=crop&w=1200&q=80","photographer_name":"Brendan Stephens","photographer_username":"brendan_stephens","download_location":null}]}},{"position":3,"time_label":"12:00 PM","title":"Your Private Collection","place":"The Met, 1000 Fifth Ave","body":"New York residents and NY, NJ and CT students pay what they wish. Rooms built for kings, for the price of a coffee — or less.","move":"Walk the period rooms as if deciding which one to keep.","image":{"url":"https://images.unsplash.com/photo-1759020622419-a2b5bb9f53d2?auto=format&fit=crop&w=1200&q=80","photographer_name":"Jason Gooljar","photographer_username":"jasongooljar24","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1759020622419-a2b5bb9f53d2?auto=format&fit=crop&w=1200&q=80","photographer_name":"Jason Gooljar","photographer_username":"jasongooljar24","download_location":null}]}},{"position":4,"time_label":"2:30 PM","title":"Espresso, Standing","place":"Sant Ambroeus, 1000 Madison Ave","body":"Milanese style: espresso at the bar, standing, gone in three minutes. The most aristocratic thing you''ll do all day costs less than lunch.","move":"Order at the bar. Do not sit down.","image":{"url":"https://images.unsplash.com/photo-1790689893625-aa90a7ec18b2?auto=format&fit=crop&w=1200&q=80","photographer_name":"Haberdoedas","photographer_username":"haberdoedas","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1790689893625-aa90a7ec18b2?auto=format&fit=crop&w=1200&q=80","photographer_name":"Haberdoedas","photographer_username":"haberdoedas","download_location":null}]}},{"position":5,"time_label":"3:30 PM","title":"Return to the Hotel","place":"The Plaza, Grand Army Plaza","body":"Stroll down Fifth to the Plaza''s front steps. Stand there as if you''re waiting for the car to be brought around.","move":"You don''t go in. You don''t need to.","image":{"url":"https://images.unsplash.com/photo-1779764372293-d2b99883cb45?auto=format&fit=crop&w=1200&q=80","photographer_name":"Andrew Wang","photographer_username":"wangdrew","download_location":null,"candidates":[{"url":"https://images.unsplash.com/photo-1779764372293-d2b99883cb45?auto=format&fit=crop&w=1200&q=80","photographer_name":"Andrew Wang","photographer_username":"wangdrew","download_location":null}]}}]'::jsonb) as x(position integer,time_label text,title text,place text,body text,move text,image jsonb);

commit;

-- Read-only post-application audit, including tasks. Report any table not protected.
select c.relname as table_name,c.relrowsecurity as rls_enabled,c.relforcerowsecurity as rls_forced
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p') order by c.relname;
