import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Upload, ChevronRight, AlertCircle, Loader, FileText, CheckCircle } from 'lucide-react'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import { getColumnIdToLetterMap } from '../data/sheetsConfig'
import { parsePdf, filterImportRows } from '../utils/pdfParser'
import './ImportModal.css'

// Key columns shown in the preview table
const PREVIEW_COLS = [
  { id: 'Colonne1',             label: 'Nom – Prénom' },
  { id: 'COMMERCIAL',          label: 'Commercial' },
  { id: 'SIGNE_LE',            label: 'Signé le' },
  { id: 'TOTAL_TTC',           label: 'Total TTC' },
  { id: 'EMAIL',               label: 'Email' },
  { id: 'VILLE',               label: 'Ville' },
  { id: 'ETAT_DOSSIER',        label: 'État dossier' },
]

// Find the last row that has data in the sheet (1-based)
function getLastDataRow(cells) {
  let max = 0
  for (const [key, val] of Object.entries(cells)) {
    if (!val) continue
    const m = key.match(/^[A-Z]+(\d+)$/)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max
}

// Build a set of existing client names for duplicate detection (lowercase, trimmed)
function buildExistingNames(cells, colMap) {
  const nameCol = colMap['Colonne1']
  if (!nameCol) return new Set()
  const names = new Set()
  for (const [key, val] of Object.entries(cells)) {
    if (key.startsWith(nameCol) && val) {
      names.add(val.toLowerCase().trim())
    }
  }
  return names
}

export default function ImportModal({ onClose }) {
  const { sheets, setCellValue, saveData } = useSpreadsheet()

  const [step, setStep]           = useState(1)      // 1 = upload, 2 = preview
  const [sheetType, setSheetType] = useState('btoc-comptant-old')
  const [file, setFile]           = useState(null)
  const [dragging, setDragging]   = useState(false)
  const [parsing, setParsing]     = useState(false)
  const [parseError, setParseError] = useState(null)
  const [allRows, setAllRows]     = useState([])     // filtered rows to import
  const [existingNames, setExistingNames] = useState(new Set())
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [importStats, setImportStats] = useState(null) // { added, skipped }

  const fileInputRef = useRef(null)

  // ── File selection ───────────────────────────────────────────
  const handleFile = (f) => {
    if (!f || f.type !== 'application/pdf') {
      setParseError('Le fichier doit être un PDF.')
      return
    }
    setFile(f)
    setParseError(null)
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [])

  const handleDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const handleDragLeave = () => setDragging(false)

  // ── Parse PDF ────────────────────────────────────────────────
  const handleAnalyse = async () => {
    if (!file) return
    setParsing(true)
    setParseError(null)

    try {
      const { rows } = await parsePdf(file, sheetType)
      const filtered = filterImportRows(rows)

      // Build existing names set from current sheet
      const cells = sheets[sheetType]?.cells || {}
      const colMap = getColumnIdToLetterMap(sheetType)
      const existing = buildExistingNames(cells, colMap)

      setAllRows(filtered)
      setExistingNames(existing)
      setStep(2)
    } catch (err) {
      setParseError(err.message || 'Erreur lors de la lecture du PDF.')
    } finally {
      setParsing(false)
    }
  }

  // ── Compute stats ────────────────────────────────────────────
  const newRows = allRows.filter(r => {
    const name = (r['Colonne1'] || '').toLowerCase().trim()
    return !name || !existingNames.has(name)
  })
  const existingCount = allRows.length - newRows.length

  // ── Import ───────────────────────────────────────────────────
  const handleImport = async () => {
    setImporting(true)
    const cells = sheets[sheetType]?.cells || {}
    const colMap = getColumnIdToLetterMap(sheetType)
    let startRow = getLastDataRow(cells) + 1

    let added = 0
    let skipped = 0

    for (const rowData of allRows) {
      const name = (rowData['Colonne1'] || '').toLowerCase().trim()
      if (name && existingNames.has(name)) {
        skipped++
        continue
      }

      // Inject each column value
      for (const [colId, value] of Object.entries(rowData)) {
        const letter = colMap[colId]
        if (!letter || !value?.toString().trim()) continue
        setCellValue(sheetType, `${letter}${startRow}`, value.toString().trim())
      }

      // Mark row as imported (no VT form auto-generated)
      setCellValue(sheetType, `__imported:${startRow}`, '1')

      added++
      startRow++
    }

    await saveData()

    setImportStats({ added, skipped })
    setImportDone(true)
    setImporting(false)
  }

  // ── Render ───────────────────────────────────────────────────
  const modal = (
    <div className="im-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="im-dialog">
        {/* Header */}
        <div className="im-header">
          <span className="im-title">
            {step === 1 ? 'Importer des données' : 'Aperçu de l\'import'}
          </span>
          <button className="im-close-btn" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Step indicators */}
        <div className="im-steps">
          <span className={`im-step ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}>
            1 · Fichier
          </span>
          <ChevronRight size={14} className="im-step-arrow" />
          <span className={`im-step ${step === 2 ? 'active' : ''}`}>
            2 · Aperçu
          </span>
        </div>

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <div className="im-body">
            {/* Sheet type selector */}
            <div className="im-field">
              <label className="im-label">Type de tableau</label>
              <div className="im-radios">
                <label className="im-radio">
                  <input
                    type="radio"
                    value="btoc-comptant-old"
                    checked={sheetType === 'btoc-comptant-old'}
                    onChange={() => setSheetType('btoc-comptant-old')}
                  />
                  BtoC – Comptant (old)
                </label>
                <label className="im-radio im-radio-disabled">
                  <input type="radio" value="btoc-abonnement-old" disabled />
                  BtoC – Abonnement (old) <span className="im-soon">bientôt</span>
                </label>
              </div>
            </div>

            {/* Drop zone */}
            <div
              className={`im-dropzone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
              />
              {file ? (
                <>
                  <FileText size={28} className="im-dz-icon has-file" />
                  <p className="im-dz-name">{file.name}</p>
                  <p className="im-dz-hint">Cliquez pour changer de fichier</p>
                </>
              ) : (
                <>
                  <Upload size={28} className="im-dz-icon" />
                  <p className="im-dz-text">Glissez votre PDF ici</p>
                  <p className="im-dz-hint">ou cliquez pour sélectionner</p>
                </>
              )}
            </div>

            {parseError && (
              <div className="im-error">
                <AlertCircle size={15} />
                {parseError}
              </div>
            )}

            <div className="im-footer">
              <button className="im-btn-secondary" onClick={onClose}>Annuler</button>
              <button
                className="im-btn-primary"
                onClick={handleAnalyse}
                disabled={!file || parsing}
              >
                {parsing
                  ? <><Loader size={14} className="im-spin" /> Analyse en cours…</>
                  : 'Analyser le PDF'}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview ── */}
        {step === 2 && (
          <div className="im-body">
            {importDone ? (
              /* ── Done state ── */
              <div className="im-done">
                <CheckCircle size={40} className="im-done-icon" />
                <p className="im-done-title">Import terminé</p>
                <p className="im-done-sub">
                  {importStats.added} ligne{importStats.added !== 1 ? 's' : ''} ajoutée{importStats.added !== 1 ? 's' : ''}
                  {importStats.skipped > 0 ? ` · ${importStats.skipped} déjà existante${importStats.skipped !== 1 ? 's' : ''}` : ''}
                </p>
                <button className="im-btn-primary" onClick={onClose}>Fermer</button>
              </div>
            ) : (
              <>
                {/* Stats bar */}
                <div className="im-stats">
                  <span className="im-stat-total">{allRows.length} lignes</span>
                  <span className="im-stat-sep">·</span>
                  <span className="im-stat-new">{newRows.length} nouveau{newRows.length !== 1 ? 'x' : ''}</span>
                  <span className="im-stat-sep">·</span>
                  <span className="im-stat-existing">{existingCount} existant{existingCount !== 1 ? 's' : ''}</span>
                  <span className="im-stat-note">(les existants seront ignorés)</span>
                </div>

                {/* Preview table */}
                <div className="im-table-wrap">
                  <table className="im-table">
                    <thead>
                      <tr>
                        <th className="im-th-status" />
                        {PREVIEW_COLS.map(c => (
                          <th key={c.id}>{c.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {allRows.slice(0, 200).map((row, i) => {
                        const name = (row['Colonne1'] || '').toLowerCase().trim()
                        const isExisting = name && existingNames.has(name)
                        return (
                          <tr key={i} className={isExisting ? 'im-row-existing' : ''}>
                            <td className="im-td-status">
                              {isExisting
                                ? <span className="im-badge-exists" title="Déjà existant">~</span>
                                : <span className="im-badge-new" title="Nouveau">+</span>
                              }
                            </td>
                            {PREVIEW_COLS.map(c => (
                              <td key={c.id} title={row[c.id] || ''}>
                                {row[c.id] || ''}
                              </td>
                            ))}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {allRows.length > 200 && (
                    <p className="im-table-more">
                      + {allRows.length - 200} lignes supplémentaires (non affichées)
                    </p>
                  )}
                </div>

                <div className="im-footer">
                  <button
                    className="im-btn-secondary"
                    onClick={() => { setStep(1); setAllRows([]) }}
                    disabled={importing}
                  >
                    Retour
                  </button>
                  <button
                    className="im-btn-primary"
                    onClick={handleImport}
                    disabled={importing || newRows.length === 0}
                  >
                    {importing
                      ? <><Loader size={14} className="im-spin" /> Import en cours…</>
                      : `Importer ${newRows.length} ligne${newRows.length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
