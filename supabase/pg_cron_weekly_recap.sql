-- ═══════════════════════════════════════════════════════════════════
-- RÉCAPITULATIF HEBDOMADAIRE — Cron lundi 8h (La Réunion)
-- À exécuter dans le SQL Editor Supabase :
-- https://supabase.com/dashboard/project/yrdweudyaspnywwrdwqv/sql
-- ═══════════════════════════════════════════════════════════════════

-- ── ÉTAPE 1 : Extensions ─────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── ÉTAPE 2 : Créer le cron job ──────────────────────────────────
-- '0 4 * * 1' = chaque lundi à 4h UTC = 8h heure La Réunion (UTC+4)
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

-- ── ÉTAPE 3 : Vérifier ───────────────────────────────────────────
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'weekly-recap-monday';

-- ═══════════════════════════════════════════════════════════════════
-- POUR TESTER MANUELLEMENT :
-- Décommente et exécute uniquement ce bloc :
-- ═══════════════════════════════════════════════════════════════════
-- SELECT net.http_post(
--   url     := 'https://yrdweudyaspnywwrdwqv.supabase.co/functions/v1/send-weekly-recap',
--   headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlyZHdldWR5YXNwbnl3d3Jkd3F2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMTk0NzQsImV4cCI6MjA4NTc5NTQ3NH0.ngVQ-9iYY8v4BR5UqVE02zv_DJ_ZbId9bkzehPrbxl8"}'::jsonb,
--   body    := '{}'::jsonb
-- );
