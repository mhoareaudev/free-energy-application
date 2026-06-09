import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL     = Deno.env.get('FROM_EMAIL')     ?? 'Free Energy <noreply@free-energy.re>'
const APP_URL        = Deno.env.get('APP_URL')        ?? 'https://app.free-energy.re'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Mapping offre PVLEASE → puissance envisagée (kWc) ────────────────
const OFFER_PUISSANCE: Record<string, number> = {
  PVLEASE: 3,
  PVLEASE_PLUS: 6,
  PVLEASE_MAX: 9,
}
const OFFER_LABELS: Record<string, string> = {
  PVLEASE: 'PVLEASE',
  PVLEASE_PLUS: 'PVLEASE+',
  PVLEASE_MAX: 'PVLEASE Max',
}

// ── Mapping sales_type PVLEASE → contact_type CRM ────────────────────
const SALES_TYPE_MAP: Record<string, { value: string; label: string }> = {
  reseaux_sociaux: { value: 'web',      label: 'Web / Réseaux sociaux' },
  prospection:     { value: 'terrain',  label: 'Prospection terrain'   },
  appel_entrant:   { value: 'telephone', label: 'Démarchage tél.'       },
}

// ── Ordre des colonnes de l'onglet "btoc-abonnement" ──────────────────
// (mirroir de BTOC_ABONNEMENT_COLUMNS dans src/data/sheetsConfig.js — l'ordre détermine la lettre de colonne)
const BTOC_ABONNEMENT_COLUMN_IDS = [
  'COMMERCIAL', 'OBJECTIF', 'NOM_PRENOM',
  'RDV_PRIS_LE', 'RDV_PERDU', 'SIGNATURE_POTENTIELLE', 'ETAT_DOSSIER_ADMIN', 'PUISSANCE_REALISEE', 'SIGNE_LE',
  'OFFRE_CHOISIE', 'OPTION_CONFORT', 'MEMOS_TECHNIQUE', 'VENTES_PRIVEES',
  'TYPE_CONTACT', 'ADRESSE_INSTALLATION', 'VILLE', 'CODE_POSTAL', 'TYPE_PRODUIT', 'TELEPHONE', 'EMAIL',
  'RECEPTION_BDC', 'ENREGISTREMENT_ADMIN',
  'INFO_COL1', 'MONTANT_DEPOT_GARANTIE', 'DATE_ENCAISSEMENT', 'DDE_SUBVENTION', 'DATE_VALIDER_SUB', 'FIN_VALIDATION_SUB',
  'MONTANT_PRIME_REGION', 'DATE_PAIEMENT_PRIME_REGION', 'MONTANT_PRIME_PK', 'DATE_PAIEMENT_PRIME_PK',
  'MONTANT_MENSUEL_ABT', 'MONTANT_TTC_VENTE', 'DATE_DEBUT_ABT', 'DUREE_ABT', 'DATE_FIN_ABT', 'MONTANT_PAYE_AU',
  'DATE_DDE_VT', 'DATE_PREV_VT', 'DATE_RETOUR_VT', 'CHARGES_AFFAIRES', 'DEMANDE_DP', 'N_DP', 'RECEPTION_CNO',
  'ETAT_DOSSIER', 'DATE_PREV_POSE', 'DATE_REELLE_POSE', 'POSEUR', 'PHOTOS', 'ATTESTATION_ASSURANCE', 'ELIGIBILITE',
  'DDE_RACC_EDF', 'N_SUIVI_EDF', 'T0_REVENTE', 'N_CRAE', 'DDE_SUBVENTION2', 'NUMERO_DOSSIER', 'DATE_VALIDER_SUB2',
  'FIN_VALIDATION_SUB2', 'DDE_CONSUEL', 'CONSUEL_VISE', 'T0_AUTO_CONSO', 'DDE_MES_EDF', 'MES_EDF',
  'MONO_OND_3KW', 'MONO_OND_6KW', 'MONO_BATTERIE', 'MONO_SMGUARD',
  'TRI_OND_3KW', 'TRI_OND_6KW', 'TRI_BATTERIE', 'TRI_SMGUARD',
]

function getColumnLetter(index: number): string {
  let letter = ''
  let num = index
  while (num >= 0) {
    letter = String.fromCharCode((num % 26) + 65) + letter
    num = Math.floor(num / 26) - 1
  }
  return letter
}

function buildColMap(): Record<string, string> {
  const map: Record<string, string> = {}
  BTOC_ABONNEMENT_COLUMN_IDS.forEach((id, i) => { map[id] = getColumnLetter(i) })
  return map
}

function formatDateFR(d = new Date()): string {
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function addDaysToFR(ddmmyyyy: string, n: number): string {
  const parts = ddmmyyyy.split('/')
  if (parts.length !== 3) return ''
  const d = new Date(+parts[2], +parts[1] - 1, +parts[0])
  if (isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + n)
  return formatDateFR(d)
}

function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function buildVTEmailHtml(vars: { nom_client: string; commercial: string; adresse: string; telephone: string; puissance: string }) {
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
            <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Nouvelle demande de visite technique — PVLEASE</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#1e293b;">Bonjour,</p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
              Une nouvelle demande de visite technique vient d'être enregistrée pour
              <strong style="color:#0f172a;">${vars.nom_client}</strong> (dossier validé depuis l'application PVLEASE).
              Merci de la prendre en charge dès que possible.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;padding:14px 16px;">
                  <p style="margin:0;font-size:14px;font-weight:700;color:#dc2626;">⚠️ Important</p>
                  <p style="margin:6px 0 0;font-size:13.5px;color:#991b1b;line-height:1.6;">
                    N'oubliez pas d'assigner un <strong>chargé d'affaires</strong> à ce dossier avant de démarrer les démarches.
                  </p>
                </td>
              </tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
              <tr>
                <td style="background:#f97316;border-radius:8px;">
                  <a href="${APP_URL}" target="_blank"
                    style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">
                    Accéder à l'application →
                  </a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;overflow:hidden;">
              <tr><td style="padding:16px 20px;border-bottom:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Détails du dossier</p>
              </td></tr>
              <tr><td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding:4px 0;font-size:13px;color:#64748b;width:140px;">Client</td><td style="padding:4px 0;font-size:13px;color:#1e293b;font-weight:600;">${vars.nom_client}</td></tr>
                  <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">Commercial</td><td style="padding:4px 0;font-size:13px;color:#1e293b;">${vars.commercial}</td></tr>
                  <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">Adresse</td><td style="padding:4px 0;font-size:13px;color:#1e293b;">${vars.adresse}</td></tr>
                  <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">Téléphone</td><td style="padding:4px 0;font-size:13px;color:#1e293b;">${vars.telephone}</td></tr>
                  <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">Type de contrat</td><td style="padding:4px 0;font-size:13px;color:#1e293b;">Abonnement</td></tr>
                  <tr><td style="padding:4px 0;font-size:13px;color:#64748b;">Puissance</td><td style="padding:4px 0;font-size:13px;color:#1e293b;">${vars.puissance} kWc</td></tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">Cet email a été envoyé automatiquement par l'application Free Energy. Ne pas répondre.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

interface ExternalVTPayload {
  civility?: string
  first_name: string
  last_name: string
  address: string
  postal_code: string
  commune: string
  phone: string
  email: string
  commercial_first_name: string
  commercial_last_name: string
  offer: 'PVLEASE' | 'PVLEASE_PLUS' | 'PVLEASE_MAX'
  comfort_option: boolean
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const body = (await req.json()) as ExternalVTPayload

    const required = ['first_name', 'last_name', 'address', 'postal_code', 'commune', 'phone', 'email', 'commercial_first_name', 'commercial_last_name', 'offer'] as const
    for (const key of required) {
      if (!body[key]) {
        return new Response(JSON.stringify({ error: `Champ requis manquant : ${key}` }), {
          status: 400, headers: { 'Content-Type': 'application/json', ...cors },
        })
      }
    }

    const puissance = OFFER_PUISSANCE[body.offer]
    if (!puissance) {
      return new Response(JSON.stringify({ error: `Offre inconnue : ${body.offer}` }), {
        status: 400, headers: { 'Content-Type': 'application/json', ...cors },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const clientName = `${body.first_name} ${body.last_name}`.trim()
    const today      = formatDateFR()
    const echeance   = addDaysToFR(today, 7)
    const batterie   = body.comfort_option ? 'oui' : 'non'

    // ── Résoudre le nom du commercial : on cherche une correspondance dans la table 'commerciaux' ──
    const incomingCommercialName = `${body.commercial_first_name} ${body.commercial_last_name}`.trim()
    const { data: commerciaux } = await supabase.from('commerciaux').select('id,nom,prenom')
    const match = (commerciaux || []).find((c: any) =>
      normalizeName(`${c.prenom} ${c.nom}`) === normalizeName(incomingCommercialName)
    )
    const commercialName = match ? `${match.prenom} ${match.nom}` : incomingCommercialName

    // ── Lire l'onglet "btoc-abonnement" et trouver la prochaine ligne libre ──
    const { data: sheetRow } = await supabase
      .from('sheets')
      .select('data')
      .eq('sheet_id', 'btoc-abonnement')
      .maybeSingle()

    const cells: Record<string, any> = { ...(sheetRow?.data || {}) }
    const usedRows = new Set<number>()
    Object.keys(cells).forEach(key => {
      if (key.startsWith('__')) return
      if (!cells[key]) return
      const m = key.match(/^[A-Z]+(\d+)$/)
      if (m) {
        const r = parseInt(m[1])
        if (r >= 2) usedRows.add(r)
      }
    })
    let nextRow = 2
    while (usedRows.has(nextRow)) nextRow++

    const colMap = buildColMap()
    const setCell = (colId: string, value: any) => {
      if (value !== undefined && value !== null && value !== '' && colMap[colId]) {
        cells[`${colMap[colId]}${nextRow}`] = value
      }
    }

    const contactTypeMap = SALES_TYPE_MAP[body.sales_type] ?? null

    setCell('COMMERCIAL', commercialName)
    setCell('NOM_PRENOM', clientName)
    if (contactTypeMap) setCell('TYPE_CONTACT', contactTypeMap.label)
    setCell('ADRESSE_INSTALLATION', body.address)
    setCell('VILLE', body.commune)
    setCell('CODE_POSTAL', body.postal_code)
    setCell('TELEPHONE', body.phone)
    setCell('EMAIL', body.email)
    setCell('DATE_DDE_VT', today)
    setCell('ECHEANCE', echeance)
    setCell('CHARGES_AFFAIRES', '')
    setCell('OFFRE_CHOISIE', `${OFFER_LABELS[body.offer]} (${puissance} kWc)`)
    setCell('OPTION_CONFORT', body.comfort_option ? 'Oui' : 'Non')

    // Données complètes du formulaire VT (pour génération PDF — même format que le CRM)
    const vtFormData = {
      commercial: commercialName, clientName, date: today,
      typeContrat: 'abonnement',
      puissance: String(puissance),
      adresse: body.address,
      codePostal: body.postal_code,
      commune: body.commune,
      email: body.email,
      tel: body.phone,
      reventeSurplus: '',
      contratMaintenance: '',
      batterie,
      ond3kva: 0, ond5kva: 0, ond6kva: 0, ond8kva: 0, ond9kva: 0,
    }
    cells[`__vtFormData:${nextRow}`] = JSON.stringify(vtFormData)

    const { error: sheetErr } = await supabase
      .from('sheets')
      .upsert({ sheet_id: 'btoc-abonnement', data: cells, updated_at: new Date().toISOString() }, { onConflict: 'sheet_id' })
    if (sheetErr) throw sheetErr

    const contactId = `a:${nextRow}`

    // ── contact_metadata (type de contact) ──
    if (contactTypeMap) {
      await supabase.from('contact_metadata').upsert(
        { contact_id: contactId, contact_type: contactTypeMap.value, updated_at: new Date().toISOString() },
        { onConflict: 'contact_id' }
      )
    }

    // ── vt_requests ──
    const { error: vtErr } = await supabase.from('vt_requests').insert({
      nom: body.last_name,
      prenom: body.first_name,
      commercial: commercialName,
      type_client: 'btoc',
      type_contrat: 'abonnement',
      target_sheet: 'btoc-abonnement',
      contact_id: contactId,
      requested_by: null,
      status: 'pending',
    })
    if (vtErr) console.warn('vt_requests insert failed:', vtErr.message)

    // ── contact_activities ──
    const actBase = { contact_id: contactId, created_by: null, created_by_name: `${incomingCommercialName} (PVLEASE)` }
    await Promise.allSettled([
      supabase.from('contact_activities').insert({
        ...actBase, type: 'creation', title: 'Contact créé',
        body: `${clientName} a été ajouté depuis l'application PVLEASE (offre ${OFFER_LABELS[body.offer]}).`,
      }),
      supabase.from('contact_activities').insert({
        ...actBase, type: 'transaction', title: 'Transaction créée',
        body: 'Projet solaire créé — phase "VT en cours".',
      }),
      supabase.from('contact_activities').insert({
        ...actBase, type: 'pdf', title: 'Formulaire de demande VT généré',
        body: `Formulaire_VT_${clientName.replace(/\s+/g, '_')}.pdf`,
      }),
    ])

    // ── Notifications internes (tous les utilisateurs) ──
    const { data: allProfiles } = await supabase.from('profiles').select('id')
    if (Array.isArray(allProfiles)) {
      await Promise.allSettled(allProfiles.map((p: any) =>
        supabase.from('notifications').insert({
          recipient_id: p.id,
          type: 'vt_request',
          title: 'Nouvelle demande de VT (PVLEASE)',
          body: `Validée par ${incomingCommercialName} pour ${clientName}`,
          data: { target_sheet: 'btoc-abonnement' },
        })
      ))
    }

    // ── Email aux techniciens ──
    const { data: technicians } = await supabase.from('profiles').select('identifiant').eq('role', 'technique')
    const to = (technicians || []).map((t: any) => t.identifiant).filter(Boolean)
    if (to.length > 0 && RESEND_API_KEY) {
      const subject = `Nouvelle demande de VT — ${clientName}`
      const html = buildVTEmailHtml({
        nom_client: clientName,
        commercial: commercialName,
        adresse: [body.address, body.postal_code, body.commune].filter(Boolean).join(', '),
        telephone: body.phone,
        puissance: String(puissance),
      })
      const resendRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
      })
      const resendData = await resendRes.json().catch(() => null)
      await supabase.from('email_logs').insert({
        resend_id:       resendData?.id ?? null,
        template_name:   'vt_request',
        recipient_count: to.length,
        subject,
        status:          resendRes.ok ? 'sent' : 'error',
      })
    }

    return new Response(JSON.stringify({ success: true, contact_id: contactId, target_sheet: 'btoc-abonnement', commercial: commercialName }), {
      status: 200, headers: { 'Content-Type': 'application/json', ...cors },
    })
  } catch (err) {
    console.error('external-vt-request error:', err)
    return new Response(JSON.stringify({ error: 'Erreur interne lors de la création du dossier.' }), {
      status: 500, headers: { 'Content-Type': 'application/json', ...cors },
    })
  }
})
