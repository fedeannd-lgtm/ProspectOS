alter table people_search_configs
  add column if not exists last_result_count_2 integer,
  add column if not exists last_count_2_checked_at timestamptz;
