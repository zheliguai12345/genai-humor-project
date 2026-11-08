begin;

alter table public.image_searches
  add column search_origin text not null default 'generation'
    check (search_origin in ('generation', 'admin')),
  drop constraint image_searches_search_kind_check,
  add constraint image_searches_search_kind_check
    check (search_kind in ('initial', 'broader', 'neighborhood', 'journey_area', 'publish_tracking'));

commit;
