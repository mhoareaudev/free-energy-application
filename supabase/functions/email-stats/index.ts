import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Fetch all email logs
  const { data: logs, error } = await supabase
    .from('email_logs')
    .select('id, resend_id, status, recipient_count, sent_at')
    .order('sent_at', { ascending: false })
    .limit(500)

  if (error || !logs) {
    return new Response(JSON.stringify({ total: 0, totalRecipients: 0, delivered: 0, bounced: 0, opened: 0 }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  // Refresh status from Resend — inclut 'delivered' pour capter les ouvertures
  const toRefresh = logs.filter(l => l.resend_id && !['bounced', 'complained', 'opened', 'clicked'].includes(l.status)).slice(0, 50)

  await Promise.allSettled(toRefresh.map(async log => {
    try {
      const res = await fetch(`https://api.resend.com/emails/${log.resend_id}`, {
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}` },
      })
      if (!res.ok) return
      const email = await res.json()
      const newStatus: string = email.last_event ?? log.status
      if (newStatus !== log.status) {
        await supabase.from('email_logs').update({ status: newStatus }).eq('id', log.id)
        log.status = newStatus
      }
    } catch { /* ignore individual failures */ }
  }))

  // Aggregate stats
  const total           = logs.length
  const totalRecipients = logs.reduce((s, l) => s + (l.recipient_count ?? 0), 0)
  const delivered       = logs.filter(l => ['delivered', 'opened', 'clicked'].includes(l.status)).length
  const bounced         = logs.filter(l => ['bounced', 'complained'].includes(l.status)).length
  const opened          = logs.filter(l => ['opened', 'clicked'].includes(l.status)).length

  return new Response(JSON.stringify({ total, totalRecipients, delivered, bounced, opened }), {
    headers: { 'Content-Type': 'application/json', ...cors },
  })
})
