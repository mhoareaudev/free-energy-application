import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

const Y_TOLERANCE = 8 // items within 8px of same Y are on the same row

// Normalize a string for header matching: lowercase, strip diacritics + punctuation
function normKey(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[°#'",.\-\/\\()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// PDF header text (normalized) → sheetsConfig column ID for btoc-comptant
const COMPTANT_HEADER_MAP = {
  'commercial': 'COMMERCIAL',
  'objectif': 'OBJECTIF',
  'nom prenom': 'Colonne1',
  'nom - prenom': 'Colonne1',
  'nom prenom client': 'Colonne1',
  'nom - prenom client': 'Colonne1',
  'colonne1': 'Colonne1',

  'rdv pris le': 'RDV_PRIS_LE',
  'rdv perdu': 'RDV_PERDU',
  'signature potentielle': 'SIGNATURE_POTENTIELLE',
  'puissance previ': 'PUISSANCE_PREVI',
  'puissance previsionnelle': 'PUISSANCE_PREVI',
  'puissance realisee': 'PUISSANCE_REALISEE',
  'signe le': 'SIGNE_LE',
  'memos technique': 'MEMOS_TECHNIQUE',
  'memo technique': 'MEMOS_TECHNIQUE',
  'contrat de maintenance': 'CONTRAT_MAINTENANCE',
  'contrat maintenance': 'CONTRAT_MAINTENANCE',
  'ventes privees': 'VENTES_PRIVEES',
  'nuits roches noir': 'NUITS_ROCHES_NOIR',
  'date transmission': 'DATE_TRANSMISSION',
  'date de transmission': 'DATE_TRANSMISSION',

  'type de contact': 'TYPE_CONTACT',
  'type contact': 'TYPE_CONTACT',
  'adresse installation': 'ADRESSE_INSTALLATION',
  "adresse d installation": 'ADRESSE_INSTALLATION',
  'ville': 'VILLE',
  'code postal': 'CODE_POSTAL',
  'code postale': 'CODE_POSTAL',
  'type de produit': 'TYPE_PRODUIT',
  'type produit': 'TYPE_PRODUIT',
  'telephone': 'TELEPHONE',
  'email': 'EMAIL',

  'reception bdc': 'RECEPTION_BDC',
  'reception bdc dossier': 'RECEPTION_BDC',
  'enregistrement administratif': 'ENREGISTREMENT_ADMIN',
  'enregistrement admin': 'ENREGISTREMENT_ADMIN',

  'total ttc': 'TOTAL_TTC',
  'reste a encaisser': 'RESTE_ENCAISSER',
  'acpte 1': 'ACOMPTE_1',
  'acompte 1': 'ACOMPTE_1',
  'acpte 2': 'ACOMPTE_2',
  'acompte 2': 'ACOMPTE_2',
  'acpte 3': 'ACOMPTE_3',
  'acompte 3': 'ACOMPTE_3',
  'solde': 'SOLDE',
  'financement': 'FINANCEMENT',
  "date d acceptation": 'DATE_ACCEPTATION',
  'date acceptation': 'DATE_ACCEPTATION',
  'n autorisation': 'N_AUTORISATION',
  'n autorisation ou dossier': 'N_AUTORISATION',
  'etat dossier cmoi': 'ETAT_DOSSIER_CMOI',
  'etat du dossier cmoi': 'ETAT_DOSSIER_CMOI',
  'etat du dossier cmoi sofider': 'ETAT_DOSSIER_CMOI',
  'date de demande paiement': 'DATE_DDE_PAIEMENT',
  'date demande paiement': 'DATE_DDE_PAIEMENT',
  'date paiement': 'DATE_PAIEMENT',

  'date demande de la vt': 'DATE_DDE_VT',
  'date demande vt': 'DATE_DDE_VT',
  'echeance': 'ECHEANCE',
  'date prev de la vt': 'DATE_PREV_VT',
  'date prev vt': 'DATE_PREV_VT',
  'date retour de la vt': 'DATE_RETOUR_VT',
  'date retour vt': 'DATE_RETOUR_VT',
  "charges d affaires": 'CHARGES_AFFAIRES',
  "charges affaires": 'CHARGES_AFFAIRES',
  'demande dp': 'DEMANDE_DP',
  'n dp': 'N_DP',
  'n de dp': 'N_DP',
  'reception cno': 'RECEPTION_CNO',
  'etat du dossier': 'ETAT_DOSSIER',
  'etat dossier': 'ETAT_DOSSIER',
  'date previsionnel de pose': 'DATE_PREV_POSE',
  'date prev pose': 'DATE_PREV_POSE',
  'date reelle de pose': 'DATE_REELLE_POSE',
  'date reelle pose': 'DATE_REELLE_POSE',
  'poseur': 'POSEUR',
  'dde racc edf': 'DDE_RACC_EDF',
  'n de suivi edf': 'N_SUIVI_EDF',
  'n suivi edf': 'N_SUIVI_EDF',
  't0 revente recu': 'T0_REVENTE',
  't0 revente': 'T0_REVENTE',
  'n crae': 'N_CRAE',
  'dde de subvention': 'DDE_SUBVENTION',
  'dde subvention': 'DDE_SUBVENTION',
  'numero dossier': 'NUMERO_DOSSIER',
  'numero de dossier': 'NUMERO_DOSSIER',
  'date valider de subvention': 'DATE_VALIDER_SUB',
  'fin de validation subvention': 'FIN_VALIDATION_SUB',
  'fin validation subvention': 'FIN_VALIDATION_SUB',
  'dde consuel': 'DDE_CONSUEL',
  'consuel vise': 'CONSUEL_VISE',
  't0 auto conso': 'T0_AUTO_CONSO',
  'to auto conso': 'T0_AUTO_CONSO',
  'dde de mes edf': 'DDE_MES_EDF',
  'dde mes edf': 'DDE_MES_EDF',
  'mes edf': 'MES_EDF',

  // Onduleurs — Monophase comes first (leftmost), Triphase second
  'ond 3kw': 'MONO_OND_3KW',
  'ond 6kw': 'MONO_OND_6KW',
  'batterie': 'MONO_BATTERIE',
  'smguard': 'MONO_SMGUARD',
  'ond 3kw2': 'TRI_OND_3KW',
  'ond 6kw2': 'TRI_OND_6KW',
  'stockage': 'TRI_STOCKAGE',
  'sm guard': 'TRI_SMGUARD',
}

// When the same PDF label appears twice (MONO then TRI), map second occurrence here
const DUPLICATE_FALLBACK = {
  'MONO_OND_3KW': 'TRI_OND_3KW',
  'MONO_OND_6KW': 'TRI_OND_6KW',
  'MONO_BATTERIE': 'TRI_BATTERIE',
  'MONO_SMGUARD': 'TRI_SMGUARD',
}

function getHeaderMap(sheetType) {
  if (sheetType === 'btoc-comptant') return COMPTANT_HEADER_MAP
  // Abonnement: same map (columns largely overlap)
  return COMPTANT_HEADER_MAP
}

// Scan a row's items for column header matches.
// Tries single items, then sliding windows of 2-4 adjacent items.
function scanHeaderRow(items, headerMap, found) {
  const tryMatch = (slice) => {
    const key = normKey(slice.map(i => i.str).join(' '))
    const colId = headerMap[key]
    if (!colId) return false

    if (!found[colId]) {
      found[colId] = slice[Math.floor(slice.length / 2)].x
      return true
    }
    // Duplicate → try fallback (Mono→Tri)
    const fallback = DUPLICATE_FALLBACK[colId]
    if (fallback && !found[fallback]) {
      found[fallback] = slice[Math.floor(slice.length / 2)].x
      return true
    }
    return false
  }

  for (let i = 0; i < items.length; i++) {
    tryMatch([items[i]])
    if (i + 1 < items.length) tryMatch([items[i], items[i + 1]])
    if (i + 2 < items.length) tryMatch([items[i], items[i + 1], items[i + 2]])
    if (i + 3 < items.length) tryMatch([items[i], items[i + 1], items[i + 2], items[i + 3]])
  }
}

// Group text items into rows by Y position, then sort each row by X
function groupByY(items) {
  const rows = []
  for (const item of items) {
    const row = rows.find(r => Math.abs(r.y - item.y) <= Y_TOLERANCE)
    if (row) row.items.push(item)
    else rows.push({ y: item.y, items: [item] })
  }
  rows.sort((a, b) => a.y - b.y)
  rows.forEach(r => r.items.sort((a, b) => a.x - b.x))
  return rows
}

// Build column X-boundaries: each column "owns" the range between adjacent column midpoints
function buildBoundaries(colMap) {
  const cols = Object.entries(colMap)
    .map(([colId, x]) => ({ colId, x }))
    .sort((a, b) => a.x - b.x)

  return cols.map((col, i) => {
    const prevX = i > 0 ? (cols[i - 1].x + col.x) / 2 : -Infinity
    const nextX = i < cols.length - 1 ? (col.x + cols[i + 1].x) / 2 : Infinity
    return { colId: col.colId, xMin: prevX, xMax: nextX }
  })
}

function assignToColumn(x, boundaries) {
  for (const b of boundaries) {
    if (x >= b.xMin && x < b.xMax) return b.colId
  }
  return null
}

function isRepeatedHeader(rowData, headerMap) {
  let score = 0
  for (const val of Object.values(rowData)) {
    if (normKey(val) in headerMap) score++
  }
  return score >= 3
}

// Main entry point: parse a PDF File object → array of data-row objects { colId: value }
export async function parsePdf(file, sheetType = 'btoc-comptant') {
  const buffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
  const headerMap = getHeaderMap(sheetType)

  // Extract all text items from all pages (Y offset per page)
  const allItems = []
  let yOffset = 0
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const vp = page.getViewport({ scale: 1 })
    const tc = await page.getTextContent()

    for (const item of tc.items) {
      const text = (item.str || '').trim()
      if (!text) continue
      allItems.push({
        str: text,
        x: item.transform[4],
        y: yOffset + (vp.height - item.transform[5]),
        page: p,
      })
    }
    yOffset += vp.height
  }

  if (allItems.length === 0) throw new Error('Aucun texte trouvé dans le PDF.')

  const rows = groupByY(allItems)

  // Find the best header row (the one that matches the most known column names)
  let bestScore = 0
  let bestHeaderIdx = 0
  let bestColMap = {}

  // Look in the first 30 rows (header is always near the top)
  const searchLimit = Math.min(rows.length, 30)
  for (let i = 0; i < searchLimit; i++) {
    const found = {}
    scanHeaderRow(rows[i].items, headerMap, found)
    const score = Object.keys(found).length
    if (score > bestScore) {
      bestScore = score
      bestHeaderIdx = i
      bestColMap = found
    }
  }

  if (bestScore < 5) {
    throw new Error(
      `Impossible de reconnaître les colonnes du PDF (${bestScore} colonnes détectées). ` +
      'Assurez-vous que le PDF correspond au tableau BtoC Comptant.'
    )
  }

  const boundaries = buildBoundaries(bestColMap)

  // Extract data rows after the header
  const dataRows = []
  for (let i = bestHeaderIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    const rowData = {}

    for (const item of row.items) {
      const colId = assignToColumn(item.x, boundaries)
      if (!colId) continue
      // Concatenate multiple items in the same column cell
      rowData[colId] = rowData[colId] ? rowData[colId] + ' ' + item.str : item.str
    }

    if (Object.keys(rowData).length === 0) continue
    if (isRepeatedHeader(rowData, headerMap)) continue

    dataRows.push(rowData)
  }

  return { rows: dataRows, detectedColumns: Object.keys(bestColMap).length }
}

// Filter out commission/invalid/cancelled rows
export function filterImportRows(rows) {
  return rows.filter(row => {
    const name = (row['Colonne1'] || row['NOM_PRENOM'] || '').trim()
    const email = (row['EMAIL'] || '').trim()

    // Must have a client name or email
    if (!name && !email) return false

    // Commission rows: commercial name present but no address/phone → skip
    const hasAddress = !!(row['ADRESSE_INSTALLATION'] || '').trim()
    const hasTel = !!(row['TELEPHONE'] || '').trim()
    const hasAnyAmount = !!(row['TOTAL_TTC'] || row['SIGNE_LE'] || '').trim()
    if (!hasAddress && !hasTel && hasAnyAmount && !email) return false

    // Cancelled rows
    const etat = (row['ETAT_DOSSIER'] || '').toUpperCase()
    if (etat.includes('ANNUL')) return false

    return true
  })
}
