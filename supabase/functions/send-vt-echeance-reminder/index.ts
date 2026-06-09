import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL')     ?? 'Free Energy <noreply@free-energy.re>'
const APP_URL        = Deno.env.get('APP_URL')        ?? 'https://app.free-energy.re'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildReminderHtml(caName: string, clientName: string, commercial: string) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:#0f172a;padding:24px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Free Energy</p>
            <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Rappel — Échéance de la visite technique</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#1e293b;">Bonjour ${caName},</p>

            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
              L'échéance de la visite technique pour le dossier de
              <strong style="color:#0f172a;">${clientName}</strong> est <strong>demain</strong>,
              et aucune action n'a encore été enregistrée sur ce dossier.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#fffbeb;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 16px;">
                  <p style="margin:0;font-size:14px;font-weight:700;color:#b45309;">⏳ Échéance proche</p>
                  <p style="margin:8px 0 0;font-size:13.5px;color:#92400e;line-height:1.7;">
                    Merci de vérifier l'avancement du dossier et de renseigner, le cas échéant,
                    la <strong>date prévisionnelle</strong> ou le <strong>retour de la visite technique</strong>
                    avant l'échéance.
                  </p>
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#f59e0b;border-radius:8px;">
                  <a href="${APP_URL}" target="_blank"
                    style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;">
                    Accéder au dossier →
                  </a>
                </td>
              </tr>
            </table>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;overflow:hidden;">
              <tr><td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Dossier concerné</p>
              </td></tr>
              <tr><td style="padding:14px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:3px 0;font-size:13px;color:#64748b;width:140px;">Client</td>
                    <td style="padding:3px 0;font-size:13px;color:#1e293b;font-weight:600;">${clientName}</td>
                  </tr>
                  <tr>
                    <td style="padding:3px 0;font-size:13px;color:#64748b;">Commercial</td>
                    <td style="padding:3px 0;font-size:13px;color:#1e293b;">${commercial || '—'}</td>
                  </tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>

        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Rappel automatique J+6 (veille de l'échéance) — Application Free Energy. Ne pas répondre.</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // Dossiers créés il y a 6 jours en heure La Réunion (UTC+4) — l'échéance
  // (DATE_DDE_VT + 7) tombe donc demain
  const reunionOffset = 4 * 60 * 60 * 1000
  const reunionNow = new Date(Date.now() + reunionOffset)
  const d6 = new Date(reunionNow)
  d6.setDate(d6.getDate() - 6)
  const dateJ6 = d6.toISOString().split('T')[0] // YYYY-MM-DD

  const { data: requests, error } = await supabase
    .from('vt_requests')
    .select('*')
    .gte('created_at', dateJ6 + 'T00:00:00+04:00')
    .lte('created_at', dateJ6 + 'T23:59:59+04:00')
    .is('date_retour_vt', null)
    .not('charges_affaires', 'is', null)

  if (error || !requests?.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'Aucun dossier à échéance demain' }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  let sent = 0
  for (const req of requests) {
    // Résoudre l'email du CA : depuis vt_requests en priorité,
    // sinon chercher dans profiles par nom complet
    let caEmail = req.ca_email || null
    if (!caEmail && req.charges_affaires) {
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('identifiant, prenom, nom')
        .eq('role', 'technique')
      const match = (allProfiles || []).find((p: any) => {
        const fullName = [p.prenom, p.nom].filter(Boolean).join(' ')
        return fullName === req.charges_affaires
      })
      caEmail = match?.identifiant || null
    }
    if (!caEmail) continue

    const clientName = [req.prenom, req.nom].filter(Boolean).join(' ') || 'Client inconnu'
    const caName     = req.charges_affaires || 'Chargé d\'affaires'
    const html       = buildReminderHtml(caName, clientName, req.commercial || '')
    const subject    = `⏳ Échéance demain — ${clientName}`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [caEmail], subject, html }),
    })

    if (resendRes.ok) {
      const data = await resendRes.json()
      await supabase.from('email_logs').insert({
        resend_id:       data.id ?? null,
        template_name:   'vt_echeance_reminder_j6',
        recipient_count: 1,
        subject,
        status:          data.id ? 'sent' : 'error',
      })
      sent++
    }
  }

  return new Response(JSON.stringify({ sent, total: requests.length }), {
    headers: { 'Content-Type': 'application/json', ...cors },
  })
})
