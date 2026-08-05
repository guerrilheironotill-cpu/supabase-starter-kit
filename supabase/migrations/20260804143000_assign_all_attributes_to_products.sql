-- Start every product with every known finish and color. Individual options can
-- then be disabled in the product editor without disappearing from the list.
with known_finishes as (
  select name from public.finish_catalog
  union
  select finish as name from public.product_finishes
)
insert into public.product_finishes (product_id, finish, sort_order)
select
  product.id,
  finish.name,
  row_number() over (partition by product.id order by finish.name) - 1
from public.products as product
cross join known_finishes as finish
where not exists (
  select 1
  from public.product_finishes as existing
  where existing.product_id = product.id
    and existing.finish = finish.name
);

with known_colors as (
  select name from public.color_catalog
  union
  select color as name from public.product_colors
)
insert into public.product_colors (product_id, color, sort_order)
select
  product.id,
  color.name,
  row_number() over (partition by product.id order by color.name) - 1
from public.products as product
cross join known_colors as color
where not exists (
  select 1
  from public.product_colors as existing
  where existing.product_id = product.id
    and existing.color = color.name
);
