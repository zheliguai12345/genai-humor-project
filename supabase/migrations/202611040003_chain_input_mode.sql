begin;

alter table public.prompt_chains
  add column input_mode text not null default 'text_and_image',
  add constraint prompt_chains_input_mode_check
    check (input_mode in ('text', 'image', 'text_and_image'));

update public.prompt_chains
set input_mode = 'text'
where id = '70000000-0000-4000-8000-000000000004';

update public.prompt_chains
set input_mode = 'image',
    example_input = case
      when example_input is null
        or example_input = 'Optional. Upload a New York street photo; add a note such as the neighborhood.'
      then '30th Avenue, Astoria, Queens. Late afternoon.'
      else example_input
    end
where id = 'e43edafe-9cf5-40f7-b23a-5b0f225a3bd6';

commit;
