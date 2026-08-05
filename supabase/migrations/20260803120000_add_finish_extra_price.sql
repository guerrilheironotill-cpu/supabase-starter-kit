alter table public.finish_catalog
  add column if not exists extra_price numeric(12, 2) not null default 0;

alter table public.finish_catalog
  drop constraint if exists finish_catalog_extra_price_nonnegative;

alter table public.finish_catalog
  add constraint finish_catalog_extra_price_nonnegative
  check (extra_price >= 0);

comment on column public.finish_catalog.extra_price is
  'Valor adicional, em BRL, somado ao preço base quando o acabamento é escolhido.';
