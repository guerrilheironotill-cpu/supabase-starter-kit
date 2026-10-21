-- Freight quote drafts (closed before publishing) and the declared cargo value.
alter table public.freight_quotes
  drop constraint if exists freight_quotes_status_check;
alter table public.freight_quotes
  add constraint freight_quotes_status_check
  check (status in ('rascunho', 'aguardando_cliente', 'respondida', 'aberta', 'fechada'));

-- Value of the goods (invoice / order), shown to carriers so they can size the insurance.
alter table public.freight_quotes
  add column if not exists cargo_value numeric;

-- Vehicle types the carrier may use (pickup, open truck…), chosen when the quote is created.
alter table public.freight_quotes
  add column if not exists vehicle_types text[] not null default '{}';
