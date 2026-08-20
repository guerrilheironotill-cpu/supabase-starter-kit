alter table public.customers
  add column if not exists instagram text;

comment on column public.customers.instagram is
  'Nome de usuário do Instagram do cliente, armazenado sem o caractere @ inicial.';
