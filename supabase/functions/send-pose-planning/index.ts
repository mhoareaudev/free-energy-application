import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL')     ?? 'Free Energy <noreply@free-energy.re>'
const APP_URL        = Deno.env.get('APP_URL')        ?? 'https://app.free-energy.re'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Même algorithme que sheetsConfig.js ──────────────────────────
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

// ── Colonnes dans l'ordre exact de sheetsConfig.js ───────────────

const BTOC_COMPTANT_IDS = [
  // frozen
  'COMMERCIAL', 'OBJECTIF', 'Colonne1',
  // Progression prospect
  'RDV_PRIS_LE', 'RDV_PERDU', 'SIGNATURE_POTENTIELLE', 'PUISSANCE_PREVI', 'PUISSANCE_REALISEE',
  'SIGNE_LE', 'MEMOS_TECHNIQUE', 'CONTRAT_MAINTENANCE', 'VENTES_PRIVEES', 'NUITS_ROCHES_NOIR', 'DATE_TRANSMISSION',
  // Coordonnées clients
  'TYPE_CONTACT', 'ADRESSE_INSTALLATION', 'VILLE', 'CODE_POSTAL', 'TYPE_PRODUIT', 'TELEPHONE', 'EMAIL',
  // Admin
  'RECEPTION_BDC', 'ENREGISTREMENT_ADMIN',
  // Règlement
  'TOTAL_TTC', 'RESTE_ENCAISSER', 'ACOMPTE_1', 'ACOMPTE_2', 'ACOMPTE_3', 'SOLDE', 'FINANCEMENT',
  'DATE_ACCEPTATION', 'N_AUTORISATION', 'ETAT_DOSSIER_CMOI', 'DATE_DDE_PAIEMENT', 'DATE_PAIEMENT',
  // Avancement du dossier
  'DATE_DDE_VT', 'ECHEANCE', 'DATE_PREV_VT', 'DATE_RETOUR_VT', 'CHARGES_AFFAIRES', 'DEMANDE_DP',
  'N_DP', 'RECEPTION_CNO', 'ETAT_DOSSIER', 'DATE_PREV_POSE', 'DATE_REELLE_POSE', 'POSEUR', 'PHOTOS',
  'ATTESTATION_ASSURANCE', 'DDE_RACC_EDF', 'N_SUIVI_EDF', 'T0_REVENTE', 'N_CRAE', 'DDE_SUBVENTION',
  'NUMERO_DOSSIER', 'DATE_VALIDER_SUB', 'FIN_VALIDATION_SUB', 'DDE_CONSUEL', 'CONSUEL_VISE',
  'T0_AUTO_CONSO', 'DDE_MES_EDF', 'MES_EDF',
  // Monophase
  'MONO_OND_3KW', 'MONO_OND_6KW', 'MONO_BATTERIE', 'MONO_SMGUARD',
  // Triphase
  'TRI_OND_3KW', 'TRI_OND_6KW', 'TRI_STOCKAGE', 'TRI_SMGUARD',
]

const BTOC_ABONNEMENT_IDS = [
  // frozen
  'COMMERCIAL', 'OBJECTIF', 'NOM_PRENOM',
  // Progression prospect
  'RDV_PRIS_LE', 'RDV_PERDU', 'SIGNATURE_POTENTIELLE', 'ETAT_DOSSIER_ADMIN', 'PUISSANCE_REALISEE', 'SIGNE_LE',
  // Commentaires
  'OFFRE_CHOISIE', 'OPTION_CONFORT', 'MEMOS_TECHNIQUE', 'VENTES_PRIVEES',
  // Coordonnées clients
  'TYPE_CONTACT', 'ADRESSE_INSTALLATION', 'VILLE', 'CODE_POSTAL', 'TYPE_PRODUIT', 'TELEPHONE', 'EMAIL',
  // Admin
  'RECEPTION_BDC', 'ENREGISTREMENT_ADMIN',
  // Informations règlements
  'INFO_COL1', 'MONTANT_DEPOT_GARANTIE', 'DATE_ENCAISSEMENT', 'DDE_SUBVENTION', 'DATE_VALIDER_SUB',
  'FIN_VALIDATION_SUB', 'MONTANT_PRIME_REGION', 'DATE_PAIEMENT_PRIME_REGION', 'MONTANT_PRIME_PK',
  'DATE_PAIEMENT_PRIME_PK', 'MONTANT_MENSUEL_ABT', 'MONTANT_TTC_VENTE', 'DATE_DEBUT_ABT', 'DUREE_ABT',
  'DATE_FIN_ABT', 'MONTANT_PAYE_AU',
  // Avancement du dossier
  'DATE_DDE_VT', 'DATE_PREV_VT', 'DATE_RETOUR_VT', 'CHARGES_AFFAIRES', 'DEMANDE_DP',
  'N_DP', 'RECEPTION_CNO', 'ETAT_DOSSIER', 'DATE_PREV_POSE', 'DATE_REELLE_POSE', 'POSEUR', 'PHOTOS',
  'ATTESTATION_ASSURANCE', 'ELIGIBILITE', 'DDE_RACC_EDF', 'N_SUIVI_EDF', 'T0_REVENTE', 'N_CRAE',
  'DDE_SUBVENTION2', 'NUMERO_DOSSIER', 'DATE_VALIDER_SUB2', 'FIN_VALIDATION_SUB2', 'DDE_CONSUEL',
  'CONSUEL_VISE', 'T0_AUTO_CONSO', 'DDE_MES_EDF', 'MES_EDF',
  // Monophase
  'MONO_OND_3KW', 'MONO_OND_6KW', 'MONO_BATTERIE', 'MONO_SMGUARD',
  // Triphase
  'TRI_OND_3KW', 'TRI_OND_6KW', 'TRI_BATTERIE', 'TRI_SMGUARD',
]

// Configuration par feuille
const SHEET_CONFIGS: Record<string, {
  ids: string[]
  clientId: string
  poseId: string
}> = {
  'btoc-comptant': {
    ids: BTOC_COMPTANT_IDS,
    clientId: 'Colonne1',
    poseId: 'DATE_PREV_POSE',
  },
  'btoc-abonnement': {
    ids: BTOC_ABONNEMENT_IDS,
    clientId: 'NOM_PRENOM',
    poseId: 'DATE_PREV_POSE',
  },
}

interface EligibleDossier {
  client: string
  commercial: string
  chargesAffaires: string
  adresse: string
  ville: string
  codePostal: string
  typeProduit: string
  sheetLabel: string
}

const SHEET_LABELS: Record<string, string> = {
  'btoc-comptant':   'Comptant',
  'btoc-abonnement': 'Abonnement',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // ── 1. Récupérer les destinataires administratifs ──────────────
  const { data: admins } = await supabase
    .from('profiles')
    .select('identifiant')
    .in('role', ['administratif', 'administrateur'])

  const recipients = (admins ?? []).map((a: any) => a.identifiant).filter(Boolean)
  if (!recipients.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'Aucun administratif trouvé' }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  // ── 2. Scanner chaque feuille pour les dossiers éligibles ──────
  const eligible: EligibleDossier[] = []

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

    const getValidated = (rowNum: number): Record<string, boolean> => {
      try { return JSON.parse(cells[`__validated:${rowNum}`] || '{}') } catch { return {} }
    }

    // Trouver toutes les lignes avec des données (à partir de la ligne 2)
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

      // Vérifier éligibilité : DP + RAC + VAD validés
      const validated = getValidated(rowNum)

      const dpDone  = !!get(rowNum, 'N_DP')  || validated.dp  === true
      const racDone = !!get(rowNum, 'N_SUIVI_EDF') || validated.rac === true
      const vadDone = !!get(rowNum, 'ENREGISTREMENT_ADMIN') || !!get(rowNum, 'RECEPTION_BDC') || validated.vad === true

      if (!dpDone || !racDone || !vadDone) continue

      // Vérifier qu'il n'y a pas encore de date prévisionnelle de pose
      const datePrevPose   = get(rowNum, 'DATE_PREV_POSE')
      const dateReellePose = get(rowNum, 'DATE_REELLE_POSE')
      if (datePrevPose || dateReellePose) continue

      eligible.push({
        client:          client.trim(),
        commercial:      get(rowNum, 'COMMERCIAL') || '—',
        chargesAffaires: get(rowNum, 'CHARGES_AFFAIRES') || '—',
        adresse:         [
          get(rowNum, 'ADRESSE_INSTALLATION'),
          get(rowNum, 'CODE_POSTAL'),
          get(rowNum, 'VILLE'),
        ].filter(Boolean).join(', ') || '—',
        ville:           get(rowNum, 'VILLE') || '—',
        codePostal:      get(rowNum, 'CODE_POSTAL') || '—',
        typeProduit:     get(rowNum, 'TYPE_PRODUIT') || '—',
        sheetLabel:      SHEET_LABELS[sheetId] ?? sheetId,
      })
    }
  }

  // ── 3. Construire et envoyer l'email ──────────────────────────
  const today = new Date()
  const dateStr = today.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Indian/Reunion',
  })

  const totalCount = eligible.length

  if (totalCount === 0) {
    // Pas de dossiers éligibles → email informatif quand même
    const html = buildEmailHtml(dateStr, [])
    await sendEmail(recipients, `📅 Planning pose — Aucun dossier en attente (${dateStr})`, html)
    return new Response(JSON.stringify({ sent: 1, eligible: 0 }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  const html = buildEmailHtml(dateStr, eligible)
  const subject = `📅 Planning pose — ${totalCount} dossier${totalCount > 1 ? 's' : ''} éligible${totalCount > 1 ? 's' : ''} sans date (${dateStr})`

  await sendEmail(recipients, subject, html)

  // Logger
  await supabase.from('email_logs').insert({
    template_name:   'pose_planning_weekly',
    recipient_count: recipients.length,
    subject,
    status:          'sent',
  }).catch(() => {})

  return new Response(JSON.stringify({ sent: 1, eligible: totalCount, recipients: recipients.length }), {
    headers: { 'Content-Type': 'application/json', ...cors },
  })
})

// ── Helpers ───────────────────────────────────────────────────────

async function sendEmail(to: string[], subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error: ${err}`)
  }
}

function buildEmailHtml(dateStr: string, dossiers: EligibleDossier[]): string {
  const count = dossiers.length

  const rowsHtml = dossiers.map((d, i) => `
    <tr style="background:${i % 2 === 0 ? '#ffffff' : '#f8fafc'};">
      <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#1e293b;border-bottom:1px solid #f1f5f9;">${d.client}</td>
      <td style="padding:10px 14px;font-size:13px;color:#475569;border-bottom:1px solid #f1f5f9;">${d.chargesAffaires}</td>
      <td style="padding:10px 14px;font-size:13px;color:#475569;border-bottom:1px solid #f1f5f9;">${d.commercial}</td>
      <td style="padding:10px 14px;font-size:13px;color:#475569;border-bottom:1px solid #f1f5f9;">${d.adresse}</td>
      <td style="padding:10px 14px;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;">${d.typeProduit}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;">
        <span style="background:#eff6ff;color:#3b82f6;font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;">${d.sheetLabel}</span>
      </td>
    </tr>
  `).join('')

  const tableHtml = count > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;">
      <thead>
        <tr style="background:#0f172a;">
          <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:0.06em;">Client</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:0.06em;">Chargé d'affaires</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:0.06em;">Commercial</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:0.06em;">Adresse</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:0.06em;">Produit</th>
          <th style="padding:10px 14px;font-size:11px;font-weight:700;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:0.06em;">Contrat</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  ` : `
    <div style="text-align:center;padding:32px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
      <p style="margin:0;font-size:15px;font-weight:600;color:#16a34a;">✅ Tous les dossiers éligibles ont une date de pose planifiée !</p>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b;">Aucun dossier en attente cette semaine.</p>
    </div>
  `

  const bannerColor  = count > 0 ? '#f97316' : '#16a34a'
  const bannerText   = count > 0
    ? `${count} dossier${count > 1 ? 's' : ''} éligible${count > 1 ? 's' : ''} à la pose — sans date planifiée`
    : 'Aucun dossier en attente cette semaine'

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0f172a;padding:24px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Free Energy</p>
            <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Récapitulatif planning de pose — Jeudi matin</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 6px;font-size:13px;color:#94a3b8;text-transform:capitalize;">${dateStr}</p>
            <p style="margin:0 0 24px;font-size:15px;color:#1e293b;">Bonjour,</p>

            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
              Voici la liste des dossiers dont <strong>toutes les démarches administratives sont validées</strong>
              (DP ✓ · RAC ✓ · VAD ✓) mais qui <strong>n'ont pas encore de date prévisionnelle de pose</strong>.
            </p>

            <!-- Compteur banner -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:${bannerColor};border-radius:8px;padding:14px 20px;">
                  <p style="margin:0;font-size:15px;font-weight:700;color:#ffffff;">📅 ${bannerText}</p>
                </td>
              </tr>
            </table>

            ${tableHtml}

            ${count > 0 ? `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
              <tr>
                <td style="background:#f0fdf4;border-left:4px solid #16a34a;border-radius:6px;padding:14px 16px;">
                  <p style="margin:0;font-size:13.5px;color:#166534;line-height:1.7;">
                    <strong>Action :</strong> Pour chacun de ces dossiers, convenir d'une date de pose avec le client
                    et la renseigner dans l'application (colonne <em>Date prévisionnelle de pose</em>).
                  </p>
                </td>
              </tr>
            </table>
            ` : ''}

            <table cellpadding="0" cellspacing="0" style="margin-top:24px;">
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
              Récapitulatif automatique envoyé chaque jeudi à 8h — Application Free Energy.<br>
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
