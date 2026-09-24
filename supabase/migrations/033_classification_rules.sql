-- Reps por tenant (reemplaza NEXT_PUBLIC_REPS env var)
CREATE TABLE IF NOT EXISTS tenant_reps (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  name        text NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);
ALTER TABLE tenant_reps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON tenant_reps FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_tenant_reps_tenant ON tenant_reps(tenant_id);

-- ICP rules por tenant: cada fila = un nivel (label + score + keywords)
-- Reemplaza RULES + SENIOR_KEYWORDS + MID_KEYWORDS en lib/icp.ts
CREATE TABLE IF NOT EXISTS icp_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  label       text NOT NULL,       -- ej: "C-Level / VP", "Manager", "No relevante"
  score       int  NOT NULL,       -- 10, 5, 0
  keywords    text[] NOT NULL DEFAULT '{}',
  priority    int  NOT NULL DEFAULT 0,  -- menor = se evalúa primero
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE icp_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON icp_rules FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_icp_rules_tenant ON icp_rules(tenant_id, priority);

-- OS Score rules por tenant: segmentos por job title
CREATE TABLE IF NOT EXISTS os_score_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  segment     text NOT NULL,       -- ej: "Helpdesk", "Onboarding", "Communication"
  keywords    text[] NOT NULL DEFAULT '{}',
  priority    int  NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE os_score_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON os_score_rules FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_os_score_rules_tenant ON os_score_rules(tenant_id, priority);

-- OS Score 2 rules: segunda dimensión de categorización
CREATE TABLE IF NOT EXISTS os_score2_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text NOT NULL,
  segment     text NOT NULL,
  keywords    text[] NOT NULL DEFAULT '{}',
  priority    int  NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE os_score2_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON os_score2_rules FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_os_score2_rules_tenant ON os_score2_rules(tenant_id, priority);

-- Nuevas columnas en prospects para segmentos
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS os_segment  text;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS os_segment2 text;
