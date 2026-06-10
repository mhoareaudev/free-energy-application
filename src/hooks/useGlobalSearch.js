import { useMemo } from 'react'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import { getColumnIdToLetterMap } from '../data/sheetsConfig'

function extractRows(cells, anchorLetter) {
  const rowSet = new Set()
  Object.keys(cells).forEach(key => {
    if (key.startsWith('__')) return
    const m = key.match(/^[A-Z]+(\d+)$/)
    if (m && parseInt(m[1]) >= 2) rowSet.add(parseInt(m[1]))
  })
  return Array.from(rowSet).filter(r => cells[`${anchorLetter}${r}`])
}

const SOURCES = [
  { sheetId: 'btoc-comptant',   nameCol: 'Colonne1',   prefix: 'c', dossierType: 'Comptant' },
  { sheetId: 'btoc-abonnement', nameCol: 'NOM_PRENOM', prefix: 'a', dossierType: 'Abonnement' },
  { sheetId: 'btob',            nameCol: 'NOM_PRENOM', prefix: 'b', dossierType: 'BtoB' },
]

// Index de recherche global pour la barre du topbar : dossiers, contacts, entreprises.
export function useGlobalSearchIndex() {
  const { sheets } = useSpreadsheet()

  return useMemo(() => {
    const dossiers = []
    const contactsRaw = []

    SOURCES.forEach(({ sheetId, nameCol, prefix, dossierType }) => {
      const colMap = getColumnIdToLetterMap(sheetId)
      const cells = sheets[sheetId]?.cells || {}
      const nameLetter = colMap[nameCol]
      if (!nameLetter) return

      extractRows(cells, nameLetter).forEach(r => {
        const nom = cells[`${nameLetter}${r}`]
        if (!nom) return
        const id = `${prefix}:${r}`
        const commercial = cells[`${colMap['COMMERCIAL']}${r}`] || ''
        const ville      = cells[`${colMap['VILLE']}${r}`]      || ''
        const email      = cells[`${colMap['EMAIL']}${r}`]      || ''

        dossiers.push({ id, nom, sub: commercial, type: dossierType })
        contactsRaw.push({ id, nom, email, ville })

        if (prefix === 'b') {
          dossiers.push({ id, nom, sub: ville, type: 'Entreprise', isEntreprise: true })
        }
      })
    })

    // Dédoublonnage des contacts par e-mail (même logique que Contacts.jsx)
    contactsRaw.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    const seen = new Set()
    const contacts = contactsRaw.filter(r => {
      const key = r.email.toLowerCase().trim()
      if (!key) return true
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const entreprises = dossiers.filter(d => d.isEntreprise)
    const transactions = dossiers.filter(d => !d.isEntreprise)

    return { contacts, entreprises, dossiers: transactions }
  }, [sheets])
}
