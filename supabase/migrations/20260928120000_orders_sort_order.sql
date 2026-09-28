-- Manual (drag and drop) ordering for the quotes list.
-- New quotes keep sort_order null and are listed first, newest on top.
alter table public.orders
  add column if not exists sort_order integer;

with ranked as (
  select id, row_number() over (order by created_at desc) - 1 as position
  from public.orders
)
update public.orders as quote
set sort_order = ranked.position
from ranked
where quote.id = ranked.id and quote.sort_order is null;

create index if not exists orders_sort_order_idx
  on public.orders (sort_order, created_at desc);
