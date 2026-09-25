-- Nichos por tenant (reemplaza NEXT_PUBLIC_INDUSTRIES env var y lista hardcodeada)
CREATE TABLE IF NOT EXISTS tenant_niches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  text NOT NULL,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, name)
);

ALTER TABLE tenant_niches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_niches_policy" ON tenant_niches USING (true) WITH CHECK (true);
