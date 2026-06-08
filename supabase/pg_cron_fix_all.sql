-- ═══════════════════════════════════════════════════════════════════
-- CORRECTION DE TOUS LES CRON JOBS — Clé anon hardcodée
-- À exécuter dans le SQL Editor Supabase :
-- https://supabase.com/dashboard/project/yrdweudyaspnywwrdwqv/sql
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Supprimer les 6 jobs existants ───────────────────────────────
SELECT cron.unschedule('vt-return-reminder-j1');
SELECT cron.unschedule('vt-reminder-j2');
SELECT cron.unschedule('nomenclature-reminder-j5');
SELECT cron.unschedule('pose-planning-weekly');
SELECT cron.unschedule('pose-followup-daily');
SELECT cron.unschedule('weekly-recap-monday');

-- ─────────────────────────────────────────────────────────────────
-- CRON 1 — send-vt-return-reminder : quotidien 4h UTC (8h La Réunion)
-- J+1 après date prév VT si pas de date retour VT
-- ─────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'vt-return-reminder-j1',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://yrdweudyaspnywwrdwqv.supabase.co/functions/v1/send-vt-return-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyZHdldWR5YXNwbnl3d3Jkd3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTk0NzQsImV4cCI6MjA4NTc5NTQ3NH0.ngVQ-9iYY8v4BR5UqVE02zv_DJ_ZbId9bkzehPrbxl8"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────────────────────────
-- CRON 2 — send-vt-reminder : quotidien 4h UTC (8h La Réunion)
-- J+2 après création si pas de chargé d'affaires
-- ─────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'vt-reminder-j2',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://yrdweudyaspnywwrdwqv.supabase.co/functions/v1/send-vt-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyZHdldWR5YXNwbnl3d3Jkd3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTk0NzQsImV4cCI6MjA4NTc5NTQ3NH0.ngVQ-9iYY8v4BR5UqVE02zv_DJ_ZbId9bkzehPrbxl8"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────────────────────────
-- CRON 3 — send-nomenclature-reminder : quotidien 4h UTC (8h La Réunion)
-- J+5 après date retour VT si nomenclature non validée
-- ─────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'nomenclature-reminder-j5',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://yrdweudyaspnywwrdwqv.supabase.co/functions/v1/send-nomenclature-reminder',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyZHdldWR5YXNwbnl3d3Jkd3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTk0NzQsImV4cCI6MjA4NTc5NTQ3NH0.ngVQ-9iYY8v4BR5UqVE02zv_DJ_ZbId9bkzehPrbxl8"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────────────────────────
-- CRON 4 — send-pose-planning : jeudi 4h UTC (8h La Réunion)
-- ─────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'pose-planning-weekly',
  '0 4 * * 4',
  $$
  SELECT net.http_post(
    url     := 'https://yrdweudyaspnywwrdwqv.supabase.co/functions/v1/send-pose-planning',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyZHdldWR5YXNwbnl3d3Jkd3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTk0NzQsImV4cCI6MjA4NTc5NTQ3NH0.ngVQ-9iYY8v4BR5UqVE02zv_DJ_ZbId9bkzehPrbxl8"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────────────────────────
-- CRON 5 — send-pose-followup : quotidien 4h UTC (8h La Réunion)
-- ─────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'pose-followup-daily',
  '0 4 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://yrdweudyaspnywwrdwqv.supabase.co/functions/v1/send-pose-followup',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyZHdldWR5YXNwbnl3d3Jkd3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTk0NzQsImV4cCI6MjA4NTc5NTQ3NH0.ngVQ-9iYY8v4BR5UqVE02zv_DJ_ZbId9bkzehPrbxl8"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- ─────────────────────────────────────────────────────────────────
-- CRON 6 — send-weekly-recap : lundi 4h UTC (8h La Réunion)
-- ─────────────────────────────────────────────────────────────────
SELECT cron.schedule(
  'weekly-recap-monday',
  '0 4 * * 1',
  $$
  SELECT net.http_post(
    url     := 'https://yrdweudyaspnywwrdwqv.supabase.co/functions/v1/send-weekly-recap',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyZHdldWR5YXNwbnl3d3Jkd3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTk0NzQsImV4cCI6MjA4NTc5NTQ3NH0.ngVQ-9iYY8v4BR5UqVE02zv_DJ_ZbId9bkzehPrbxl8"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- ── Colonne dossier_ref (idempotent) ─────────────────────────────
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS dossier_ref TEXT;

-- ── Vérification finale ───────────────────────────────────────────
SELECT jobid, jobname, schedule, active FROM cron.job ORDER BY jobname;
