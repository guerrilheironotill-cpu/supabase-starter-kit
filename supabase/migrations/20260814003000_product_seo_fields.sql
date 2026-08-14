alter table public.products
  add column if not exists meta_title text,
  add column if not exists meta_description text,
  add column if not exists seo_keywords text[] not null default '{}';

alter table public.products drop constraint if exists products_meta_title_length;
alter table public.products add constraint products_meta_title_length
  check (meta_title is null or char_length(meta_title) <= 60);

alter table public.products drop constraint if exists products_meta_description_length;
alter table public.products add constraint products_meta_description_length
  check (meta_description is null or char_length(meta_description) <= 160);

comment on column public.products.seo_keywords is
  'Termos de foco editoriais usados para orientar o SEO; não são publicados como meta keywords.';
