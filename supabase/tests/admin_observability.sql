-- Run after the Week 7 migration. All test writes roll back.
begin;
do $$
declare model_uuid uuid; provider_uuid uuid; chain_uuid uuid; step_uuid uuid; table_name text;
begin
 foreach table_name in array array['llm_providers','llm_models','prompt_chains','prompt_chain_steps','prompt_chain_mix','terms','generation_examples','llm_responses','image_searches','allowed_signup_domains','whitelisted_emails'] loop
  if not (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name) then raise exception 'RLS missing: %',table_name; end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename=table_name) then raise exception 'Unexpected policy: %',table_name; end if;
  if has_table_privilege('anon','public.'||table_name,'SELECT') or has_table_privilege('authenticated','public.'||table_name,'SELECT') then raise exception 'Unexpected public grant: %',table_name; end if;
 end loop;
 insert into public.llm_providers(name) values ('Week 7 rollback-only test') returning id into provider_uuid;
 begin
  insert into public.llm_models(provider_id,display_name,api_model_id,role) values(provider_uuid,'Duplicate primary','week7-duplicate-primary','primary');
  raise exception 'Primary uniqueness was not enforced';
 exception when unique_violation then null; end;
 begin
  insert into public.llm_models(provider_id,display_name,api_model_id,role) values(provider_uuid,'Duplicate fallback','week7-duplicate-fallback','fallback');
  raise exception 'Fallback uniqueness was not enforced';
 exception when unique_violation then null; end;
 insert into public.llm_models(provider_id,display_name,api_model_id,role,supports_temperature) values(provider_uuid,'Test','week7-rollback-test','none',false) returning id into model_uuid;
 insert into public.prompt_chains(name) values('Week 7 rollback-only chain') returning id into chain_uuid;
 begin
  insert into public.prompt_chain_steps(chain_id,step_order,model_id,purpose,system_prompt,user_prompt_template,temperature) values(chain_uuid,1,model_uuid,'test','test','test',0.5);
  raise exception 'Unsupported temperature was accepted';
 exception when check_violation then null; end;
 update public.llm_models set supports_temperature=true where id=model_uuid;
 insert into public.prompt_chain_steps(chain_id,step_order,model_id,purpose,system_prompt,user_prompt_template,temperature) values(chain_uuid,1,model_uuid,'test','test','test',0.5) returning id into step_uuid;
 begin
  update public.llm_models set supports_temperature=false where id=model_uuid;
  raise exception 'Model change ignored a linked temperature';
 exception when check_violation then null; end;
 begin
  delete from public.llm_models where id=model_uuid;
  raise exception 'Model with a linked step was deleted';
 exception when foreign_key_violation then null; end;
 begin
  delete from public.llm_providers where id=provider_uuid;
  raise exception 'Provider with a linked model was deleted';
 exception when foreign_key_violation then null; end;
 begin
  insert into public.allowed_signup_domains(domain) values('UPPERCASE.EDU');
  raise exception 'Uppercase domain was accepted';
 exception when check_violation then null; end;
 begin
  insert into public.whitelisted_emails(email) values('UPPERCASE@example.edu');
  raise exception 'Uppercase email was accepted';
 exception when check_violation then null; end;
end $$;
rollback;
select 'Week 7 RLS, grants, role uniqueness, temperature and FK checks passed; all test writes rolled back.' as result;
