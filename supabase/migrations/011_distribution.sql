-- Distribution templates: reusable routing configurations
create table if not exists distribution_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  name text not null,
  industry text,
  notes text
);

-- Routes within each template (ordered by priority asc)
create table if not exists distribution_routes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  template_id uuid references distribution_templates(id) on delete cascade,
  name text,
  priority int default 0,
  conditions jsonb not null default '[]',
  smartlead_campaign_id text,
  heyreach_campaign_id text
);

-- Runs: each execution of a template against a ProspectOS campaign
create table if not exists distribution_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  template_id uuid references distribution_templates(id) on delete set null,
  template_name text not null,
  source_campaign_id uuid references campaigns(id) on delete set null,
  include_previously_sent boolean default false,
  status text default 'pending' check (status in ('pending', 'running', 'done', 'error')),
  results jsonb,
  error text
);

-- RLS
alter table distribution_templates enable row level security;
alter table distribution_routes enable row level security;
alter table distribution_runs enable row level security;

create policy "Authenticated users" on distribution_templates for all using (true);
create policy "Authenticated users" on distribution_routes for all using (true);
create policy "Authenticated users" on distribution_runs for all using (true);
