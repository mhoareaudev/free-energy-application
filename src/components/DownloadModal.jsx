import { useState } from 'react'
import { X, FileText, FileSpreadsheet, Download } from 'lucide-react'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import { getColumnIdToLetterMap, getSheetColumns } from '../data/sheetsConfig'
import './DownloadModal.css'

const EXPORT_SHEETS = [
  { id: 'btoc-comptant',   name: 'BtoC – Comptant'   },
  { id: 'btoc-abonnement', name: 'BtoC – Abonnement' },
  { id: 'btob',            name: 'BtoB'               },
]

function getColumns(sheetId) {
  const config = getSheetColumns(sheetId)
  return [
    ...(config.frozen || []),
    ...(config.groups || []).flatMap(g => g.columns || []),
  ]
}

function buildCSV(sheetId, cells) {
  const colMap = getColumnIdToLetterMap(sheetId)
  const columns = getColumns(sheetId)

  let maxRow = 1
  Object.keys(cells).forEach(k => {
    if (k.startsWith('__')) return
    const m = k.match(/^[A-Z]+(\d+)$/)
    if (m) maxRow = Math.max(maxRow, parseInt(m[1]))
  })

  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`
  const header = columns.map(c => escape(c.label)).join(',')
  const rows = []
  for (let r = 2; r <= maxRow; r++) {
    const vals = columns.map(col => {
      const letter = colMap[col.id]
      return escape(letter ? (cells[`${letter}${r}`] || '') : '')
    })
    if (vals.every(v => v === '""')) continue
    rows.push(vals.join(','))
  }
  return [header, ...rows].join('\n')
}

function downloadCSV(sheetId, name, cells) {
  const csv = buildCSV(sheetId, cells)
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${name}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function buildTableHTML(sheetId, sheetName, cells) {
  const colMap = getColumnIdToLetterMap(sheetId)
  const columns = getColumns(sheetId)

  let maxRow = 1
  Object.keys(cells).forEach(k => {
    if (k.startsWith('__')) return
    const m = k.match(/^[A-Z]+(\d+)$/)
    if (m) maxRow = Math.max(maxRow, parseInt(m[1]))
  })

  const ths = columns.map(c => `<th>${c.label}</th>`).join('')
  const trs = []
  for (let r = 2; r <= maxRow; r++) {
    const tds = columns.map(col => {
      const letter = colMap[col.id]
      const val = letter ? (cells[`${letter}${r}`] || '') : ''
      return `<td>${val}</td>`
    })
    if (tds.every(td => td === '<td></td>')) continue
    trs.push(`<tr>${tds.join('')}</tr>`)
  }
  if (!trs.length) return null

  return `<section>
    <h2>${sheetName}</h2>
    <table>
      <thead><tr>${ths}</tr></thead>
      <tbody>${trs.join('')}</tbody>
    </table>
  </section>`
}

function openPrintWindow(sections, title) {
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9px; color: #111; }
    h2 { font-size: 13px; font-weight: 700; margin: 20px 0 8px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
    th { background: #0f172a; color: #fff; font-size: 8px; font-weight: 600;
         padding: 4px 5px; text-align: left; white-space: nowrap; }
    td { border-bottom: 1px solid #e5e7eb; padding: 3px 5px; white-space: nowrap; }
    tr:nth-child(even) td { background: #f8fafc; }
    section { page-break-after: always; }
    section:last-child { page-break-after: avoid; }
    @page { size: A3 landscape; margin: 12mm; }
  </style>
</head>
<body>
  ${sections.join('\n')}
</body>
</html>`

  const w = window.open('', '_blank')
  w.document.write(html)
  w.document.close()
  w.onload = () => w.print()
}

export default function DownloadModal({ onClose }) {
  const { sheets, activeSheet } = useSpreadsheet()
  const [format, setFormat]     = useState('csv')
  const [tab, setTab]           = useState(
    EXPORT_SHEETS.find(s => s.id === activeSheet)?.id ?? EXPORT_SHEETS[0].id
  )
  const [loading, setLoading]   = useState(false)

  const handleDownload = async () => {
    setLoading(true)

    const targets = tab === 'all' ? EXPORT_SHEETS : [EXPORT_SHEETS.find(s => s.id === tab)]

    if (format === 'csv') {
      for (const sheet of targets) {
        const cells = sheets[sheet.id]?.cells || {}
        downloadCSV(sheet.id, sheet.name, cells)
        await new Promise(r => setTimeout(r, 150))
      }
    } else {
      const sections = targets
        .map(sheet => buildTableHTML(sheet.id, sheet.name, sheets[sheet.id]?.cells || {}))
        .filter(Boolean)
      if (sections.length) {
        openPrintWindow(sections, tab === 'all' ? 'Free Energy – Export' : targets[0].name)
      }
    }

    setLoading(false)
    onClose()
  }

  return (
    <div className="dm-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="dm-dialog">

        {/* Header */}
        <div className="dm-header">
          <span className="dm-title">Télécharger les données</span>
          <button className="dm-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="dm-body">

          {/* Format */}
          <div className="dm-section">
            <p className="dm-label">Format</p>
            <div className="dm-cards">
              <button
                className={`dm-card${format === 'csv' ? ' dm-card--active' : ''}`}
                onClick={() => setFormat('csv')}
              >
                <FileSpreadsheet size={22} />
                <span className="dm-card-name">CSV</span>
                <span className="dm-card-desc">Excel, Google Sheets…</span>
              </button>
              <button
                className={`dm-card${format === 'pdf' ? ' dm-card--active' : ''}`}
                onClick={() => setFormat('pdf')}
              >
                <FileText size={22} />
                <span className="dm-card-name">PDF</span>
                <span className="dm-card-desc">Impression, archivage</span>
              </button>
            </div>
          </div>

          {/* Onglet */}
          <div className="dm-section">
            <p className="dm-label">Onglet</p>
            <div className="dm-tabs">
              {EXPORT_SHEETS.map(s => (
                <button
                  key={s.id}
                  className={`dm-tab${tab === s.id ? ' dm-tab--active' : ''}`}
                  onClick={() => setTab(s.id)}
                >
                  {s.name}
                </button>
              ))}
              <button
                className={`dm-tab dm-tab--all${tab === 'all' ? ' dm-tab--active' : ''}`}
                onClick={() => setTab('all')}
              >
                Tous les onglets
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="dm-footer">
          <button className="dm-btn-cancel" onClick={onClose}>Annuler</button>
          <button className="dm-btn-download" onClick={handleDownload} disabled={loading}>
            <Download size={14} />
            {loading ? 'Préparation…' : `Télécharger${tab === 'all' ? ` (${EXPORT_SHEETS.length} fichiers)` : ''}`}
          </button>
        </div>

      </div>
    </div>
  )
}
