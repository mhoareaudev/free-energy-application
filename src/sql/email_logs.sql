CREATE TABLE IF NOT EXISTS email_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_id      text,
  template_name  text        NOT NULL DEFAULT 'vt_request',
  recipient_count int        NOT NULL DEFAULT 0,
  subject        text,
  status         text        NOT NULL DEFAULT 'sent',
  sent_at        timestamptz DEFAULT now()
);

-- Disable RLS (internal table)
ALTER TABLE email_logs DISABLE ROW LEVEL SECURITY;
GRANT ALL ON email_logs TO authenticated, anon;
