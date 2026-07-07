alter table public.saved_urls add column if not exists current_page integer not null default 1;
