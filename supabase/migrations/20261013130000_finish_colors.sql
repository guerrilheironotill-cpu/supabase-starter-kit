-- Colors available inside each finish, each with an optional extra price that is added
-- to the finish's own extra price. A finish with no rows here falls back to the product's
-- colors at no extra cost.
create table if not exists public.finish_colors (
  finish_name text not null,
  color_name text not null,
  extra_price numeric(12, 2) not null default 0 check (extra_price >= 0),
  sort_order integer not null default 0,
  primary key (finish_name, color_name)
);

alter table public.finish_colors enable row level security;

drop policy if exists "Finish colors are public" on public.finish_colors;
create policy "Finish colors are public" on public.finish_colors
  for select to anon, authenticated
  using (true);

drop policy if exists "Admins manage finish colors" on public.finish_colors;
create policy "Admins manage finish colors" on public.finish_colors
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
