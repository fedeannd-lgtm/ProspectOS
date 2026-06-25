create table public.saved_urls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  rep_name text not null,
  industry text not null,
  url_type text not null check (url_type in ('company_search', 'people_search')),
  url text not null,
  label text
);

alter table public.saved_urls enable row level security;
create policy "public read" on public.saved_urls for select using (true);
create policy "public insert" on public.saved_urls for insert with check (true);
create policy "public delete" on public.saved_urls for delete using (true);
