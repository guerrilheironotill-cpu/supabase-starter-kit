-- Unit weight per product size, used to total the load of freight quotes.
alter table public.product_sizes
  add column if not exists weight_kg numeric;

-- Freight quotes.
-- Flow: the admin asks the customer for delivery data through a public form link
-- (form_token); once complete, the admin publishes a public page for carriers (token)
-- and carriers send proposals. Public pages go through server routes (service role);
-- direct table access is limited to admins.
create table if not exists public.freight_quotes (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  form_token text unique,
  order_id uuid references public.orders(id) on delete set null,
  status text not null default 'aberta'
    check (status in ('aguardando_cliente', 'respondida', 'aberta', 'fechada')),
  customer_label text,
  customer_phone text,
  customer_answered_at timestamptz,
  origin_cep text,
  origin_district text,
  origin_city text,
  origin_state text,
  origin_floor text not null default 'terreo' check (origin_floor in ('terreo', 'superior')),
  origin_stairs boolean not null default false,
  dest_cep text,
  dest_district text,
  dest_city text,
  dest_state text,
  dest_floor text not null default 'terreo' check (dest_floor in ('terreo', 'superior')),
  dest_stairs boolean not null default false,
  access_notes text,
  -- Full addresses (street, number, complement). Private: only sent to the chosen carrier.
  origin_address text,
  dest_address text,
  items jsonb not null default '[]'::jsonb,
  load_details text,
  loading_included boolean not null default false,
  photo_note text,
  empty_load boolean not null default false,
  pickup_date date,
  pickup_flexible boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists freight_quotes_created_at_idx on public.freight_quotes (created_at desc);
create index if not exists freight_quotes_order_id_idx on public.freight_quotes (order_id);

create table if not exists public.freight_proposals (
  id uuid primary key default gen_random_uuid(),
  freight_quote_id uuid not null references public.freight_quotes(id) on delete cascade,
  carrier_name text not null,
  carrier_phone text not null,
  price numeric,
  deadline_days integer,
  notes text,
  chosen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists freight_proposals_quote_idx
  on public.freight_proposals (freight_quote_id, created_at desc);

alter table public.freight_quotes enable row level security;
alter table public.freight_proposals enable row level security;

drop policy if exists "Admins manage freight quotes" on public.freight_quotes;
create policy "Admins manage freight quotes" on public.freight_quotes
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Admins manage freight proposals" on public.freight_proposals;
create policy "Admins manage freight proposals" on public.freight_proposals
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
