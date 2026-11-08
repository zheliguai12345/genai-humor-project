begin;

insert into public.prompt_chains (id, name, description, input_mode, example_input, output_format)
values ('71000000-0000-4000-8000-000000000001', 'Image to Captions',
  'Describe an image, identify comic angles, and write five captions.',
  'text_and_image', 'Optional. Upload a photo; add a note for extra context.', 'caption_list')
on conflict (id) do nothing;

-- Serialize with the existing step ordering RPCs.
select id from public.prompt_chains
where id = '71000000-0000-4000-8000-000000000001'
for update;

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
) as seed(step_order, purpose, system_prompt, user_prompt)
where not exists (
  select 1 from public.prompt_chain_steps
  where chain_id = '71000000-0000-4000-8000-000000000001'
);

commit;
