import { useState, useEffect, useMemo } from 'react'
import { X, Upload, ChevronUp, ChevronDown, CheckCircle2, AlertCircle, Loader } from 'lucide-react'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import './ImportPreviewModal.css'

const SHEET_META = {
  comptant:   { label: 'Comptant',   color: '#f97316', sheetId: 'btoc-comptant'   },
  abonnement: { label: 'Abonnement', color: '#8b5cf6', sheetId: 'btoc-abonnement' },
  btob:       { label: 'BtoB',       color: '#0ea5e9', sheetId: 'btob'            },
}

function SheetBadge({ sheetKey }) {
  const meta = SHEET_META[sheetKey] || { label: sheetKey, color: '#9ca3af' }
  return (
    <span className="ipm-badge" style={{ background: meta.color + '1a', color: meta.color, border: `1px solid ${meta.color}44` }}>
      {meta.label}
    </span>
  )
}

const STAGE_ORDER = ['Demande de VT', 'Visite Technique', 'Nomenclature', 'DP', 'RAC', 'VAD', 'Pose', 'Consuel', 'EDF', 'Terminé']

function mapEtape(etape) {
  if (!etape) return 'Demande de VT'
  const e = etape.toLowerCase()
  if (e.includes('visite') || e.includes('vt')) return 'Visite Technique'
  if (e.includes('nomenclature')) return 'Nomenclature'
  if (e === 'dp') return 'DP'
  if (e === 'rac') return 'RAC'
  if (e === 'vad') return 'VAD'
  if (e.includes('pose')) return 'Pose'
  if (e.includes('consuel')) return 'Consuel'
  if (e === 'edf') return 'EDF'
  if (e.includes('termin')) return 'Terminé'
  return 'Demande de VT'
}

function stageAfter(etapeLabel, reference) {
  return STAGE_ORDER.indexOf(etapeLabel) > STAGE_ORDER.indexOf(reference)
}

function buildVtFormData(entry) {
  return {
    clientName: entry.nom_interlocuteur || '',
    commercial: entry.commercial_vt || '',
    adresse:    entry.adresse_pose || '',
    codePostal: entry.code_postal || '',
    commune:    entry.Commune || '',
    email:      entry.mail_interlocuteur || '',
    tel:        entry.tel_interlocuteur || '',
    date:       entry.date_vt || (entry.createdAt ? entry.createdAt.split('T')[0] : ''),
    puissance:  entry.puissance_souhaitee || '',
    type_comptant:    entry.type_comptant,
    type_abonnement:  entry.type_abonnement,
    client_b2b:       entry.client_b2b,
    oui_revente:      entry.oui_revente,
    non_revente:      entry.non_revente,
    oui_maintenance:  entry.oui_maintenance,
    non_maintenance:  entry.non_maintenance,
    stockage_text:    entry.stockage_text || '',
    technicien_vt:    entry.technicien_vt || '',
    commercial_vt:    entry.commercial_vt || '',
    nom_interlocuteur: entry.nom_interlocuteur || '',
    ...(entry.data_pdf || {}),
  }
}

function mapEntry(entry) {
  const isBtob       = !!entry.client_b2b
  const isAbonnement = !isBtob && !!entry.type_abonnement
  const sheetKey     = isBtob ? 'btob' : isAbonnement ? 'abonnement' : 'comptant'
  return {
    id:         entry.id,
    nom:        entry.nom_interlocuteur || '—',
    email:      entry.mail_interlocuteur || '',
    tel:        entry.tel_interlocuteur || '',
    adresse:    entry.adresse_pose || '',
    codePostal: entry.code_postal || '',
    ville:      entry.Commune || '',
    commercial: entry.commercial_vt || '',
    puissance:  entry.puissance_souhaitee ? `${entry.puissance_souhaitee} kWc` : '',
    dateVT:     entry.date_vt ? new Date(entry.date_vt).toLocaleDateString('fr-FR') : '',
    etape:      entry.etape || '',
    etapeLabel: mapEtape(entry.etape),
    sheetKey,
    _raw: entry,
  }
}

const TABS = [
  { key: 'all',        label: 'Tous' },
  { key: 'comptant',   label: 'Comptant' },
  { key: 'abonnement', label: 'Abonnement' },
  { key: 'btob',       label: 'BtoB' },
]

const COLS = [
  { key: 'nom',       label: 'Nom',       sortable: true  },
  { key: 'email',     label: 'Email',     sortable: false },
  { key: 'tel',       label: 'Téléphone', sortable: false },
  { key: 'adresse',   label: 'Adresse',   sortable: false },
  { key: 'ville',     label: 'Ville',     sortable: true  },
  { key: 'commercial',label: 'Commercial',sortable: true  },
  { key: 'puissance', label: 'Puissance', sortable: false },
  { key: 'dateVT',    label: 'Date VT',   sortable: true  },
  { key: 'etapeLabel',label: 'Étape',     sortable: true  },
  { key: 'sheetKey',  label: 'Onglet',    sortable: true  },
]

export default function ImportPreviewModal({ onClose }) {
  const { batchImportRows } = useSpreadsheet()

  const [raw,       setRaw]       = useState([])
  const [loading,   setLoading]   = useState(true)
  const [filter,    setFilter]    = useState('all')
  const [etapeFilter, setEtapeFilter] = useState('all')
  const [sort,      setSort]      = useState({ key: 'nom', dir: 'asc' })
  const [selected,  setSelected]  = useState(new Set())
  const [importing, setImporting] = useState(false)
  const [result,    setResult]    = useState(null) // { count, errors }

  useEffect(() => {
    fetch('/visites-export.json')
      .then(r => r.json())
      .then(data => { setRaw(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const mapped = useMemo(() => raw.map(mapEntry), [raw])

  const counts = useMemo(() => ({
    all:        mapped.length,
    comptant:   mapped.filter(e => e.sheetKey === 'comptant').length,
    abonnement: mapped.filter(e => e.sheetKey === 'abonnement').length,
    btob:       mapped.filter(e => e.sheetKey === 'btob').length,
  }), [mapped])

  const etapeOptions = useMemo(() => {
    const s = new Set(mapped.map(e => e.etapeLabel))
    return ['all', ...STAGE_ORDER.filter(st => s.has(st))]
  }, [mapped])

  const rows = useMemo(() => {
    let filtered = filter === 'all' ? mapped : mapped.filter(e => e.sheetKey === filter)
    if (etapeFilter !== 'all') filtered = filtered.filter(e => e.etapeLabel === etapeFilter)
    return [...filtered].sort((a, b) => {
      const va = (a[sort.key] || '').toString().toLowerCase()
      const vb = (b[sort.key] || '').toString().toLowerCase()
      return sort.dir === 'asc' ? va.localeCompare(vb, 'fr') : vb.localeCompare(va, 'fr')
    })
  }, [mapped, filter, etapeFilter, sort])

  function toggleSort(key) {
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })
  }

  // Checkboxes
  const allVisibleSelected = rows.length > 0 && rows.every(r => selected.has(r.id))
  const someSelected       = rows.some(r => selected.has(r.id))

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allVisibleSelected) rows.forEach(r => next.delete(r.id))
      else rows.forEach(r => next.add(r.id))
      return next
    })
  }

  function toggleRow(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Import
  async function handleImport() {
    if (selected.size === 0 || importing) return
    setImporting(true)
    setResult(null)

    try {
      const toImport = mapped.filter(e => selected.has(e.id))
      const importRows = toImport.map(e => {
        const r = e._raw
        const dp = r.data_pdf || {}
        return {
          sheetId:       SHEET_META[e.sheetKey].sheetId,
          clientName:    r.nom_interlocuteur || '',
          commercial:    r.commercial_vt || '',
          email:         r.mail_interlocuteur || '',
          tel:           r.tel_interlocuteur || '',
          adresse:       r.adresse_pose || '',
          ville:         r.Commune || '',
          codePostal:    r.code_postal || '',
          dateDemandeVT: r.createdAt ? r.createdAt.split('T')[0] : '',
          dateVT:        r.date_vt || '',
          dateRetourVT:  stageAfter(e.etapeLabel, 'Visite Technique') ? (r.date_vt || '') : '',
          puissance:     r.puissance_souhaitee || '',
          etatDossier:   e.etapeLabel,
          chargesAffaires: r.technicien_vt || '',
          demandeDp:     dp.date_dp || '',
          nDp:           dp.numero_dp || '',
          datePrevPose:  r.date_debut_pose || dp.date_debut_pose || '',
          dateReellePose: r.date_fin_pose  || dp.date_fin_pose  || '',
          mesEdf:        r.date_raccordement || '',
          vtFormData:    buildVtFormData(r),
        }
      })

      batchImportRows(importRows)
      setResult({ count: importRows.length })
      setSelected(new Set())
    } catch (err) {
      console.error(err)
      setResult({ count: 0, error: err.message || 'Erreur inconnue' })
    } finally {
      setImporting(false)
    }
  }

  function SortIcon({ colKey }) {
    if (sort.key !== colKey) return <ChevronUp size={11} style={{ opacity: 0.25 }} />
    return sort.dir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
  }

  const selectedCount = selected.size

  return (
    <div className="ipm-overlay" onClick={onClose}>
      <div className="ipm-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="ipm-header">
          <div className="ipm-header-left">
            <div className="ipm-icon"><Upload size={16} /></div>
            <div>
              <div className="ipm-title">Importer des visites techniques</div>
              <div className="ipm-subtitle">
                {loading ? 'Chargement…' : `${mapped.length} visites — sélectionnez celles à importer`}
              </div>
            </div>
          </div>
          <button className="ipm-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Result banner */}
        {result && (
          <div className={`ipm-result ${result.error ? 'ipm-result--error' : 'ipm-result--success'}`}>
            {result.error
              ? <><AlertCircle size={15} /> Erreur : {result.error}</>
              : <><CheckCircle2 size={15} /> {result.count} transaction{result.count !== 1 ? 's' : ''} importée{result.count !== 1 ? 's' : ''} avec succès</>
            }
          </div>
        )}

        {/* Tabs */}
        <div className="ipm-tabs">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`ipm-tab${filter === tab.key ? ' ipm-tab--active' : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
              <span className="ipm-tab-count">{counts[tab.key]}</span>
            </button>
          ))}
          <select
            className="ipm-etape-select"
            value={etapeFilter}
            onChange={e => setEtapeFilter(e.target.value)}
          >
            <option value="all">Toutes les étapes</option>
            {etapeOptions.filter(o => o !== 'all').map(o => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <div className="ipm-tabs-info">{rows.length} entrée{rows.length !== 1 ? 's' : ''}</div>
        </div>

        {/* Table */}
        <div className="ipm-body">
          {loading ? (
            <div className="ipm-loading">Chargement du fichier…</div>
          ) : (
            <div className="ipm-table-wrap">
              <table className="ipm-table">
                <thead>
                  <tr>
                    <th className="ipm-th--check">
                      <input
                        type="checkbox"
                        className="ipm-checkbox"
                        checked={allVisibleSelected}
                        ref={el => { if (el) el.indeterminate = someSelected && !allVisibleSelected }}
                        onChange={toggleAll}
                      />
                    </th>
                    {COLS.map(col => (
                      <th
                        key={col.key}
                        className={col.sortable ? 'ipm-th--sortable' : ''}
                        onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                      >
                        <span className="ipm-th-inner">
                          {col.label}
                          {col.sortable && <SortIcon colKey={col.key} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={COLS.length + 1} className="ipm-empty">Aucune entrée</td></tr>
                  ) : rows.map(row => (
                    <tr
                      key={row.id}
                      className={selected.has(row.id) ? 'ipm-tr--selected' : ''}
                      onClick={() => toggleRow(row.id)}
                    >
                      <td className="ipm-td--check" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="ipm-checkbox"
                          checked={selected.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                        />
                      </td>
                      <td className="ipm-td--name">{row.nom}</td>
                      <td className="ipm-td--muted">{row.email}</td>
                      <td className="ipm-td--muted">{row.tel}</td>
                      <td className="ipm-td--muted">{row.adresse}</td>
                      <td>{row.ville}</td>
                      <td>{row.commercial}</td>
                      <td className="ipm-td--center">{row.puissance}</td>
                      <td className="ipm-td--center">{row.dateVT}</td>
                      <td>{row.etapeLabel}</td>
                      <td><SheetBadge sheetKey={row.sheetKey} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ipm-footer">
          <div className="ipm-footer-left">
            {selectedCount > 0
              ? <span className="ipm-footer-sel">{selectedCount} sélectionnée{selectedCount !== 1 ? 's' : ''}</span>
              : <span className="ipm-footer-note">Cochez les visites à importer</span>
            }
          </div>
          <div className="ipm-footer-actions">
            <button className="ipm-btn-cancel" onClick={onClose} disabled={importing}>
              Fermer
            </button>
            <button
              className="ipm-btn-import"
              onClick={handleImport}
              disabled={selectedCount === 0 || importing}
            >
              {importing
                ? <><Loader size={13} className="ipm-spin" /> Import en cours…</>
                : <><Upload size={13} /> Importer {selectedCount > 0 ? `(${selectedCount})` : ''}</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
