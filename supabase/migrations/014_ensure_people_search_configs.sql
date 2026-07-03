create table if not exists public.people_search_configs (
  rep_name text not null,
  industry text not null,
  base_url text,
  base_url_2 text,
  list_id text,
  list_name text,
  prev_list_id text,
  prev_list_name text,
  last_result_count integer,
  last_count_checked_at timestamptz,
  last_result_count_2 integer,
  last_count_2_checked_at timestamptz,
  updated_at timestamptz default now(),
  primary key (rep_name, industry)
);

alter table public.people_search_configs enable row level security;

create policy if not exists "public read" on public.people_search_configs for select using (true);
create policy if not exists "public insert" on public.people_search_configs for insert with check (true);
create policy if not exists "public update" on public.people_search_configs for update using (true);
