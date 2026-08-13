alter table public.orders
  add column if not exists email_notification_token uuid,
  add column if not exists email_notification_status text not null default 'pending',
  add column if not exists customer_email_sent_at timestamptz,
  add column if not exists admin_email_sent_at timestamptz,
  add column if not exists email_notification_error text;

create unique index if not exists orders_email_notification_token_key
  on public.orders (email_notification_token)
  where email_notification_token is not null;

comment on column public.orders.email_notification_token is
  'Token secreto usado uma única vez para solicitar os e-mails de finalização do orçamento.';

comment on column public.orders.email_notification_status is
  'Estado do envio dos e-mails: pending, sending, partial, sent ou failed.';
