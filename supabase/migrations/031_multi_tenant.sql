-- Multi-tenancy: add tenant_id (Clerk orgId) to all tables with direct ownership.
-- Tables that inherit via FK (accounts, prospects, search_jobs, etc.) filter through campaign_id → campaigns.tenant_id.

ALTER TABLE campaigns              ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT '';
ALTER TABLE saved_urls             ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT '';
ALTER TABLE rep_configs            ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT '';
ALTER TABLE distribution_templates ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT '';
ALTER TABLE distribution_rules     ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT '';
ALTER TABLE inbox_config           ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT '';
ALTER TABLE client_companies       ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT '';
ALTER TABLE message_templates      ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT '';

-- people_search_configs: PK (rep_name, industry) collides across tenants → extend
ALTER TABLE people_search_configs  ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT '';
ALTER TABLE people_search_configs  DROP CONSTRAINT IF EXISTS people_search_configs_pkey;
ALTER TABLE people_search_configs  ADD PRIMARY KEY (tenant_id, rep_name, industry);

-- rep_configs: PK was (rep_name); extend to (tenant_id, rep_name)
ALTER TABLE rep_configs  DROP CONSTRAINT IF EXISTS rep_configs_pkey;
ALTER TABLE rep_configs  ADD PRIMARY KEY (tenant_id, rep_name);

-- inbox_config: was singleton id=1; now one row per tenant
ALTER TABLE inbox_config  DROP CONSTRAINT IF EXISTS inbox_config_pkey;
ALTER TABLE inbox_config  ADD CONSTRAINT inbox_config_tenant_unique UNIQUE (tenant_id);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant         ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_client_companies_tenant  ON client_companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inbox_config_tenant      ON inbox_config(tenant_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_tenant ON message_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_saved_urls_tenant        ON saved_urls(tenant_id);

-- Updated scorecard RPC: scoped to a single tenant
CREATE OR REPLACE FUNCTION get_prospect_scorecard(p_tenant_id text)
RETURNS TABLE(
  iso_week        text,
  shortlisted     bigint,
  enriched        bigint,
  enviados        bigint,
  reuniones       bigint,
  reuniones_total bigint
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    to_char(date_trunc('week', p.created_at AT TIME ZONE 'UTC'), 'IYYY"-W"IW') AS iso_week,
    COUNT(*) FILTER (WHERE p.shortlisted = true)                                               AS shortlisted,
    COUNT(*) FILTER (WHERE p.email IS NOT NULL AND p.email <> '')                              AS enriched,
    COUNT(*) FILTER (WHERE p.sent_at IS NOT NULL OR p.shortlist_status = 'Enviado')            AS enviados,
    COUNT(DISTINCT COALESCE(split_part(p.email, '@', 2), p.company_name))
      FILTER (WHERE p.shortlist_status = 'Reunión Agendada')                                   AS reuniones,
    COUNT(DISTINCT COALESCE(split_part(p.email, '@', 2), p.company_name))
      FILTER (WHERE p.shortlist_status IN ('Reunión Agendada', 'Reunión No SQL'))              AS reuniones_total
  FROM prospects p
  JOIN campaigns c ON c.id = p.campaign_id
  WHERE c.tenant_id = p_tenant_id
  GROUP BY 1
  ORDER BY 1 DESC;
$$;
