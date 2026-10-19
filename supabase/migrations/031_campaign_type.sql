alter table campaigns
  add column if not exists campaign_type text not null default 'sales_navigator'
    check (campaign_type in ('sales_navigator', 'list_import', 'crm_sync'));
