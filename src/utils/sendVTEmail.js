import { supabaseGet, supabasePost, supabaseInvoke } from '../lib/supabase'

const APP_URL = import.meta.env.VITE_APP_URL || 'http://localhost:5173'

function buildVTEmailHtml(vars) {
  const nom = vars.nom_client || '—'
  const commercial = vars.commercial || '—'
  const adresse = [vars.adresse, vars.code_postal, vars.ville].filter(Boolean).join(', ') || '—'
  const tel = vars.telephone || '—'
  const contrat = vars.type_contrat || '—'
  const puissance = vars.puissance ? `${vars.puissance} kWc` : '—'

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
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Free Energy</p>
            <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Système de gestion des dossiers</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#1e293b;">Bonjour,</p>

            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
              Une nouvelle demande de visite technique vient d'être enregistrée pour
              <strong style="color:#0f172a;">${nom}</strong>.
              Merci de la prendre en charge dès que possible.
            </p>

            <!-- Alert box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;padding:14px 16px;">
                  <p style="margin:0;font-size:14px;font-weight:700;color:#dc2626;">⚠️ Important</p>
                  <p style="margin:6px 0 0;font-size:13.5px;color:#991b1b;line-height:1.6;">
                    N'oubliez pas d'assigner un <strong>chargé d'affaires</strong> à ce dossier avant de démarrer les démarches.
                    Sans assignation dans l'application, un rappel automatique vous sera envoyé <strong>à J+2</strong>.
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
              Pour accéder au dossier et démarrer les démarches, connectez-vous à l'application :
            </p>

            <!-- Button -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#f97316;border-radius:8px;">
                  <a href="${APP_URL}" target="_blank"
                    style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.01em;">
                    Accéder à l'application →
                  </a>
                </td>
              </tr>
            </table>

            <!-- Dossier details -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;overflow:hidden;">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
                  <p style="margin:0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Détails du dossier</p>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;vertical-align:top;">Client</td>
                      <td style="padding:4px 0;font-size:13px;color:#1e293b;font-weight:600;">${nom}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#64748b;">Commercial</td>
                      <td style="padding:4px 0;font-size:13px;color:#1e293b;">${commercial}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#64748b;">Adresse</td>
                      <td style="padding:4px 0;font-size:13px;color:#1e293b;">${adresse}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#64748b;">Téléphone</td>
                      <td style="padding:4px 0;font-size:13px;color:#1e293b;">${tel}</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 0;font-size:13px;color:#64748b;">Type de contrat</td>
                      <td style="padding:4px 0;font-size:13px;color:#1e293b;">${contrat}</td>
                    </tr>
                    ${puissance !== '—' ? `<tr>
                      <td style="padding:4px 0;font-size:13px;color:#64748b;">Puissance</td>
                      <td style="padding:4px 0;font-size:13px;color:#1e293b;">${puissance}</td>
                    </tr>` : ''}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              Cet email a été envoyé automatiquement par l'application Free Energy.<br>
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

export async function sendVTRequestEmail(vars) {
  const technicians = await supabaseGet('profiles', { role: 'eq.technique', select: 'identifiant' })

  const to = (technicians || []).map(t => t.identifiant).filter(Boolean)
  if (to.length === 0) {
    console.warn('sendVTEmail: aucun technicien avec role=technique trouvé')
    return
  }

  console.log('sendVTEmail: envoi à', to)

  const subject = `Nouvelle demande de VT — ${vars.nom_client || 'Client'}`
  const html    = buildVTEmailHtml(vars)

  const result = await supabaseInvoke('send-email', { to, subject, html })
  console.log('sendVTEmail: résultat invoke', result)

  supabasePost('email_logs', {
    resend_id:       result?.id ?? null,
    template_name:   'vt_request',
    recipient_count: to.length,
    subject,
    status:          result?.id ? 'sent' : 'error',
  }).catch(err => console.warn('email_logs insert failed:', err))
}
