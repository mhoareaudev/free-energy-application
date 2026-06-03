-- contact_task_lists: one row per contact, tasks stored as JSONB array
-- Each task: { id: uuid, title: string, completed: boolean }

CREATE TABLE IF NOT EXISTS contact_task_lists (
  contact_id   TEXT        PRIMARY KEY,
  tasks        JSONB       NOT NULL DEFAULT '[]',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE contact_task_lists ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Authenticated full access" ON contact_task_lists
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Allow anon read (for public-facing reads if needed)
CREATE POLICY "Anon read" ON contact_task_lists
  FOR SELECT TO anon USING (true);
