-- Torna o painel autônomo do WooCommerce. O vínculo externo é mantido somente
-- para tornar a importação histórica idempotente e auditável.

alter table public.app_orders
  add column if not exists origin text not null default 'site',
  add column if not exists external_number text,
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists customer_phone text,
  add column if not exists customer_document text,
  add column if not exists lead_id uuid,
  add column if not exists legacy_payload jsonb;

create unique index if not exists app_orders_wc_id_unique
  on public.app_orders (wc_id)
  where wc_id is not null;

create index if not exists app_orders_customer_document_idx
  on public.app_orders (customer_document);

create index if not exists app_orders_origin_idx
  on public.app_orders (origin);

alter table public.customers
  add column if not exists cpf text,
  add column if not exists cnpj text,
  add column if not exists status text not null default 'active',
  add column if not exists origin text not null default 'site';

create index if not exists customers_cpf_idx on public.customers (cpf);
create index if not exists customers_cnpj_idx on public.customers (cnpj);
create index if not exists customers_status_idx on public.customers (status);

alter table public.products
  add column if not exists origin text not null default 'manual',
  add column if not exists sort_order integer;

update public.products
set sort_order = ranked.position
from (
  select id, row_number() over (order by created_at asc, id asc)::integer as position
  from public.products
) ranked
where public.products.id = ranked.id
  and public.products.sort_order is null;

create index if not exists products_sort_order_idx on public.products (sort_order);
create index if not exists products_origin_idx on public.products (origin);

comment on column public.app_orders.wc_id is
  'Identificador histórico usado somente para importação idempotente; não altera o comportamento local.';
