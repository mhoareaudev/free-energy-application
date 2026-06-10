import { useMemo } from 'react'
import { Sun } from 'lucide-react'
import { useSpreadsheet } from '../../context/SpreadsheetContext'
import { getColumnIdToLetterMap } from '../../data/sheetsConfig'
import { formatDateDisplay } from '../../utils/dateUtils'
import DossierListPage, { DossierBadge } from './DossierListPage'

function extractRows(cells, commercialLetter) {
  const rowSet = new Set()
  Object.keys(cells).forEach(key => {
    if (key.startsWith('__')) return
    const m = key.match(/^[A-Z]+(\d+)$/)
    if (m && parseInt(m[1]) >= 2) rowSet.add(parseInt(m[1]))
  })
  return Array.from(rowSet).filter(r => cells[`${commercialLetter}${r}`])
}

function computePhase(cells, colMap, row, sheetId) {
  const get = id => {
    const letter = colMap[id]
    return letter ? (cells[`${letter}${row}`] || '') : ''
  }
  let dpDone = false
  try {
    const json = cells[`__dpForm:${row}`]
    if (json) dpDone = JSON.parse(json).isComplete === true
  } catch { /* ignore */ }

  const posed = sheetId === 'btob' ? get('DATE_POSE') : get('DATE_REELLE_POSE')
  if (posed)               return { label: 'Installé',    key: 'installe' }
  if (get('RECEPTION_CNO')) return { label: 'CNO reçu',   key: 'cno' }
  if (dpDone || get('N_DP')) return { label: 'DP lancée', key: 'dp_lancee' }
  if (get('DEMANDE_DP'))   return { label: 'DP en cours', key: 'dp_cours' }
  if (get('DATE_RETOUR_VT')) return { label: 'VT validée', key: 'vt_validee' }
  if (get('DATE_DDE_VT'))  return { label: 'VT en cours', key: 'vt_cours' }
  if (get('SIGNE_LE'))     return { label: 'Signé',       key: 'signe' }
  return                           { label: 'Lead entrant', key: 'lead' }
}

function formatMontant(raw) {
  if (!raw) return ''
  const n = parseFloat(String(raw).replace(/[^\d.-]/g, ''))
  if (isNaN(n)) return raw
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function useProjetsSolaires() {
  const { sheets } = useSpreadsheet()
  return useMemo(() => {
    const rows = []

    // BtoC Comptant
    const colC = getColumnIdToLetterMap('btoc-comptant')
    const cellsC = sheets['btoc-comptant']?.cells || {}
    extractRows(cellsC, colC['COMMERCIAL']).forEach(r => {
      const nom = cellsC[`${colC['Colonne1']}${r}`] || ''
      if (!nom) return
      const phase = computePhase(cellsC, colC, r, 'btoc-comptant')
      rows.push({
        id: `c:${r}`,
        nom,
        phase: phase.label, phaseKey: phase.key,
        commercial:  cellsC[`${colC['COMMERCIAL']}${r}`]  || '',
        dateCloture: formatDateDisplay(cellsC[`${colC['SIGNE_LE']}${r}`] || ''),
        montant:     formatMontant(cellsC[`${colC['TOTAL_TTC']}${r}`] || ''),
      })
    })

    // BtoC Abonnement
    const colA = getColumnIdToLetterMap('btoc-abonnement')
    const cellsA = sheets['btoc-abonnement']?.cells || {}
    extractRows(cellsA, colA['COMMERCIAL']).forEach(r => {
      const nom = cellsA[`${colA['NOM_PRENOM']}${r}`] || ''
      if (!nom) return
      const phase = computePhase(cellsA, colA, r, 'btoc-abonnement')
      rows.push({
        id: `a:${r}`,
        nom,
        phase: phase.label, phaseKey: phase.key,
        commercial:  cellsA[`${colA['COMMERCIAL']}${r}`]  || '',
        dateCloture: formatDateDisplay(cellsA[`${colA['SIGNE_LE']}${r}`] || ''),
        montant:     formatMontant(cellsA[`${colA['MONTANT_TTC_VENTE']}${r}`] || ''),
      })
    })

    // BtoB
    const colB = getColumnIdToLetterMap('btob')
    const cellsB = sheets['btob']?.cells || {}
    extractRows(cellsB, colB['COMMERCIAL']).forEach(r => {
      const nom = cellsB[`${colB['NOM_PRENOM']}${r}`] || ''
      if (!nom) return
      const phase = computePhase(cellsB, colB, r, 'btob')
      rows.push({
        id: `b:${r}`,
        nom,
        phase: phase.label, phaseKey: phase.key,
        commercial:  cellsB[`${colB['COMMERCIAL']}${r}`]  || '',
        dateCloture: formatDateDisplay(cellsB[`${colB['SIGNE_LE']}${r}`] || ''),
        montant:     formatMontant(cellsB[`${colB['TOTAL_TTC']}${r}`] || ''),
      })
    })

    // Sort by phase priority (most advanced first)
    const PHASE_ORDER = ['installe', 'cno', 'dp_lancee', 'dp_cours', 'vt_validee', 'vt_cours', 'signe', 'lead']
    return rows.sort((a, b) => PHASE_ORDER.indexOf(a.phaseKey) - PHASE_ORDER.indexOf(b.phaseKey))
  }, [sheets])
}

const COLUMNS = [
  {
    key: 'nom', label: 'Nom du projet', width: 240,
    render: v => <span className="dossier-td--name">{v}</span>,
  },
  {
    key: 'phase', label: 'Phase', width: 180,
    render: (v, row) => <DossierBadge label={v} colorKey={row.phaseKey} />,
  },
  { key: 'dateCloture', label: 'Date de fermeture',   width: 160 },
  { key: 'commercial',  label: 'Propriétaire',         width: 160 },
  { key: 'montant',     label: 'Montant',              width: 130 },
]

export default function ProjetsSolaires() {
  const rows = useProjetsSolaires()
  return (
    <DossierListPage
      title="Projets solaires"
      addLabel="Ajouter des projets"
      tabs={['Tous les projets', 'Mes projets']}
      columns={COLUMNS}
      rows={rows}
      emptyIcon={<Sun size={34} strokeWidth={1.5} />}
      emptyTitle="Aucun projet solaire"
      emptyDesc="Les projets issus de toutes les feuilles (BtoC comptant, abonnement et BtoB) apparaîtront ici."
    />
  )
}
