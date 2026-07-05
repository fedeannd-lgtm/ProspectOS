-- ProspectOS — Install completo para instancia nueva
-- Ejecutar este archivo en el SQL Editor de Supabase (proyecto limpio)

-- ─── TABLAS PRINCIPALES ────────────────────────────────────────────────────

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  week_label text not null,
  rep_name text not null,
  rep_email text,
  industry text not null,
  status text default 'pending'
    check (status in ('pending','searching','enriching','distributing','done')),
  accounts_found int default 0,
  prospects_found int default 0,
  prospects_sent int default 0,
  notes text,
  list_id text,
  list_name text
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  campaign_id uuid references campaigns(id) on delete cascade,
  company_name text not null,
  domain text,
  sales_nav_id text,
  industry text,
  headcount_range text,
  country text,
  linkedin_url text,
  website_url text,
  status text default 'discovered'
    check (status in ('discovered','approved','rejected','scraping','done'))
);

create table if not exists prospects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  campaign_id uuid references campaigns(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  first_name text,
  last_name text,
  full_name text,
  job_title text,
  linkedin_url text,
  company_name text,
  company_domain text,
  is_premium boolean default false,
  connection_degree text,
  started_role_months int,
  location text,
  email text,
  email_status text,
  email_provider text,
  email_validated boolean default false,
  icp_score int default 0,
  icp_category text,
  os_score integer,
  personalized_email_a text,
  personalized_email_b text,
  phone text,
  phone_wa text,
  apollo_id text,
  highlights text,
  status text default 'scraped'
    check (status in ('scraped','enriched','approved','rejected','sent')),
  sequence_tool text,
  sequence_id text,
  sent_at timestamptz
);

create table if not exists search_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  campaign_id uuid references campaigns(id) on delete cascade,
  job_type text not null
    check (job_type in ('company_search','people_search')),
  apify_run_id text,
  apify_dataset_id text,
  sales_nav_url text,
  status text default 'pending'
    check (status in ('pending','running','completed','failed')),
  results_count int default 0,
  max_results int,
  estimated_ready_at timestamptz,
  completed_at timestamptz,
  start_page int
);

create table if not exists distribution_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  condition_field text not null,
  condition_operator text not null,
  condition_value text not null,
  target_tool text not null
    check (target_tool in ('smartlead','heyreach')),
  is_active boolean default true,
  priority int default 0
);

create table if not exists public.saved_urls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  rep_name text not null,
  industry text not null,
  url_type text not null check (url_type in ('company_search', 'people_search')),
  url text not null,
  label text,
  times_used int default 0
);

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

create table if not exists public.rep_configs (
  rep_name text primary key,
  linkedin_cookie text,
  updated_at timestamptz default now()
);

-- ─── DATOS INICIALES ───────────────────────────────────────────────────────

insert into distribution_rules (name, condition_field, condition_operator, condition_value, target_tool, priority) values
  ('Premium LinkedIn → HeyReach', 'is_premium', 'eq', 'true', 'heyreach', 10),
  ('Score alto → Smartlead', 'icp_score', 'gte', '7', 'smartlead', 5);

-- ─── ROW LEVEL SECURITY ────────────────────────────────────────────────────

alter table campaigns enable row level security;
alter table accounts enable row level security;
alter table prospects enable row level security;
alter table search_jobs enable row level security;
alter table distribution_rules enable row level security;
alter table public.saved_urls enable row level security;
alter table public.people_search_configs enable row level security;
alter table public.rep_configs enable row level security;

-- ─── POLICIES ──────────────────────────────────────────────────────────────

create policy "Authenticated users" on campaigns for all using (true);
create policy "Authenticated users" on accounts for all using (true);
create policy "Authenticated users" on prospects for all using (true);
create policy "Authenticated users" on search_jobs for all using (true);
create policy "Authenticated users" on distribution_rules for all using (true);

create policy "public read"   on public.saved_urls for select using (true);
create policy "public insert" on public.saved_urls for insert with check (true);
create policy "public update" on public.saved_urls for update using (true);
create policy "public delete" on public.saved_urls for delete using (true);

create policy "public read"   on public.people_search_configs for select using (true);
create policy "public insert" on public.people_search_configs for insert with check (true);
create policy "public update" on public.people_search_configs for update using (true);

create policy "public read"   on public.rep_configs for select using (true);
create policy "public insert" on public.rep_configs for insert with check (true);
create policy "public update" on public.rep_configs for update using (true);
