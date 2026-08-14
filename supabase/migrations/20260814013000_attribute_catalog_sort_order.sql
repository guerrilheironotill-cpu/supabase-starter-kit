alter table public.color_catalog
  add column if not exists sort_order integer not null default 9999;

alter table public.finish_catalog
  add column if not exists sort_order integer not null default 9999;

with ranked as (
  select id, row_number() over (order by name) - 1 as position
  from public.color_catalog
)
update public.color_catalog as catalog
set sort_order = ranked.position
from ranked
where catalog.id = ranked.id and catalog.sort_order = 9999;

with ranked as (
  select id, row_number() over (order by name) - 1 as position
  from public.finish_catalog
)
update public.finish_catalog as catalog
set sort_order = ranked.position
from ranked
where catalog.id = ranked.id and catalog.sort_order = 9999;

create index if not exists color_catalog_sort_order_idx
  on public.color_catalog (sort_order, name);

create index if not exists finish_catalog_sort_order_idx
  on public.finish_catalog (sort_order, name);
