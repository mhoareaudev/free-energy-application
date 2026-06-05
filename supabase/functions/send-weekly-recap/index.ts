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

interface DossierLine {
  client: string
  issues: string[]
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  // ── 1. Charger le sheet btoc-comptant ──────────────────────────
  const { data: sheetRow } = await supabase
    .from('sheets').select('data').eq('sheet_id', 'btoc-comptant').single()

  if (!sheetRow?.data) {
    return new Response(JSON.stringify({ error: 'Sheet introuvable' }), {
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  }

  const cells: Record<string, string> = sheetRow.data.cells ?? sheetRow.data ?? {}
  const colMap = buildColMap(BTOC_COMPTANT_IDS)

  const get = (rowNum: number, colId: string): string => {
    const letter = colMap[colId]
    if (!letter) return ''
    return cells[`${letter}${rowNum}`] ?? ''
  }

  const getValidated = (rowNum: number): Record<string, boolean> => {
    try { return JSON.parse(cells[`__validated:${rowNum}`] || '{}') } catch { return {} }
  }

  // ── 2. Charger la nomenclature depuis vt_requests ──────────────
  const { data: vtRequests } = await supabase
    .from('vt_requests')
    .select('nom, prenom, nomenclature_validated_at')

  const nomenclatureValidated = new Set<string>()
  for (const vt of vtRequests ?? []) {
    if (vt.nomenclature_validated_at) {
      const name = [vt.prenom, vt.nom].filter(Boolean).join(' ').toLowerCase().trim()
      if (name) nomenclatureValidated.add(name)
    }
  }

  // ── 3. Charger les profils ─────────────────────────────────────
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('identifiant, full_name, role')

  const caProfiles  = (allProfiles ?? []).filter((p: any) => p.role === 'technique')
  const adminEmails = (allProfiles ?? [])
    .filter((p: any) => ['administratif', 'administrateur'].includes(p.role))
    .map((p: any) => p.identifiant)
    .filter(Boolean)

  // ── 4. Trouver les lignes du sheet ────────────────────────────
  const rowNums = new Set<number>()
  for (const key of Object.keys(cells)) {
    if (key.startsWith('__')) continue
    const match = key.match(/^[A-Z]+(\d+)$/)
    if (match) {
      const num = parseInt(match[1])
      if (num >= 2) rowNums.add(num)
    }
  }

  // ── 5. Analyser chaque dossier ────────────────────────────────
  const unassignedClients: string[] = []

  // caIssuesMap: caName → liste de { client, issues }
  const caIssuesMap: Record<string, DossierLine[]> = {}
  const adminIssuesList: DossierLine[] = []

  for (const rowNum of rowNums) {
    const client = get(rowNum, 'Colonne1')?.trim()
    if (!client) continue

    const caName         = get(rowNum, 'CHARGES_AFFAIRES')?.trim()
    const validated      = getValidated(rowNum)

    const datePrevVT     = get(rowNum, 'DATE_PREV_VT')
    const dateRetourVT   = get(rowNum, 'DATE_RETOUR_VT')
    const datePrevPose   = get(rowNum, 'DATE_PREV_POSE')
    const dateReellePose = get(rowNum, 'DATE_REELLE_POSE')
    const nDp            = get(rowNum, 'N_DP')
    const nSuiviEdf      = get(rowNum, 'N_SUIVI_EDF')
    const enregAdmin     = get(rowNum, 'ENREGISTREMENT_ADMIN')
    const receptionBdc   = get(rowNum, 'RECEPTION_BDC')
    const poseur         = get(rowNum, 'POSEUR')
    const photos         = get(rowNum, 'PHOTOS')
    const attestation    = get(rowNum, 'ATTESTATION_ASSURANCE')
    const ddeConsuel     = get(rowNum, 'DDE_CONSUEL')
    const ddeMesEdf      = get(rowNum, 'DDE_MES_EDF')
    const mesEdf         = get(rowNum, 'MES_EDF')

    const vtDone  = !!dateRetourVT
    const dpDone  = !!nDp     || validated.dp  === true
    const racDone = !!nSuiviEdf || validated.rac === true
    const vadDone = !!enregAdmin || !!receptionBdc || validated.vad === true

    // Dossier sans CA → alerte commune
    if (!caName) {
      unassignedClients.push(client)
      continue
    }

    // ── Issues chargé d'affaires ──────────────────────────────
    const caIssues: string[] = []

    if (datePrevVT && !dateRetourVT) {
      caIssues.push('VT à compléter (date retour manquante)')
    }

    if (vtDone) {
      const clientLower = client.toLowerCase().trim()
      if (!nomenclatureValidated.has(clientLower)) {
        caIssues.push('Nomenclature à valider')
      }
    }

    if (datePrevPose && (!dateReellePose || !poseur || !photos || !attestation)) {
      caIssues.push('Infos de pose manquantes')
    }

    if (dateReellePose && !ddeConsuel) {
      caIssues.push('Demande Consuel à faire')
    }

    if (dateReellePose && (!ddeMesEdf || !mesEdf)) {
      caIssues.push('Infos EDF manquantes')
    }

    if (caIssues.length > 0) {
      if (!caIssuesMap[caName]) caIssuesMap[caName] = []
      caIssuesMap[caName].push({ client, issues: caIssues })
    }

    // ── Issues administratif ──────────────────────────────────
    const adminIssues: string[] = []

    if (vtDone) {
      if (!dpDone)  adminIssues.push('DP manquante')
      if (!racDone) adminIssues.push('RAC manquant')
      if (!vadDone) adminIssues.push('VAD manquant')
    }

    if (dpDone && racDone && vadDone && !datePrevPose) {
      adminIssues.push('Date de pose à planifier')
    }

    if (adminIssues.length > 0) {
      adminIssuesList.push({ client, issues: adminIssues })
    }
  }

  // ── 6. Envoi des mails CA ─────────────────────────────────────
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Indian/Reunion',
  })

  for (const caProfile of caProfiles) {
    const caName    = (caProfile as any).full_name ?? ''
    const caEmail   = (caProfile as any).identifiant
    if (!caEmail) continue

    // Matcher le nom du CA dans les sheets avec le profil
    const ownDossiers = Object.entries(caIssuesMap).find(([name]) =>
      name.toLowerCase() === caName.toLowerCase() ||
      caName.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(caName.toLowerCase())
    )?.[1] ?? []

    if (ownDossiers.length === 0 && unassignedClients.length === 0) continue

    const subject = ownDossiers.length > 0
      ? `📋 Récapitulatif lundi — ${ownDossiers.length} dossier${ownDossiers.length > 1 ? 's' : ''} en attente`
      : `📋 Récapitulatif lundi — Dossiers sans chargé d'affaires`

    const html = buildCaHtml(caName, ownDossiers, unassignedClients, dateStr)
    await sendEmail([caEmail], subject, html)
  }

  // ── 7. Envoi du mail admin ────────────────────────────────────
  if (adminIssuesList.length > 0 && adminEmails.length > 0) {
    const subject = `📋 Récapitulatif lundi — ${adminIssuesList.length} dossier${adminIssuesList.length > 1 ? 's' : ''} administratif${adminIssuesList.length > 1 ? 's' : ''} en attente`
    const html = buildAdminHtml(adminIssuesList, dateStr)
    await sendEmail(adminEmails, subject, html)
  }

  return new Response(
    JSON.stringify({
      ok: true,
      unassigned: unassignedClients.length,
      caGroupsWithIssues: Object.keys(caIssuesMap).length,
      adminIssues: adminIssuesList.length,
    }),
    { headers: { 'Content-Type': 'application/json', ...cors } }
  )
})

// ── Helpers ───────────────────────────────────────────────────────

async function sendEmail(to: string[], subject: string, html: string) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  })
  if (!res.ok) {
    const err = await res.text()
    console.error('Resend error:', err)
  }
}

function renderDossierLines(lines: { client: string; issues: string[] }[]): string {
  return lines.map(({ client, issues }) => `
    <tr>
      <td style="padding:10px 16px;font-size:13.5px;font-weight:700;color:#1e293b;border-bottom:1px solid #f1f5f9;white-space:nowrap;vertical-align:top;">
        ${client}
      </td>
      <td style="padding:10px 16px;font-size:13.5px;color:#475569;border-bottom:1px solid #f1f5f9;line-height:1.7;">
        ${issues.join(' · ')}
      </td>
    </tr>
  `).join('')
}

function buildCaHtml(caName: string, ownDossiers: DossierLine[], unassigned: string[], dateStr: string): string {
  const hasOwn      = ownDossiers.length > 0
  const hasUnassign = unassigned.length > 0

  const unassignBlock = hasUnassign ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      <tr>
        <td style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:6px;padding:14px 20px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#92400e;">
            📌 Dossiers sans chargé d'affaires assigné
          </p>
          <p style="margin:0;font-size:13.5px;color:#78350f;line-height:1.8;">
            ${unassigned.join(' · ')}
          </p>
        </td>
      </tr>
    </table>
  ` : ''

  const ownBlock = hasOwn ? `
    <p style="margin:0 0 12px;font-size:14px;font-weight:700;color:#1e293b;">Vos dossiers en attente :</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:28px;">
      <thead>
        <tr style="background:#0f172a;">
          <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;">Client</th>
          <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:0.06em;">Points en attente</th>
        </tr>
      </thead>
      <tbody>
        ${renderDossierLines(ownDossiers)}
      </tbody>
    </table>
  ` : ''

  return wrapEmail(`
    <p style="margin:0 0 20px;font-size:15px;color:#1e293b;">Bonjour ${caName},</p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
      Voici votre récapitulatif hebdomadaire des dossiers nécessitant une action de votre part.
    </p>
    ${unassignBlock}
    ${ownBlock}
  `, dateStr, 'Récapitulatif hebdomadaire — Chargé d\'affaires')
}

function buildAdminHtml(lines: DossierLine[], dateStr: string): string {
  return wrapEmail(`
    <p style="margin:0 0 20px;font-size:15px;color:#1e293b;">Bonjour,</p>
    <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
      Voici le récapitulatif hebdomadaire des dossiers nécessitant une action administrative.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:28px;">
      <thead>
        <tr style="background:#0f172a;">
          <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;">Client</th>
          <th style="padding:9px 16px;font-size:11px;font-weight:700;color:#94a3b8;text-align:left;text-transform:uppercase;letter-spacing:0.06em;">Points en attente</th>
        </tr>
      </thead>
      <tbody>
        ${renderDossierLines(lines)}
      </tbody>
    </table>
  `, dateStr, 'Récapitulatif hebdomadaire — Administratif')
}

function wrapEmail(body: string, dateStr: string, subtitle: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:#0f172a;padding:24px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Free Energy</p>
            <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">${subtitle}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 20px;font-size:13px;color:#94a3b8;text-transform:capitalize;">${dateStr}</p>
            ${body}
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

        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
              Récapitulatif automatique envoyé chaque lundi à 8h — Application Free Energy.<br>
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
