-- Keep color media capabilities in parity with finish_catalog.
alter table public.color_catalog
  add column if not exists gallery text[] not null default '{}';