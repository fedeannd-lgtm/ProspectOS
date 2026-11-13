alter table tenant_configs
  add column if not exists salesql_api_key text,
  add column if not exists contactout_api_key text;
