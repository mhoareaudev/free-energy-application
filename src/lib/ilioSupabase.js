import { createClient } from '@supabase/supabase-js'

export const ilioSupabase = createClient(
  'https://rlggpctkpyfktahkesdg.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZ2dwY3RrcHlma3RhaGtlc2RnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMjk3MzQsImV4cCI6MjA5MTgwNTczNH0.Mc_6WZ8yW1klOsBPFuej7TvIYgcqElhLMpzZP3k6tgs',
  { auth: { persistSession: false } }
)
