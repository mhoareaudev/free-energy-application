import { useState, useEffect } from 'react'
import { ChevronDown, Plus, MoreHorizontal, LayoutList, ArrowUpDown } from 'lucide-react'
import './DossierListPage.css'

// ── Badge ────────────────────────────────────────────────────
const BADGE_COLORS = {
  comptant:   { background: '#dbeafe', color: '#1d4ed8' },
  abonnement: { background: '#d1fae5', color: '#065f46' },
  btob:       { background: '#fef9c3', color: '#854d0e' },
  installe:   { background: '#dcfce7', color: '#166534' },
  cno:        { background: '#dbeafe', color: '#1d4ed8' },
  dp_lancee:  { background: '#fef9c3', color: '#854d0e' },
  dp_cours:   { background: '#fefce8', color: '#a16207' },
  vt_validee: { background: '#ccfbf1', color: '#0f766e' },
  vt_cours:   { background: '#ede9fe', color: '#6d28d9' },
  signe:      { background: '#d1fae5', color: '#065f46' },
  lead:       { background: '#f3f4f6', color: '#374151' },
}

export function DossierBadge({ label, colorKey }) {
  const style = BADGE_COLORS[colorKey] || BADGE_COLORS.lead
  return <span className="dossier-badge" style={style}>{label}</span>
}

// ── Main component ───────────────────────────────────────────
export default function DossierListPage({
  title,
  addLabel,
  tabs = [],
  columns = [],
  rows = [],
  emptyIcon,
  emptyTitle,
  emptyDesc,
  rightTabsContent,
  alwaysShowTable = false,
  contentOverride,
  onAdd,
  onRowClick,
  onSelectionChange,
  selectionVersion = 0,
  bulkBar,
}) {
  const [activeTab, setActiveTab]   = useState(0)
  const [sortCol, setSortCol]       = useState(null)
  const [sortDir, setSortDir]       = useState('asc')
  const [checked, setChecked]       = useState(new Set())

  useEffect(() => { setChecked(new Set()) }, [selectionVersion])
  useEffect(() => { onSelectionChange?.(checked) }, [checked])

  const handleSort = (idx) => {
    if (sortCol === idx) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(idx); setSortDir('asc') }
  }

  const displayed = [...rows].sort((a, b) => {
    if (sortCol === null) return 0
    const col = columns[sortCol]
    const va = String(a[col.key] ?? '')
    const vb = String(b[col.key] ?? '')
    // Parse DD/MM/YYYY into a sortable timestamp
    const parseFR = s => { const p = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return p ? new Date(+p[3], +p[2]-1, +p[1]).getTime() : null }
    const da = parseFR(va), db = parseFR(vb)
    const cmp = (da !== null && db !== null) ? da - db : va.localeCompare(vb, 'fr', { sensitivity: 'base' })
    return sortDir === 'asc' ? cmp : -cmp
  })

  const allChecked = displayed.length > 0 && displayed.every(r => checked.has(r.id))
  const toggleAll  = () => setChecked(allChecked ? new Set() : new Set(displayed.map(r => r.id)))
  const toggleRow  = (id) => setChecked(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  return (
    <div className="dossier-page">

      {/* ── Header ── */}
      <div className="dossier-header">
        <button className="dossier-title-btn">
          <h1>{title}</h1>
          <ChevronDown size={15} />
        </button>
        <div className="dossier-header-right">
          <button className="dossier-options-btn"><MoreHorizontal size={16} /></button>
          <button className="dossier-add-btn" onClick={onAdd}>
            {addLabel}
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="dossier-tabs-bar">
        {tabs.map((tab, i) => (
          <button
            key={i}
            className={`dossier-tab ${activeTab === i ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            <LayoutList size={12} />
            {tab}
          </button>
        ))}
        <button className="dossier-tab-plus"><Plus size={13} /></button>
        {rightTabsContent && (
          <div className="dossier-tabs-right">{rightTabsContent}</div>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div className="dossier-filter-bar">
        {checked.size > 0 && bulkBar ? bulkBar(checked.size, () => setChecked(new Set())) : (
          <>
            <button className="dossier-filter-chip">Propriétaire <ChevronDown size={10} /></button>
            <button className="dossier-filter-chip">Date de création <ChevronDown size={10} /></button>
            <button className="dossier-filter-chip">Dernière activité <ChevronDown size={10} /></button>
            <button className="dossier-filter-plus"><Plus size={13} /></button>
            <div className="dossier-filter-sep" />
            <button className="dossier-filter-advanced">Filtres avancés</button>
          </>
        )}
      </div>

      {/* ── Content ── */}
      {contentOverride ? contentOverride : !alwaysShowTable && rows.length === 0 ? (
        <div className="dossier-empty">
          <div className="dossier-empty-icon">{emptyIcon}</div>
          <h3 className="dossier-empty-title">{emptyTitle}</h3>
          <p className="dossier-empty-desc">{emptyDesc}</p>
          <button className="dossier-empty-btn" onClick={onAdd}>{addLabel}</button>
        </div>
      ) : (
        <div className="dossier-table-wrap">
          <table className="dossier-table">
            <thead>
              <tr>
                <th className="dossier-th dossier-th--check">
                  <input type="checkbox" className="dossier-checkbox" checked={allChecked} onChange={toggleAll} />
                </th>
                {columns.map((col, i) => (
                  <th
                    key={i}
                    className={`dossier-th${col.sortable !== false ? ' sortable' : ''}${col.hideOnMobile ? ' dossier-th--mob-hide' : ''}`}
                    style={col.width ? { width: col.width } : {}}
                    onClick={() => col.sortable !== false && handleSort(i)}
                  >
                    {col.label}
                    {col.sortable !== false && (
                      <ArrowUpDown size={11} className={`sort-icon${sortCol === i ? ' active' : ''}`} />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.length > 0 ? (
                displayed.map(row => (
                  <tr
                    key={row.id}
                    className={`dossier-row${onRowClick ? ' dossier-row--clickable' : ''}`}
                    onClick={() => onRowClick?.(row)}
                  >
                    <td className="dossier-td dossier-td--check">
                      <input type="checkbox" className="dossier-checkbox" checked={checked.has(row.id)} onChange={() => toggleRow(row.id)} />
                    </td>
                    {columns.map((col, j) => (
                      <td key={j} className={`dossier-td${col.hideOnMobile ? ' dossier-td--mob-hide' : ''}`}>
                        {col.render
                          ? col.render(row[col.key], row)
                          : (row[col.key] || <span className="dossier-empty-cell">--</span>)}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length + 1} className="dossier-td dossier-empty-row">
                    <div className="dossier-empty-row-inner">
                      <span className="dossier-empty-row-icon">{emptyIcon}</span>
                      <span className="dossier-empty-row-text">{emptyTitle}</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
