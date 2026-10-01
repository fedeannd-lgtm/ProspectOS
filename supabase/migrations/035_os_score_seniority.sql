ALTER TABLE os_score_rules  ADD COLUMN IF NOT EXISTS seniority_labels text[] NOT NULL DEFAULT '{}';
ALTER TABLE os_score2_rules ADD COLUMN IF NOT EXISTS seniority_labels text[] NOT NULL DEFAULT '{}';
