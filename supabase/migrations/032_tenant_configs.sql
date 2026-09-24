CREATE TABLE IF NOT EXISTS tenant_configs (
  tenant_id          text PRIMARY KEY,
  anthropic_api_key  text,
  apify_token        text,
  apollo_api_key     text,
  zerobounce_api_key text,
  findymail_api_key  text,
  prospeo_api_key    text,
  datagma_api_key    text,
  hubspot_api_key    text,
  cold_email_tool    text,
  cold_email_api_key text,
  linkedin_tool      text,
  linkedin_api_key   text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
ALTER TABLE tenant_configs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_configs' AND policyname='Allow all on tenant_configs') THEN
    CREATE POLICY "Allow all on tenant_configs" ON tenant_configs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
