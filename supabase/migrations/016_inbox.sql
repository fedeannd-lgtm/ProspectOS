-- prospect_replies: incoming replies from Smartlead and HeyReach
CREATE TABLE IF NOT EXISTS prospect_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  prospect_id uuid REFERENCES prospects(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  source text NOT NULL, -- 'smartlead' | 'heyreach'
  external_lead_id text,
  external_campaign_id text,
  reply_message_id text,
  replied_at timestamptz,
  subject text,
  body text NOT NULL,
  thread_history jsonb,
  sender_name text,
  sender_email text,
  intent text, -- 'interested' | 'not_interested' | 'question' | 'other'
  ai_draft text,
  ai_reasoning text,
  status text DEFAULT 'pending_review', -- 'pending_review' | 'draft_ready' | 'sent' | 'dismissed'
  sent_at timestamptz,
  sent_body text
);

-- inbox_config: singleton config for Inbox AI (Calendly link + product context)
CREATE TABLE IF NOT EXISTS inbox_config (
  id int PRIMARY KEY DEFAULT 1,
  product_context text,
  calendly_link text,
  updated_at timestamptz DEFAULT now()
);

-- Insert default empty row
INSERT INTO inbox_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS
ALTER TABLE prospect_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbox_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on prospect_replies" ON prospect_replies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on inbox_config" ON inbox_config FOR ALL USING (true) WITH CHECK (true);
