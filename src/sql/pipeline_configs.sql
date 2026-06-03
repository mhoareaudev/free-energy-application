-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS pipeline_configs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key  VARCHAR(50) UNIQUE NOT NULL,
  name        TEXT        NOT NULL DEFAULT 'Pipeline de transaction',
  phases      JSONB       NOT NULL DEFAULT '[]',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pipeline_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pipeline configs"
  ON pipeline_configs FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage pipeline configs"
  ON pipeline_configs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed with default phases
INSERT INTO pipeline_configs (config_key, name, phases) VALUES (
  'main',
  'Pipeline de transaction',
  '[
    {"id":1,"name":"Lead entrant","color":"#64748b","prob":"10%","count":0,"slot":"lead"},
    {"id":2,"name":"VT en cours","color":"#8b5cf6","prob":"20%","count":0,"slot":"vt_cours"},
    {"id":3,"name":"VT validée","color":"#14b8a6","prob":"30%","count":0,"slot":"vt_validee"},
    {"id":4,"name":"Signé","color":"#22c55e","prob":"40%","count":0,"slot":"signe"},
    {"id":5,"name":"DP en cours","color":"#eab308","prob":"50%","count":0,"slot":"dp_cours"},
    {"id":6,"name":"DP lancée","color":"#f97316","prob":"60%","count":0,"slot":"dp_lancee"},
    {"id":7,"name":"CNO reçu","color":"#3b82f6","prob":"80%","count":0,"slot":"cno"},
    {"id":8,"name":"Centrale posée","color":"#22c55e","prob":"100% (Gagné)","count":0,"slot":"installe"},
    {"id":9,"name":"Projet terminé","color":"#14b8a6","prob":"100% (Gagné)","count":0,"slot":null},
    {"id":10,"name":"Projet perdu","color":"#ef4444","prob":"Perdu (0%)","count":0,"slot":null}
  ]'
)
ON CONFLICT (config_key) DO NOTHING;
