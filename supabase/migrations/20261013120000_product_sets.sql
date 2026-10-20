-- Product "sets" (kits of pots): sold at a single price, with no per-size pricing.
-- A set keeps exactly one product_sizes row holding the kit price and total weight;
-- set_items is a free-text description of what the kit contains.
alter table public.products
  add column if not exists is_set boolean not null default false,
  add column if not exists set_items text;
