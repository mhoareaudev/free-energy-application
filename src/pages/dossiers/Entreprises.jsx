import { useMemo } from 'react'
import { Building2 } from 'lucide-react'
import { useSpreadsheet } from '../../context/SpreadsheetContext'
import { getColumnIdToLetterMap } from '../../data/sheetsConfig'
import DossierListPage from './DossierListPage'

function extractRows(cells, commercialLetter) {
  const rowSet = new Set()
  Object.keys(cells).forEach(key => {
    if (key.startsWith('__')) return
    const m = key.match(/^[A-Z]+(\d+)$/)
    if (m && parseInt(m[1]) >= 2) rowSet.add(parseInt(m[1]))
  })
  return Array.from(rowSet).filter(r => cells[`${commercialLetter}${r}`])
}

function formatDate(raw) {
  if (!raw) return ''
  if (raw.includes('/')) return raw
  try {
    const d = new Date(raw)
    if (!isNaN(d)) return d.toLocaleDateString('fr-FR')
  } catch { /* ignore */ }
  return raw
}

function useEntreprises() {
  const { sheets } = useSpreadsheet()
  return useMemo(() => {
    const colB = getColumnIdToLetterMap('btob')
    const cellsB = sheets['btob']?.cells || {}
    const rows = []

    extractRows(cellsB, colB['COMMERCIAL']).forEach(r => {
      const nom = cellsB[`${colB['NOM_PRENOM']}${r}`] || ''
      if (!nom) return
      rows.push({
        id: `b:${r}`,
        nom,
        commercial:  cellsB[`${colB['COMMERCIAL']}${r}`]         || '',
        telephone:   cellsB[`${colB['TELEPHONE']}${r}`]           || '',
        signeLe:     formatDate(cellsB[`${colB['SIGNE_LE']}${r}`] || ''),
        ville:       cellsB[`${colB['VILLE']}${r}`]               || '',
        adresse:     cellsB[`${colB['ADRESSE_INSTALLATION']}${r}`]|| '',
      })
    })

    return rows.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }, [sheets])
}

const COLUMNS = [
  {
    key: 'nom', label: "Nom de l'entreprise", width: 240,
    render: v => <span className="dossier-td--name">{v}</span>,
  },
  { key: 'commercial', label: "Propriétaire",         width: 160 },
  { key: 'signeLe',    label: "Date de fermeture",    width: 150 },
  { key: 'telephone',  label: "Numéro de téléphone",  width: 150 },
  { key: 'adresse',    label: "Adresse",              width: 220 },
  { key: 'ville',      label: "Ville",                width: 140 },
]

export default function Entreprises() {
  const rows = useEntreprises()
  return (
    <DossierListPage
      title="Entreprises"
      addLabel="Ajouter des entreprises"
      tabs={['Toutes les entreprises', 'Mes entreprises']}
      columns={COLUMNS}
      rows={rows}
      emptyIcon={<Building2 size={34} strokeWidth={1.5} />}
      emptyTitle="Aucune entreprise enregistrée"
      emptyDesc="Les entreprises BtoB apparaîtront ici dès qu'elles auront été saisies dans le CRM."
    />
  )
}
