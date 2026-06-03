import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL')     ?? 'Free Energy <noreply@free-energy.re>'
const APP_URL        = Deno.env.get('APP_URL')        ?? 'https://app.free-energy.re'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildReminderHtml(nom: string, prenom: string, commercial: string) {
  const clientName = [prenom, nom].filter(Boolean).join(' ') || 'Client inconnu'
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:24px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Free Energy</p>
            <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Rappel automatique J+2</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#1e293b;">Bonjour,</p>

            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
              Ceci est un rappel : le dossier de <strong style="color:#0f172a;">${clientName}</strong>
              (suivi par <strong>${commercial || '—'}</strong>) n'a toujours pas de
              <strong>chargé d'affaires</strong> assigné, 2 jours après la création de la demande de VT.
            </p>

            <!-- Alert box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;padding:14px 16px;">
                  <p style="margin:0;font-size:14px;font-weight:700;color:#dc2626;">⚠️ Action requise</p>
                  <p style="margin:6px 0 0;font-size:13.5px;color:#991b1b;line-height:1.6;">
                    Veuillez assigner un <strong>chargé d'affaires</strong> à ce dossier dès que possible
                    pour que les démarches puissent avancer.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
              Connectez-vous à l'application pour accéder au dossier et l'assigner :
            </p>

            <!-- Button -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#dc2626;border-radius:8px;">
                  <a href="${APP_URL}" target="_blank"
                    style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">
                    Accéder au dossier →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Dossier info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;overflow:hidden;">
              <tr><td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Dossier concerné</p>
              </td></tr>
              <tr><td style="padding:14px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:3px 0;font-size:13px;color:#64748b;width:120px;">Client</td>
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

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              Rappel automatique envoyé à J+2 par l'application Free Energy.<br>
              Ne pas répondre à cet email.
            </p>
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

  // Dossiers créés entre 48h et 72h ago (fenêtre J+2)
  const now = new Date()
  const from = new Date(now.getTime() - 72 * 60 * 60 * 1000).toISOString()
  const to   = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()

  const { data: requests, error } = await supabase
    .from('vt_requests')
    .select('*')
    .gte('created_at', from)
    .lte('created_at', to)
    .is('charges_affaires', null)  // pas encore assigné
    .neq('status', 'assigned')

  if (error || !requests?.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'Aucun dossier sans CA à J+2' }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  // Récupérer les techniciens
  const { data: technicians } = await supabase
    .from('profiles')
    .select('identifiant')
    .eq('role', 'technique')

  const to_emails = (technicians || []).map((t: any) => t.identifiant).filter(Boolean)
  if (!to_emails.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'Aucun technicien trouvé' }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  let sent = 0
  for (const req of requests) {
    const html    = buildReminderHtml(req.nom || '', req.prenom || '', req.commercial || '')
    const subject = `⚠️ Rappel J+2 — Chargé d'affaires manquant : ${[req.prenom, req.nom].filter(Boolean).join(' ') || 'Client'}`

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: to_emails, subject, html }),
    })

    if (resendRes.ok) {
      const data = await resendRes.json()
      // Logger l'envoi
      await supabase.from('email_logs').insert({
        resend_id:       data.id ?? null,
        template_name:   'vt_reminder_j2',
        recipient_count: to_emails.length,
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
