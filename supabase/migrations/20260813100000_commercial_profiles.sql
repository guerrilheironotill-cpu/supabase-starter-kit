-- Perfis comerciais: preserva dados históricos e prepara a futura área de parceiros.
alter table public.leads
  add column if not exists lead_interest text,
  add column if not exists professional_type text;

update public.leads
set lead_interest = case
  when client_type = 'architect' then 'professional'
  when client_type in ('final', 'professional', 'reseller') then client_type
  else null
end
where lead_interest is null;

alter table public.customers
  add column if not exists customer_type text not null default 'final',
  add column if not exists commercial_status text not null default 'pending',
  add column if not exists professional_type text,
  add column if not exists commercial_approved_at timestamptz,
  add column if not exists commercial_notes text;

create index if not exists leads_lead_interest_idx on public.leads (lead_interest);
create index if not exists customers_customer_type_idx on public.customers (customer_type);
create index if not exists customers_commercial_status_idx on public.customers (commercial_status);

alter table public.customers drop constraint if exists customers_customer_type_check;
alter table public.customers add constraint customers_customer_type_check
  check (customer_type in ('final', 'professional', 'reseller'));

alter table public.customers drop constraint if exists customers_commercial_status_check;
alter table public.customers add constraint customers_commercial_status_check
  check (commercial_status in ('pending', 'approved', 'suspended'));

comment on column public.leads.lead_interest is
  'Perfil declarado pelo lead; não representa aprovação comercial.';
comment on column public.customers.customer_type is
  'Tipo comercial real definido pela Arteno.';
comment on column public.customers.commercial_status is
  'Aprovação comercial administrada pela Arteno.';
