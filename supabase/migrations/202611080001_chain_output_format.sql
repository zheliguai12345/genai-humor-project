begin;

alter table public.prompt_chains
  add column output_format text not null default 'text'
    check (output_format in ('text', 'caption_list', 'journey_card'));

update public.prompt_chains
set output_format = case id
  when '70000000-0000-4000-8000-000000000004' then 'journey_card'
  when '71000000-0000-4000-8000-000000000001' then 'caption_list'
end
where id in ('70000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000001');

alter table public.prompt_chain_runs add column media jsonb;

commit;
