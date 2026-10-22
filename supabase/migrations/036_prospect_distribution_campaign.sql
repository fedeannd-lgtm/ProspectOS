-- Add distribution campaign info to prospects so inbox can show where each prospect was sent
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS sl_campaign_id   text,
  ADD COLUMN IF NOT EXISTS sl_campaign_name text,
  ADD COLUMN IF NOT EXISTS hr_campaign_id   text,
  ADD COLUMN IF NOT EXISTS hr_campaign_name text;
