alter table people_search_configs
  add column if not exists last_result_count integer,
  add column if not exists last_count_checked_at timestamptz;
