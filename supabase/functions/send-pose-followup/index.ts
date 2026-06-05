import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL')     ?? 'Free Energy <noreply@free-energy.re>'
const APP_URL        = Deno.env.get('APP_URL')        ?? 'https://app.free-energy.re'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getColumnLetter(index: number): string {
  let letter = ''
  let num = index
  while (num >= 0) {
    letter = String.fromCharCode((num % 26) + 65) + letter
    num = Math.floor(num / 26) - 1
  }
  return letter
}

function buildColMap(ids: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  ids.forEach((id, i) => { map[id] = getColumnLetter(i) })
  return map
}

const BTOC_COMPTANT_IDS = [
  'COMMERCIAL', 'OBJECTIF', 'Colonne1',
  'RDV_PRIS_LE', 'RDV_PERDU', 'SIGNATURE_POTENTIELLE', 'PUISSANCE_PREVI', 'PUISSANCE_REALISEE',
  'SIGNE_LE', 'MEMOS_TECHNIQUE', 'CONTRAT_MAINTENANCE', 'VENTES_PRIVEES', 'NUITS_ROCHES_NOIR', 'DATE_TRANSMISSION',
  'TYPE_CONTACT', 'ADRESSE_INSTALLATION', 'VILLE', 'CODE_POSTAL', 'TYPE_PRODUIT', 'TELEPHONE', 'EMAIL',
  'RECEPTION_BDC', 'ENREGISTREMENT_ADMIN',
  'TOTAL_TTC', 'RESTE_ENCAISSER', 'ACOMPTE_1', 'ACOMPTE_2', 'ACOMPTE_3', 'SOLDE', 'FINANCEMENT',
  'DATE_ACCEPTATION', 'N_AUTORISATION', 'ETAT_DOSSIER_CMOI', 'DATE_DDE_PAIEMENT', 'DATE_PAIEMENT',
  'DATE_DDE_VT', 'ECHEANCE', 'DATE_PREV_VT', 'DATE_RETOUR_VT', 'CHARGES_AFFAIRES', 'DEMANDE_DP',
  'N_DP', 'RECEPTION_CNO', 'ETAT_DOSSIER', 'DATE_PREV_POSE', 'DATE_REELLE_POSE', 'POSEUR', 'PHOTOS',
  'ATTESTATION_ASSURANCE', 'DDE_RACC_EDF', 'N_SUIVI_EDF', 'T0_REVENTE', 'N_CRAE', 'DDE_SUBVENTION',
  'NUMERO_DOSSIER', 'DATE_VALIDER_SUB', 'FIN_VALIDATION_SUB', 'DDE_CONSUEL', 'CONSUEL_VISE',
  'T0_AUTO_CONSO', 'DDE_MES_EDF', 'MES_EDF',
  'MONO_OND_3KW', 'MONO_OND_6KW', 'MONO_BATTERIE', 'MONO_SMGUARD',
  'TRI_OND_3KW', 'TRI_OND_6KW', 'TRI_STOCKAGE', 'TRI_SMGUARD',
]

const BTOC_ABONNEMENT_IDS = [
  'COMMERCIAL', 'OBJECTIF', 'NOM_PRENOM',
  'RDV_PRIS_LE', 'RDV_PERDU', 'SIGNATURE_POTENTIELLE', 'ETAT_DOSSIER_ADMIN', 'PUISSANCE_REALISEE', 'SIGNE_LE',
  'OFFRE_CHOISIE', 'OPTION_CONFORT', 'MEMOS_TECHNIQUE', 'VENTES_PRIVEES',
  'TYPE_CONTACT', 'ADRESSE_INSTALLATION', 'VILLE', 'CODE_POSTAL', 'TYPE_PRODUIT', 'TELEPHONE', 'EMAIL',
  'RECEPTION_BDC', 'ENREGISTREMENT_ADMIN',
  'INFO_COL1', 'MONTANT_DEPOT_GARANTIE', 'DATE_ENCAISSEMENT', 'DDE_SUBVENTION', 'DATE_VALIDER_SUB',
  'FIN_VALIDATION_SUB', 'MONTANT_PRIME_REGION', 'DATE_PAIEMENT_PRIME_REGION', 'MONTANT_PRIME_PK',
  'DATE_PAIEMENT_PRIME_PK', 'MONTANT_MENSUEL_ABT', 'MONTANT_TTC_VENTE', 'DATE_DEBUT_ABT', 'DUREE_ABT',
  'DATE_FIN_ABT', 'MONTANT_PAYE_AU',
  'DATE_DDE_VT', 'DATE_PREV_VT', 'DATE_RETOUR_VT', 'CHARGES_AFFAIRES', 'DEMANDE_DP',
  'N_DP', 'RECEPTION_CNO', 'ETAT_DOSSIER', 'DATE_PREV_POSE', 'DATE_REELLE_POSE', 'POSEUR', 'PHOTOS',
  'ATTESTATION_ASSURANCE', 'ELIGIBILITE', 'DDE_RACC_EDF', 'N_SUIVI_EDF', 'T0_REVENTE', 'N_CRAE',
  'DDE_SUBVENTION2', 'NUMERO_DOSSIER', 'DATE_VALIDER_SUB2', 'FIN_VALIDATION_SUB2', 'DDE_CONSUEL',
  'CONSUEL_VISE', 'T0_AUTO_CONSO', 'DDE_MES_EDF', 'MES_EDF',
  'MONO_OND_3KW', 'MONO_OND_6KW', 'MONO_BATTERIE', 'MONO_SMGUARD',
  'TRI_OND_3KW', 'TRI_OND_6KW', 'TRI_BATTERIE', 'TRI_SMGUARD',
]

const SHEET_CONFIGS: Record<string, { ids: string[]; clientId: string }> = {
  'btoc-comptant':   { ids: BTOC_COMPTANT_IDS,   clientId: 'Colonne1' },
  'btoc-abonnement': { ids: BTOC_ABONNEMENT_IDS, clientId: 'NOM_PRENOM' },
}

const SHEET_LABELS: Record<string, string> = {
  'btoc-comptant':   'Comptant',
  'btoc-abonnement': 'Abonnement',
}

function parseDate(val: string): Date | null {
  if (!val?.trim()) return null
  // Essai ISO (2025-03-15) ou FR (15/03/2025)
  const iso = new Date(val.trim())
  if (!isNaN(iso.getTime())) return iso
  const parts = val.trim().split('/')
  if (parts.length === 3) {
    const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  let totalSent = 0
  let totalSkipped = 0

  for (const [sheetId, config] of Object.entries(SHEET_CONFIGS)) {
    const { data: sheetRow } = await supabase
      .from('sheets')
      .select('data')
      .eq('sheet_id', sheetId)
      .single()

    if (!sheetRow?.data) continue

    const cells: Record<string, string> = sheetRow.data.cells ?? sheetRow.data ?? {}
    const colMap = buildColMap(config.ids)

    const get = (rowNum: number, colId: string): string => {
      const letter = colMap[colId]
      if (!letter) return ''
      return cells[`${letter}${rowNum}`] ?? ''
    }

    const rowNums = new Set<number>()
    for (const key of Object.keys(cells)) {
      if (key.startsWith('__')) continue
      const match = key.match(/^[A-Z]+(\d+)$/)
      if (match) {
        const num = parseInt(match[1])
        if (num >= 2) rowNums.add(num)
      }
    }

    for (const rowNum of rowNums) {
      const client = get(rowNum, config.clientId)
      if (!client?.trim()) continue

      // Vérifier que DATE_PREV_POSE est renseignée
      const datePrevRaw = get(rowNum, 'DATE_PREV_POSE')
      const datePrev = parseDate(datePrevRaw)
      if (!datePrev) continue

      // Vérifier que J+2 est atteint (et on ne dépasse pas J+30 pour éviter le spam)
      const diffDays = Math.floor((today.getTime() - datePrev.getTime()) / 86400000)
      if (diffDays < 2 || diffDays > 30) continue

      // Vérifier qu'aucune des infos post-pose n'est renseignée
      const dateReelle       = get(rowNum, 'DATE_REELLE_POSE')
      const poseur           = get(rowNum, 'POSEUR')
      const photos           = get(rowNum, 'PHOTOS')
      const attestation      = get(rowNum, 'ATTESTATION_ASSURANCE')
      if (dateReelle || poseur || photos || attestation) continue

      // Clé de dédup pour ce dossier
      const dossierRef = `pose_followup:${sheetId}:${rowNum}`

      // Vérifier qu'on n'a pas déjà envoyé ce mail
      const { data: alreadySent } = await supabase
        .from('email_logs')
        .select('id')
        .eq('dossier_ref', dossierRef)
        .limit(1)
        .maybeSingle()

      if (alreadySent) {
        totalSkipped++
        continue
      }

      // Récupérer l'email du chargé d'affaires
      const caName = get(rowNum, 'CHARGES_AFFAIRES')?.trim()
      if (!caName) continue

      const { data: caProfile } = await supabase
        .from('profiles')
        .select('identifiant')
        .ilike('full_name', `%${caName}%`)
        .limit(1)
        .maybeSingle()

      const caEmail = caProfile?.identifiant
      if (!caEmail) continue

      // Construire et envoyer l'email
      const subject = `⚠️ Pose non renseignée — ${client.trim()}`
      const html = buildEmailHtml({
        client:      client.trim(),
        datePrev:    datePrev.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
        diffDays,
        caName,
        sheetLabel:  SHEET_LABELS[sheetId] ?? sheetId,
        commercial:  get(rowNum, 'COMMERCIAL') || '—',
        adresse:     [get(rowNum, 'ADRESSE_INSTALLATION'), get(rowNum, 'CODE_POSTAL'), get(rowNum, 'VILLE')].filter(Boolean).join(', ') || '—',
        typeProduit: get(rowNum, 'TYPE_PRODUIT') || '—',
      })

      await sendEmail(caEmail, subject, html)

      // Logger avec la clé de dédup
      await supabase.from('email_logs').insert({
        template_name:   'pose_followup',
        dossier_ref:     dossierRef,
        recipient_count: 1,
        subject,
        status:          'sent',
      }).catch(() => {})

      totalSent++
    }
  }

  return new Response(JSON.stringify({ sent: totalSent, skipped: totalSkipped }), {
    headers: { 'Content-Type': 'application/json', ...cors },
  })
})

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error: ${err}`)
  }
}

interface EmailData {
  client: string
  datePrev: string
  diffDays: number
  caName: string
  sheetLabel: string
  commercial: string
  adresse: string
  typeProduit: string
}

function buildEmailHtml(d: EmailData): string {
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
            <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Rappel — Informations de pose manquantes</p>
          </td>
        </tr>

        <!-- Alerte banner -->
        <tr>
          <td style="background:#f97316;padding:14px 32px;">
            <p style="margin:0;font-size:14px;font-weight:700;color:#ffffff;">
              ⚠️ Date prévisionnelle de pose dépassée depuis ${d.diffDays} jour${d.diffDays > 1 ? 's' : ''}
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#1e293b;">Bonjour ${d.caName},</p>

            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
              La date prévisionnelle de pose du dossier <strong>${d.client}</strong>
              était le <strong>${d.datePrev}</strong>, mais les informations post-installation
              ne sont pas encore renseignées dans l'application.
            </p>

            <!-- Infos dossier -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <tr style="background:#f8fafc;">
                <td style="padding:10px 16px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;width:40%;">Client</td>
                <td style="padding:10px 16px;font-size:14px;font-weight:600;color:#1e293b;">${d.client}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid #f1f5f9;">Adresse</td>
                <td style="padding:10px 16px;font-size:14px;color:#374151;border-top:1px solid #f1f5f9;">${d.adresse}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:10px 16px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid #f1f5f9;">Produit</td>
                <td style="padding:10px 16px;font-size:14px;color:#374151;border-top:1px solid #f1f5f9;">${d.typeProduit}</td>
              </tr>
              <tr>
                <td style="padding:10px 16px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid #f1f5f9;">Commercial</td>
                <td style="padding:10px 16px;font-size:14px;color:#374151;border-top:1px solid #f1f5f9;">${d.commercial}</td>
              </tr>
              <tr style="background:#f8fafc;">
                <td style="padding:10px 16px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid #f1f5f9;">Contrat</td>
                <td style="padding:10px 16px;font-size:14px;color:#374151;border-top:1px solid #f1f5f9;">
                  <span style="background:#eff6ff;color:#3b82f6;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;">${d.sheetLabel}</span>
                </td>
              </tr>
            </table>

            <!-- Checklist -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:6px;padding:16px 20px;">
                  <p style="margin:0 0 10px;font-size:13.5px;font-weight:700;color:#92400e;">Informations à renseigner dans l'application :</p>
                  <table cellpadding="0" cellspacing="0">
                    <tr><td style="padding:3px 0;font-size:13.5px;color:#78350f;">□&nbsp;&nbsp;Date réelle de pose</td></tr>
                    <tr><td style="padding:3px 0;font-size:13.5px;color:#78350f;">□&nbsp;&nbsp;Poseur(s)</td></tr>
                    <tr><td style="padding:3px 0;font-size:13.5px;color:#78350f;">□&nbsp;&nbsp;Photos de l'installation</td></tr>
                    <tr><td style="padding:3px 0;font-size:13.5px;color:#78350f;">□&nbsp;&nbsp;Attestation d'assurance</td></tr>
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#f97316;border-radius:8px;">
                  <a href="${APP_URL}" target="_blank"
                    style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;">
                    Ouvrir l'application →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              Ce rappel a été envoyé automatiquement J+2 après la date prévisionnelle de pose.<br>
              Il ne sera plus envoyé une fois les informations complétées.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`
}
