-- ProspectOS Initial Schema

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  week_label text not null,          -- e.g. "S7 - 2026-06-01"
  rep_name text not null,            -- Alu, Fede, Guido, Suva, Jess
  rep_email text,
  industry text not null,            -- Retail, Manufactura, Finance & Ins, etc.
  status text default 'pending'      -- pending | searching | enriching | distributing | done
    check (status in ('pending','searching','enriching','distributing','done')),
  accounts_found int default 0,
  prospects_found int default 0,
  prospects_sent int default 0,
  notes text
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  campaign_id uuid references campaigns(id) on delete cascade,
  company_name text not null,
  domain text,
  sales_nav_id text,
  industry text,
  headcount_range text,              -- e.g. "201-500"
  country text,
  linkedin_url text,
  website_url text,
  status text default 'discovered'   -- discovered | approved | rejected | scraping | done
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
  connection_degree text,            -- FIRST | SECOND | THIRD
  started_role_months int,
  email text,
  email_status text,                 -- valid | invalid | catch-all | unknown
  email_validated boolean default false,
  icp_score int default 0,           -- 0-10
  icp_category text,                 -- Experience | Helpdesk | Onboarding | Communication | Generic
  personalized_email_a text,
  personalized_email_b text,
  status text default 'scraped'      -- scraped | enriched | approved | rejected | sent
    check (status in ('scraped','enriched','approved','rejected','sent')),
  sequence_tool text,                -- smartlead | heyreach
  sequence_id text,
  sent_at timestamptz
);

create table if not exists search_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  campaign_id uuid references campaigns(id) on delete cascade,
  job_type text not null             -- company_search | people_search
    check (job_type in ('company_search','people_search')),
  apify_run_id text,
  apify_dataset_id text,
  sales_nav_url text,
  status text default 'pending'      -- pending | running | completed | failed
    check (status in ('pending','running','completed','failed')),
  results_count int default 0,
  completed_at timestamptz
);

create table if not exists distribution_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  condition_field text not null,     -- icp_score | is_premium | connection_degree | email_status
  condition_operator text not null,  -- gte | lte | eq | in
  condition_value text not null,
  target_tool text not null          -- smartlead | heyreach
    check (target_tool in ('smartlead','heyreach')),
  is_active boolean default true,
  priority int default 0
);

-- Default distribution rules
insert into distribution_rules (name, condition_field, condition_operator, condition_value, target_tool, priority) values
  ('Premium LinkedIn → HeyReach', 'is_premium', 'eq', 'true', 'heyreach', 10),
  ('Score alto → Smartlead', 'icp_score', 'gte', '7', 'smartlead', 5);

-- Row Level Security
alter table campaigns enable row level security;
alter table accounts enable row level security;
alter table prospects enable row level security;
alter table search_jobs enable row level security;
alter table distribution_rules enable row level security;

-- Policies (todos los usuarios autenticados ven todo por ahora)
create policy "Authenticated users" on campaigns for all using (true);
create policy "Authenticated users" on accounts for all using (true);
create policy "Authenticated users" on prospects for all using (true);
create policy "Authenticated users" on search_jobs for all using (true);
create policy "Authenticated users" on distribution_rules for all using (true);
