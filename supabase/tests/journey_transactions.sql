-- Run after the approved migration. All fixtures and votes are rolled back.
begin;
do $$
declare
  v_user uuid; v_id uuid; v_other uuid := gen_random_uuid();
  v_original jsonb; v_selected jsonb; v_bad jsonb; v_result jsonb; v_function text;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then raise exception 'An existing Auth user is required'; end if;
  insert into public.journeys(author_id,title,kicker,hook,premise,when_label,budget_label,area,mode,ending,cover_image)
  select v_user,title,kicker,hook,premise,when_label,budget_label,area,mode,ending,cover_image
  from public.journeys where id='e15e0000-0000-4000-8000-000000000001' returning id into v_id;
  insert into public.journey_stops(journey_id,position,time_label,title,place,body,move,image)
  select v_id,position,time_label,title,place,body,move,image from public.journey_stops
  where journey_id='e15e0000-0000-4000-8000-000000000001' and position<=3;
  -- A second stored candidate lets rollback checks detect an actual image change.
  update public.journeys set cover_image=jsonb_set(cover_image,'{candidates}',
    (cover_image->'candidates') || jsonb_build_array(jsonb_set(cover_image->'candidates'->0,'{photographer_name}','"Rollback test candidate"')))
  where id=v_id;
  select cover_image into v_original from public.journeys where id=v_id;
  v_selected := '[{"position":0,"candidate_index":1},{"position":1,"candidate_index":0},{"position":2,"candidate_index":0},{"position":3,"candidate_index":0}]';
  for v_bad in select value from jsonb_array_elements(jsonb_build_array(
    v_selected - 3,
    jsonb_set(v_selected,'{3,position}','2'),
    jsonb_set(v_selected,'{3,candidate_index}','999'),
    jsonb_set(v_selected,'{0,url}','"https://attacker.invalid/photo"'),
    jsonb_set(v_selected,'{3,position}','4'),
    jsonb_set(v_selected,'{0,candidate_index}','null')
  )) loop
    begin
      perform public.publish_journey(v_user,v_id,v_bad);
      raise exception 'Invalid selection was accepted';
    exception when others then
      if sqlerrm='Invalid selection was accepted' then raise; end if;
    end;
    if not exists(select 1 from public.journeys where id=v_id and status='draft' and cover_image=v_original) then
      raise exception 'Invalid selection partially committed';
    end if;
  end loop;
  begin
    perform public.publish_journey(v_other,v_id,v_selected);
    raise exception 'Non-author published draft';
  exception when others then
    if sqlerrm='Non-author published draft' then raise; end if;
  end;
  begin
    perform public.vote_on_journey(v_user,v_id,'up');
    raise exception 'Draft vote was accepted';
  exception when others then
    if sqlerrm='Draft vote was accepted' then raise; end if;
  end;
  update public.journey_stops set image=null where journey_id=v_id and position=3;
  v_selected := jsonb_set(v_selected,'{3,candidate_index}','null');
  v_result := public.publish_journey(v_user,v_id,v_selected);
  if jsonb_array_length(v_result)<>4 or not exists(select 1 from public.journeys where id=v_id and status='published'
    and published_at is not null and cover_image->>'photographer_name'='Rollback test candidate') then
    raise exception 'Valid publication did not persist stored candidate';
  end if;
  if not exists(select 1 from public.journey_stops where journey_id=v_id and position=3 and image='null'::jsonb) then
    raise exception 'Null image placeholder was not preserved';
  end if;
  begin
    perform public.publish_journey(v_user,v_id,v_selected);
    raise exception 'Published journey was republished';
  exception when others then
    if sqlerrm='Published journey was republished' then raise; end if;
  end;
  perform public.vote_on_journey(v_user,v_id,'up');
  perform public.vote_on_journey(v_user,v_id,'down');
  if (select count(*) from public.journey_votes where journey_id=v_id and user_id=v_user)<>1
    or not exists(select 1 from public.journey_votes where journey_id=v_id and user_id=v_user and value='down') then
    raise exception 'Changed vote did not update the same user association';
  end if;
  foreach v_function in array array['public.reserve_journey_generation(uuid,jsonb,text,text,text)',
    'public.save_generated_journey(uuid,uuid,jsonb)','public.publish_journey(uuid,uuid,jsonb)','public.vote_on_journey(uuid,uuid,text)'] loop
    if has_function_privilege('anon',v_function,'EXECUTE') or has_function_privilege('authenticated',v_function,'EXECUTE')
      or not has_function_privilege('service_role',v_function,'EXECUTE') then raise exception 'Invalid RPC privileges'; end if;
  end loop;
end;
$$;
rollback;
select 'passed; all test fixtures rolled back' as journey_transaction_tests;
