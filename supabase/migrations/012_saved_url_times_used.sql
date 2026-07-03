alter table public.saved_urls add column if not exists times_used int default 0;

-- Allow updates (needed for incrementing times_used)
create policy "public update" on public.saved_urls for update using (true);
