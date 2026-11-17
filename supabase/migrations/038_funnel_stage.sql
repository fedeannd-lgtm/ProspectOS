-- Funnel stage for prospects (personas) and accounts (empresas)
-- Independent of shortlist_status — tracks sales pipeline position

ALTER TABLE prospects ADD COLUMN IF NOT EXISTS funnel_stage text DEFAULT 'prospectado'
  CHECK (funnel_stage IN ('prospectado','contactado','respuesta','interesado','agendado','ganado'));
CREATE INDEX IF NOT EXISTS prospects_funnel_stage_idx ON prospects(funnel_stage);

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS funnel_stage text DEFAULT 'prospectado'
  CHECK (funnel_stage IN ('prospectado','contactado','respuesta','interesado','agendado','ganado'));
CREATE INDEX IF NOT EXISTS accounts_funnel_stage_idx ON accounts(funnel_stage);
