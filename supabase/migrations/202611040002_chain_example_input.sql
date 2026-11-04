begin;

alter table public.prompt_chains add column example_input text;

update public.prompt_chains as chain
set example_input = examples.input
from (values
  ('70000000-0000-4000-8000-000000000004'::uuid, '{"theme": "The City Is Sending You Messages", "vibe": "quiet", "time": "afternoon", "budget": "under $25"}'),
  ('71000000-0000-4000-8000-000000000001'::uuid, 'Optional. Upload a photo; add a note for extra context.'),
  ('e43edafe-9cf5-40f7-b23a-5b0f225a3bd6'::uuid, 'Optional. Upload a New York street photo; add a note such as the neighborhood.')
) as examples(id, input)
where chain.id = examples.id;

commit;
