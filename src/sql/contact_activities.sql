-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS contact_activities (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id      VARCHAR(20) NOT NULL,
  type            VARCHAR(50) NOT NULL DEFAULT 'note',
  title           TEXT        NOT NULL,
  body            TEXT,
  created_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contact_activities_contact_id_idx
  ON contact_activities (contact_id, created_at DESC);

ALTER TABLE contact_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage activities"
  ON contact_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);
