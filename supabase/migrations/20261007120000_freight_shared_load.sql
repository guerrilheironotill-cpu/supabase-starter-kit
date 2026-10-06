-- Whether the carrier may combine this load with other cargo.
alter table public.freight_quotes
  add column if not exists shared_load boolean not null default false;
