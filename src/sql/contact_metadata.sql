CREATE TABLE IF NOT EXISTS contact_metadata (
  contact_id   TEXT        PRIMARY KEY,
  contact_type TEXT,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE contact_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated full access" ON contact_metadata
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon read" ON contact_metadata
  FOR SELECT TO anon USING (true);
