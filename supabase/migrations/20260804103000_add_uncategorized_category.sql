insert into public.categories (name, slug, sort_order)
values ('Sem categoria', 'sem-categoria', 9999)
on conflict (slug) do update
set name = excluded.name;

