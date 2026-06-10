// Normalise en BDD les dates des colonnes DATE_*, *_LE et DEMANDE_DP au format JJ/MM/AAAA.
// Par défaut : dry-run (affiche les changements sans écrire).
// Pour appliquer : node --env-file=.env scripts/normalize-dates.js --apply
//
// Variables d'environnement requises :
//   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (déjà dans .env)
//   SUPABASE_EMAIL, SUPABASE_PASSWORD (compte ayant accès en lecture/écriture à la table "sheets")

import { createClient } from '@supabase/supabase-js'
import { getColumnIdToLetterMap, SHEETS } from '../src/data/sheetsConfig.js'
import { formatDateDisplay } from '../src/utils/dateUtils.js'

// Doit rester synchronisé avec isDateColumn() dans src/components/Spreadsheet.jsx
const DATE_COL_RE = /^DATE_|_LE$/
const EXTRA_DATE_COLS = new Set(['DEMANDE_DP'])
function isDateColumn(colId) {
  return DATE_COL_RE.test(colId) || EXTRA_DATE_COLS.has(colId)
}

const apply = process.argv.includes('--apply')

const { VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_EMAIL, SUPABASE_PASSWORD } = process.env

if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants (lance avec --env-file=.env)')
  process.exit(1)
}
if (!SUPABASE_EMAIL || !SUPABASE_PASSWORD) {
  console.error('SUPABASE_EMAIL / SUPABASE_PASSWORD manquants dans l\'environnement')
  process.exit(1)
}

const supabase = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)

const { error: authError } = await supabase.auth.signInWithPassword({
  email: SUPABASE_EMAIL,
  password: SUPABASE_PASSWORD,
})
if (authError) {
  console.error('Échec de connexion Supabase:', authError.message)
  process.exit(1)
}

console.log(apply ? 'Mode: APPLICATION des changements' : 'Mode: DRY-RUN (aucune écriture)')
console.log('')

let totalChanges = 0

for (const sheet of SHEETS) {
  const colMap = getColumnIdToLetterMap(sheet.id)
  const dateLetters = new Set(
    Object.entries(colMap).filter(([id]) => isDateColumn(id)).map(([, letter]) => letter)
  )

  const { data: rows, error } = await supabase
    .from('sheets')
    .select('sheet_id, data')
    .eq('sheet_id', sheet.id)
    .limit(1)

  if (error) {
    console.error(`[${sheet.id}] Erreur de lecture:`, error.message)
    continue
  }
  if (!rows || rows.length === 0) {
    console.log(`[${sheet.id}] Aucune donnée trouvée, ignoré.`)
    continue
  }

  const cells = rows[0].data || {}
  const updatedCells = { ...cells }
  let sheetChanges = 0

  for (const [key, value] of Object.entries(cells)) {
    if (typeof value !== 'string' || !value) continue
    const m = key.match(/^([A-Z]+)(\d+)$/)
    if (!m) continue
    const [, letter] = m
    if (!dateLetters.has(letter)) continue

    const normalized = formatDateDisplay(value)
    if (normalized !== value) {
      sheetChanges++
      console.log(`[${sheet.id}] ${key}: "${value}" -> "${normalized}"`)
      updatedCells[key] = normalized
    }
  }

  console.log(`[${sheet.id}] ${sheetChanges} cellule(s) à corriger`)
  totalChanges += sheetChanges

  if (apply && sheetChanges > 0) {
    const { error: updateError } = await supabase
      .from('sheets')
      .update({ data: updatedCells })
      .eq('sheet_id', sheet.id)

    if (updateError) console.error(`[${sheet.id}] Erreur d'écriture:`, updateError.message)
    else console.log(`[${sheet.id}] mis à jour.`)
  }

  console.log('')
}

console.log(`Total: ${totalChanges} cellule(s) ${apply ? 'corrigée(s)' : 'à corriger'}.`)
if (!apply && totalChanges > 0) {
  console.log('Relance avec --apply pour appliquer ces changements.')
}
