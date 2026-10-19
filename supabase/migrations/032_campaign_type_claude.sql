alter table campaigns
  drop constraint if exists campaigns_campaign_type_check;

alter table campaigns
  add constraint campaigns_campaign_type_check
    check (campaign_type in ('sales_navigator', 'list_import', 'crm_sync', 'claude_search'));
