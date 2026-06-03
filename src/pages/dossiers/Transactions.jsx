import { useMemo, useState, useRef, useEffect } from 'react'
import {
  Zap, ChevronDown, Settings2, Search, ArrowUpDown,
  SlidersHorizontal, X, Download, Save, RotateCcw, CheckCircle2,
  LayoutList, LayoutGrid,
} from 'lucide-react'
import { useSpreadsheet } from '../../context/SpreadsheetContext'
import { getColumnIdToLetterMap } from '../../data/sheetsConfig'
import DossierListPage, { DossierBadge } from './DossierListPage'
import { PIPELINE_NAME_KEY, PIPELINE_PHASES_KEY, DEFAULT_PHASES } from '../PipelineConfig'
import { supabaseGet, supabasePost, supabaseUpsert } from '../../lib/supabase'
import { sendVTRequestEmail } from '../../utils/sendVTEmail'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import { formatDateFR } from '../../utils/dateUtils'
import TransactionDetail from './TransactionDetail'
import './Transactions.css'

// ── Slot fallback labels ──────────────────────────────────────
const SLOT_FALLBACK = {
  installe:   'Centrale posée',
  cno:        'CNO reçu',
  dp_lancee:  'DP lancée',
  dp_cours:   'DP en cours',
  vt_validee: 'VT validée',
  vt_cours:   'VT en cours',
  signe:      'Signé',
  lead:       'Lead entrant',
}

// ── Load slot map from localStorage ──────────────────────────
function loadSlotMap() {
  try {
    const saved = localStorage.getItem(PIPELINE_PHASES_KEY)
    const phases = saved ? JSON.parse(saved) : DEFAULT_PHASES
    const map = {}
    for (const p of phases) {
      if (p.slot) map[p.slot] = { name: p.name, color: p.color }
    }
    return map
  } catch { return {} }
}

function useSlotMap() {
  const [map, setMap] = useState(loadSlotMap)
  useEffect(() => {
    let mounted = true
    supabaseGet('pipeline_configs', { config_key: 'eq.main', select: 'phases' })
      .then(data => {
        if (!mounted) return
        const phases = data?.[0]?.phases
        if (!Array.isArray(phases) || phases.length === 0) return
        localStorage.setItem(PIPELINE_PHASES_KEY, JSON.stringify(phases))
        const newMap = {}
        for (const p of phases) { if (p.slot) newMap[p.slot] = { name: p.name, color: p.color } }
        setMap(newMap)
      })
    const sync = () => setMap(loadSlotMap())
    window.addEventListener('storage', sync)
    window.addEventListener('pipelineUpdated', sync)
    return () => {
      mounted = false
      window.removeEventListener('storage', sync)
      window.removeEventListener('pipelineUpdated', sync)
    }
  }, [])
  return map
}

// ── Phase badge ───────────────────────────────────────────────
function PhaseBadge({ slot, slotMap }) {
  if (slot === '__cancelled') {
    return (
      <span style={{
        background: '#fee2e2', color: '#dc2626',
        display: 'inline-flex', alignItems: 'center',
        gap: '5px', fontSize: '11.5px', fontWeight: 700,
        padding: '3px 10px', borderRadius: '99px',
      }}>
        Annulé
      </span>
    )
  }
  const entry = slotMap[slot] || {}
  const name  = entry.name  || SLOT_FALLBACK[slot] || slot
  const color = entry.color || '#64748b'
  return (
    <span style={{
      background: color + '22', color,
      display: 'inline-flex', alignItems: 'center',
      padding: '3px 10px', borderRadius: '99px',
      fontSize: '11.5px', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {name}
    </span>
  )
}

// ── Data helpers ──────────────────────────────────────────────
function extractRows(cells, commercialLetter) {
  const rowSet = new Set()
  Object.keys(cells).forEach(key => {
    if (key.startsWith('__')) return
    const m = key.match(/^[A-Z]+(\d+)$/)
    if (m && parseInt(m[1]) >= 2) rowSet.add(parseInt(m[1]))
  })
  return Array.from(rowSet).filter(r => cells[`${commercialLetter}${r}`])
}

function computePhaseKey(cells, colMap, row, sheetId) {
  const get = id => { const l = colMap[id]; return l ? (cells[`${l}${row}`] || '') : '' }
  let dpDone = false
  try { const json = cells[`__dpForm:${row}`]; if (json) dpDone = JSON.parse(json).isComplete === true } catch { /* ignore */ }
  const posed = sheetId === 'btob' ? get('DATE_POSE') : get('DATE_REELLE_POSE')
  if (posed)                return 'installe'
  if (get('RECEPTION_CNO')) return 'cno'
  if (dpDone || get('N_DP')) return 'dp_lancee'
  if (get('DEMANDE_DP'))    return 'dp_cours'
  if (get('DATE_RETOUR_VT')) return 'vt_validee'
  if (get('DATE_DDE_VT'))   return 'vt_cours'
  if (get('SIGNE_LE'))      return 'signe'
  return                           'lead'
}

function formatDate(raw) {
  if (!raw) return ''
  if (raw.includes('/')) return raw
  try { const d = new Date(raw); if (!isNaN(d)) return d.toLocaleDateString('fr-FR') } catch { /* ignore */ }
  return raw
}

function formatMontant(raw) {
  if (!raw) return ''
  const n = parseFloat(String(raw).replace(/[^\d.-]/g, ''))
  if (isNaN(n)) return raw
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function useTransactions() {
  const { sheets } = useSpreadsheet()
  return useMemo(() => {
    const rows = []
    const colC = getColumnIdToLetterMap('btoc-comptant')
    const cellsC = sheets['btoc-comptant']?.cells || {}
    const parseCancelled = (cells, r) => { try { return JSON.parse(cells[`__cancelled:${r}`] || 'null') } catch { return null } }
    extractRows(cellsC, colC['COMMERCIAL']).forEach(r => {
      const nom = cellsC[`${colC['Colonne1']}${r}`] || ''
      if (!nom) return
      const cancelled = parseCancelled(cellsC, r)
      rows.push({
        id: `c:${r}`, nom,
        phaseSlot:   cancelled ? '__cancelled' : computePhaseKey(cellsC, colC, r, 'btoc-comptant'),
        commercial:  cellsC[`${colC['COMMERCIAL']}${r}`]  || '',
        dateCloture: cancelled ? cancelled.date : formatDate(cellsC[`${colC['SIGNE_LE']}${r}`] || ''),
        montant:     cancelled ? '—' : formatMontant(cellsC[`${colC['TOTAL_TTC']}${r}`] || ''),
        type: 'Comptant', typeKey: 'comptant', cancelled,
      })
    })
    const colA = getColumnIdToLetterMap('btoc-abonnement')
    const cellsA = sheets['btoc-abonnement']?.cells || {}
    extractRows(cellsA, colA['COMMERCIAL']).forEach(r => {
      const nom = cellsA[`${colA['NOM_PRENOM']}${r}`] || ''
      if (!nom) return
      const cancelled = parseCancelled(cellsA, r)
      rows.push({
        id: `a:${r}`, nom,
        phaseSlot:   cancelled ? '__cancelled' : computePhaseKey(cellsA, colA, r, 'btoc-abonnement'),
        commercial:  cellsA[`${colA['COMMERCIAL']}${r}`]  || '',
        dateCloture: cancelled ? cancelled.date : formatDate(cellsA[`${colA['SIGNE_LE']}${r}`] || ''),
        montant:     cancelled ? '—' : formatMontant(cellsA[`${colA['MONTANT_TTC_VENTE']}${r}`] || ''),
        type: 'Abonnement', typeKey: 'abonnement', cancelled,
      })
    })
    const colB = getColumnIdToLetterMap('btob')
    const cellsB = sheets['btob']?.cells || {}
    extractRows(cellsB, colB['COMMERCIAL']).forEach(r => {
      const nom = cellsB[`${colB['NOM_PRENOM']}${r}`] || ''
      if (!nom) return
      const cancelled = parseCancelled(cellsB, r)
      rows.push({
        id: `b:${r}`, nom,
        phaseSlot:   cancelled ? '__cancelled' : computePhaseKey(cellsB, colB, r, 'btob'),
        commercial:  cellsB[`${colB['COMMERCIAL']}${r}`]  || '',
        dateCloture: cancelled ? cancelled.date : formatDate(cellsB[`${colB['SIGNE_LE']}${r}`] || ''),
        montant:     cancelled ? '—' : formatMontant(cellsB[`${colB['TOTAL_TTC']}${r}`] || ''),
        type: 'BtoB', typeKey: 'btob', cancelled,
      })
    })
    const ORDER = ['installe','cno','dp_lancee','dp_cours','vt_validee','vt_cours','signe','lead']
    return rows.sort((a, b) => ORDER.indexOf(a.phaseSlot) - ORDER.indexOf(b.phaseSlot))
  }, [sheets])
}

// ── Columns ───────────────────────────────────────────────────
function makeColumns(slotMap) {
  return [
    { key: 'nom',         label: 'Nom de la transaction', width: 240, render: v => <span className="dossier-td--name">{v}</span> },
    { key: 'type',        label: 'Type',                  width: 140, render: (v, row) => <DossierBadge label={v} colorKey={row.typeKey} /> },
    { key: 'phaseSlot',   label: 'Phase',                 width: 200, render: (v, row) => <PhaseBadge slot={v} slotMap={slotMap} /> },
    { key: 'dateCloture', label: 'Date de fermeture',     width: 160, hideOnMobile: true },
    { key: 'commercial',  label: 'Propriétaire',           width: 160, hideOnMobile: true },
    { key: 'montant',     label: 'Montant',                width: 130, hideOnMobile: true, render: (v, row) => row.cancelled ? <span style={{ color: '#dc2626', fontWeight: 600 }}>Annulé</span> : v },
  ]
}

// ── All contacts (for the client combobox) ────────────────────
function useAllContacts() {
  const { sheets } = useSpreadsheet()
  return useMemo(() => {
    const result = []

    const pick = (cells, colMap, nameColId, prefix) => {
      const nameLetter = colMap[nameColId]
      if (!nameLetter) return
      const rowSet = new Set()
      Object.keys(cells).forEach(k => {
        if (k.startsWith('__')) return
        const m = k.match(/^[A-Z]+(\d+)$/)
        if (m && parseInt(m[1]) >= 2) rowSet.add(parseInt(m[1]))
      })
      rowSet.forEach(r => {
        const nom = cells[`${nameLetter}${r}`]
        if (!nom) return
        result.push({
          id: `${prefix}:${r}`, nom,
          email:      cells[`${colMap['EMAIL']}${r}`]               || '',
          adresse:    cells[`${colMap['ADRESSE_INSTALLATION']}${r}`] || '',
          codePostal: cells[`${colMap['CODE_POSTAL']}${r}`]         || '',
          ville:      cells[`${colMap['VILLE']}${r}`]               || '',
          tel:        cells[`${colMap['TELEPHONE']}${r}`]           || '',
        })
      })
    }

    pick(sheets['btoc-comptant']?.cells   || {}, getColumnIdToLetterMap('btoc-comptant'),   'Colonne1',  'c')
    pick(sheets['btoc-abonnement']?.cells || {}, getColumnIdToLetterMap('btoc-abonnement'), 'NOM_PRENOM', 'a')
    pick(sheets['btob']?.cells            || {}, getColumnIdToLetterMap('btob'),            'NOM_PRENOM', 'b')

    return result.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
  }, [sheets])
}

const DEFAULT_SOLAR_TASKS = [
  { title: 'Prise de contact initiale',                completed: false },
  { title: 'Visite technique planifiée',               completed: false },
  { title: 'Visite technique réalisée',                completed: false },
  { title: 'Devis établi et envoyé au client',         completed: false },
  { title: 'Devis signé',                              completed: false },
  { title: 'Constitution du dossier administratif',    completed: false },
  { title: 'Demande de raccordement (Enedis)',         completed: false },
  { title: "Dossier prime envoyé (CEE / MaPrimeRénov')", completed: false },
  { title: 'Commande du matériel',                     completed: false },
  { title: 'Livraison du matériel sur chantier',       completed: false },
  { title: 'Installation photovoltaïque posée',        completed: false },
  { title: 'Mise en service électrique',               completed: false },
  { title: 'CNO reçu (Consuel)',                       completed: false },
  { title: 'Certificat de conformité envoyé',          completed: false },
  { title: 'Suivi client J+30',                        completed: false },
]

// ── Page toast ────────────────────────────────────────────────
function PageToast({ message }) {
  return (
    <div className="page-toast page-toast--success">
      <CheckCircle2 size={15} />
      {message}
    </div>
  )
}

// ── Add transaction panel ─────────────────────────────────────
export function AddTransactionPanel({ onClose, onCreated, lockedContact = null }) {
  const { userProfile } = useAuth()
  const { addVTRequest } = useSpreadsheet()
  const { notifyAllExcept } = useNotifications()
  const allContacts = useAllContacts()

  const [commerciaux, setCommerciaux] = useState([])
  const [clientQuery, setClientQuery]         = useState(lockedContact?.nom || '')
  const [selectedContact, setSelectedContact] = useState(lockedContact || null)
  const [showDropdown, setShowDropdown]     = useState(false)
  const comboRef = useRef(null)

  const [formData, setFormData] = useState({
    commercial: '', typeContrat: 'comptant',
    puissance: '', reventeSurplus: '', contratMaintenance: '',
    batterie: '', priseSécurisée: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState(null)

  useEffect(() => {
    supabaseGet('commerciaux', { select: 'id,nom,prenom', order: 'nom.asc' })
      .then(data => setCommerciaux(data || []))
  }, [])

  useEffect(() => {
    const h = e => { if (comboRef.current && !comboRef.current.contains(e.target)) setShowDropdown(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filteredContacts = useMemo(() => {
    const q = clientQuery.trim().toLowerCase()
    if (!q) return allContacts.slice(0, 8)
    return allContacts.filter(c => c.nom.toLowerCase().includes(q)).slice(0, 10)
  }, [allContacts, clientQuery])

  const handleSelectContact = c => {
    setSelectedContact(c)
    setClientQuery(c.nom)
    setShowDropdown(false)
  }

  const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  const canSubmit = !!(selectedContact && formData.commercial)

  const handleSubmit = async e => {
    e.preventDefault()
    if (!canSubmit) return
    setLoading(true); setError(null)
    try {
      const prefix = selectedContact.id[0]
      const targetSheet = prefix === 'b' ? 'btob'
        : formData.typeContrat === 'comptant' ? 'btoc-comptant' : 'btoc-abonnement'
      const clientName = selectedContact.nom
      const today = formatDateFR()
      const requesterName = `${userProfile?.prenom || ''} ${userProfile?.nom || ''}`.trim() || 'Inconnu'

      const vtFormData = {
        commercial: formData.commercial, clientName, date: today,
        typeContrat: formData.typeContrat,
        puissance: formData.puissance,
        adresse: selectedContact.adresse,
        codePostal: selectedContact.codePostal,
        commune: selectedContact.ville,
        email: selectedContact.email,
        tel: selectedContact.tel,
        reventeSurplus: formData.reventeSurplus,
        contratMaintenance: formData.contratMaintenance,
        batterie: formData.batterie,
        priseSécurisée: formData.priseSécurisée,
      }

      addVTRequest(targetSheet, {
        commercial: formData.commercial, clientName, dateDemandeVT: today, vtFormData,
      })

      // Send email to technicians (only for non-old sheets)
      if (!targetSheet.endsWith('-old')) {
        sendVTRequestEmail({
          nom_client:     clientName,
          commercial:     formData.commercial || '',
          adresse:        selectedContact.adresse || '',
          ville:          selectedContact.ville || '',
          code_postal:    selectedContact.codePostal || '',
          total_ttc:      '',
          date_signature: '',
          telephone:      selectedContact.tel || '',
          email_client:   selectedContact.email || '',
          type_contrat:   formData.typeContrat || '',
          puissance:      formData.puissance || '',
        }).catch(err => console.warn('VT email failed:', err))
      }

      notifyAllExcept(
        userProfile?.id, 'vt_request',
        'Nouvelle demande de VT',
        `Faite par ${requesterName} pour ${clientName}`,
        { target_sheet: targetSheet }
      )

      const contactId = selectedContact.id
      const actBase = { contact_id: contactId, created_by: userProfile?.id || null, created_by_name: requesterName }

      const acts = [
        supabasePost('contact_activities', {
          ...actBase, type: 'transaction', title: 'Nouvelle transaction créée',
          body: `Un nouveau projet solaire a été créé pour ${clientName}.`,
        }),
        supabasePost('contact_activities', {
          ...actBase, type: 'pdf', title: 'Formulaire de demande VT généré',
          body: JSON.stringify({
            filename: `Formulaire_VT_${clientName.replace(/\s+/g, '_')}.pdf`,
            vtFormData,
          }),
        }),
      ]

      // Only create task list if none exists yet
      const existingTasks = await supabaseGet('contact_task_lists', {
        contact_id: `eq.${contactId}`, select: 'tasks',
      })
      const hasExistingTasks = existingTasks?.length > 0 && existingTasks[0].tasks?.length > 0
      if (!hasExistingTasks) {
        const defaultTasks = DEFAULT_SOLAR_TASKS.map(t => ({ ...t, id: crypto.randomUUID() }))
        await supabaseUpsert('contact_task_lists', {
          contact_id: contactId, tasks: defaultTasks, updated_at: new Date().toISOString(),
        }, 'contact_id')
        acts.push(supabasePost('contact_activities', {
          ...actBase, type: 'task', title: 'Liste de tâches créée',
          body: `${defaultTasks.length} tâches créées automatiquement pour le projet solaire.`,
        }))
      }

      await Promise.allSettled(acts)

      onCreated?.(`Transaction créée pour ${clientName}`)
    } catch (err) {
      console.error(err)
      setError('Erreur lors de la création de la transaction.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="ct-panel-backdrop" onClick={onClose} />
      <aside className="ct-add-panel">
        <div className="ct-panel-header">
          <span className="ct-panel-title">Ajouter une transaction</span>
          <button className="ct-panel-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="ct-panel-body">
            <form onSubmit={handleSubmit} id="tx-add-form">
              {error && <div className="error-message">{error}</div>}

              <div className="form-section-title">Client</div>

              <div className="form-group">
                <label>Contact associé</label>
                {lockedContact ? (
                  <div className="tx-client-locked">
                    <div className="tx-client-locked-name">{lockedContact.nom}</div>
                    {[lockedContact.adresse, lockedContact.codePostal, lockedContact.ville]
                      .filter(Boolean).length > 0 && (
                      <div className="tx-client-locked-sub">
                        {[lockedContact.adresse, lockedContact.codePostal, lockedContact.ville].filter(Boolean).join(', ')}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="tx-client-combo" ref={comboRef}>
                      <input
                        type="text"
                        className="tx-client-input"
                        placeholder="Rechercher un contact…"
                        value={clientQuery}
                        onChange={e => {
                          setClientQuery(e.target.value)
                          setSelectedContact(null)
                          setShowDropdown(true)
                        }}
                        onFocus={() => setShowDropdown(true)}
                        autoComplete="off"
                      />
                      {showDropdown && (
                        <div className="tx-client-dropdown">
                          {filteredContacts.length === 0 ? (
                            <div className="tx-client-empty">Aucun contact trouvé</div>
                          ) : filteredContacts.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              className="tx-client-option"
                              onMouseDown={() => handleSelectContact(c)}
                            >
                              <span className="tx-client-option-name">{c.nom}</span>
                              {c.email && <span className="tx-client-option-sub">{c.email}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {selectedContact && (
                      <div className="tx-client-preview">
                        {[selectedContact.adresse, selectedContact.codePostal, selectedContact.ville]
                          .filter(Boolean).join(', ')}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="form-section-title">Projet</div>

              <div className="form-group">
                <label>Commercial</label>
                <select name="commercial" value={formData.commercial} onChange={handleChange} required>
                  <option value="">Sélectionnez un commercial</option>
                  {commerciaux.map(c => (
                    <option key={c.id} value={`${c.prenom} ${c.nom}`}>{c.prenom} {c.nom}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Type de contrat</label>
                <select
                  name="typeContrat"
                  value={formData.typeContrat}
                  onChange={handleChange}
                  disabled={selectedContact?.id[0] === 'b'}
                >
                  <option value="comptant">Comptant</option>
                  <option value="abonnement">Abonnement</option>
                </select>
                {selectedContact?.id[0] === 'b' && (
                  <span className="form-hint">Client BtoB — onglet dédié</span>
                )}
              </div>

              <div className="form-group">
                <label>Puissance envisagée (kWc)</label>
                <input
                  type="text" name="puissance"
                  value={formData.puissance} onChange={handleChange}
                  placeholder="Ex: 3, 6, 9…"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>AC avec revente du surplus</label>
                  <select name="reventeSurplus" value={formData.reventeSurplus} onChange={handleChange}>
                    <option value="">-</option>
                    <option value="oui">Oui</option>
                    <option value="non">Non</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Contrat de maintenance</label>
                  <select name="contratMaintenance" value={formData.contratMaintenance} onChange={handleChange}>
                    <option value="">-</option>
                    <option value="oui">Oui</option>
                    <option value="non">Non</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Batterie</label>
                  <input type="text" name="batterie" value={formData.batterie} onChange={handleChange} placeholder="Batterie" />
                </div>
                <div className="form-group">
                  <label>Prise sécurisée</label>
                  <input type="text" name="priseSécurisée" value={formData.priseSécurisée} onChange={handleChange} placeholder="Prise sécurisée" />
                </div>
              </div>

            </form>
        </div>

          <div className="ct-panel-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Annuler
            </button>
            <button type="submit" form="tx-add-form" className="btn btn-primary" disabled={loading || !canSubmit}>
              {loading ? 'Envoi…' : 'Créer la transaction'}
            </button>
          </div>
      </aside>
    </>
  )
}

// ── Kanban board ──────────────────────────────────────────────
const KANBAN_ORDER = ['lead', 'signe', 'vt_cours', 'vt_validee', 'dp_cours', 'dp_lancee', 'cno', 'installe']

function KanbanView({ rows, slotMap, onRowClick }) {
  const cancelledCards = rows.filter(r => r.phaseSlot === '__cancelled')
  const columns = [
    ...KANBAN_ORDER.map(slot => {
      const entry = slotMap[slot] || {}
      const name  = entry.name  || SLOT_FALLBACK[slot] || slot
      const color = entry.color || '#94a3b8'
      const cards = rows.filter(r => r.phaseSlot === slot)
      const total = cards.reduce((sum, r) => {
        const n = parseFloat(String(r.montant || '').replace(/[^\d.-]/g, ''))
        return sum + (isNaN(n) ? 0 : n)
      }, 0)
      return { slot, name, color, cards, total }
    }),
    ...(cancelledCards.length > 0 ? [{ slot: '__cancelled', name: 'Annulé', color: '#ef4444', cards: cancelledCards, total: 0 }] : []),
  ]

  return (
    <div className="pb-board">
      {columns.map(col => (
        <div key={col.slot} className="pb-col">
          <div className="pb-col-header" style={{ borderTopColor: col.color }}>
            <div className="pb-col-title">
              <span className="pb-col-dot" style={{ background: col.color }} />
              <span className="pb-col-name">{col.name}</span>
              <span className="pb-col-count" style={{ background: col.color }}>{col.cards.length}</span>
            </div>
            {col.total > 0 && (
              <div className="pb-col-total">
                {col.total.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
              </div>
            )}
          </div>
          <div className="pb-col-body">
            {col.cards.length === 0 ? (
              <div className="pb-col-empty">Aucune transaction</div>
            ) : col.cards.map(card => (
              <div key={card.id} className={`pb-card${card.cancelled ? ' pb-card--cancelled' : ''}`} onClick={() => onRowClick(card)}>
                <div className="pb-card-name">{card.nom}</div>
                <div className="pb-card-footer">
                  <span className="pb-card-owner">{card.commercial}</span>
                  {card.cancelled
                    ? <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626' }}>Annulé</span>
                    : card.montant && <span className="pb-card-amount">{card.montant}</span>
                  }
                </div>
                {card.dateCloture && <div className="pb-card-date">{card.dateCloture}</div>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Pipeline controls ─────────────────────────────────────────
function PipelineControls({ count, pipelineName, onToggleSettings, settingsActive, searchQuery, onSearchChange, view, onViewChange }) {
  const [pipelineOpen, setPipelineOpen] = useState(false)
  const [searchActive, setSearchActive] = useState(false)
  const pipelineRef    = useRef(null)
  const searchInputRef = useRef(null)

  useEffect(() => {
    const h = e => { if (pipelineRef.current && !pipelineRef.current.contains(e.target)) setPipelineOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const toggleSearch = () => {
    if (searchActive) { setSearchActive(false); onSearchChange('') }
    else { setSearchActive(true); setTimeout(() => searchInputRef.current?.focus(), 50) }
  }

  return (
    <div className="tx-pipeline-controls">
      <div className="pipeline-selector" ref={pipelineRef}>
        <button className="pipeline-name-btn" onClick={() => setPipelineOpen(p => !p)}>
          {pipelineName} — N°{count}
          <ChevronDown size={11} />
        </button>
        {pipelineOpen && (
          <div className="pipeline-dropdown">
            <button className="pipeline-dropdown-item"
              onClick={() => { window.open('/pipeline', '_blank'); setPipelineOpen(false) }}>
              <Settings2 size={13} />
              Modifier le pipeline
            </button>
          </div>
        )}
      </div>

      <div className="tx-ctrl-sep" />

      <button
        className={`tx-ctrl-btn ${view === 'table' ? 'tx-ctrl-btn--active' : ''}`}
        onClick={() => onViewChange('table')}
        title="Vue tableau"
      >
        <LayoutList size={14} />
      </button>
      <button
        className={`tx-ctrl-btn ${view === 'kanban' ? 'tx-ctrl-btn--active' : ''}`}
        onClick={() => onViewChange('kanban')}
        title="Vue Kanban"
      >
        <LayoutGrid size={14} />
      </button>

      <div className="tx-ctrl-sep" />

      {searchActive && (
        <div className="tx-search-wrap">
          <Search size={12} className="tx-search-icon" />
          <input ref={searchInputRef} className="tx-search-input" placeholder="Rechercher..."
            value={searchQuery} onChange={e => onSearchChange(e.target.value)} />
          <button className="tx-search-clear" onClick={toggleSearch}><X size={12} /></button>
        </div>
      )}

      <button className={`tx-ctrl-btn ${searchActive ? 'tx-ctrl-btn--active' : ''}`} onClick={toggleSearch} title="Rechercher">
        <Search size={14} />
      </button>
      <button className="tx-ctrl-btn" title="Trier"><ArrowUpDown size={14} /></button>
      <button className={`tx-ctrl-btn ${settingsActive ? 'tx-ctrl-btn--active' : ''}`} onClick={onToggleSettings} title="Paramètres">
        <SlidersHorizontal size={14} />
      </button>
    </div>
  )
}

// ── Settings panel ────────────────────────────────────────────
function SettingsPanel({ pipelineName, onPipelineNameChange, onExport, onSave, onReset, onClose }) {
  return (
    <>
      <div className="tx-panel-backdrop" onClick={onClose} />
      <aside className="tx-settings-panel">
        <div className="tx-panel-header">
          <span className="tx-panel-title">Paramètres</span>
          <button className="tx-panel-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="tx-panel-body">
          <div className="tx-panel-section">
            <label className="tx-panel-label">Nom du pipeline</label>
            <input className="tx-panel-name-input" value={pipelineName}
              onChange={e => onPipelineNameChange(e.target.value)} />
            <p className="tx-panel-hint">Ce nom apparaît dans l'en-tête et sur la page de configuration.</p>
          </div>
          <div className="tx-panel-sep" />
          <div className="tx-panel-section">
            <label className="tx-panel-label">Actions</label>
            <button className="tx-panel-action-btn" onClick={onExport}>
              <Download size={14} /> Exporter en PDF
            </button>
          </div>
          <div className="tx-panel-sep" />
          <div className="tx-panel-section">
            <button className="tx-panel-save-btn" onClick={onSave}>
              <Save size={14} /> Enregistrer les modifications
            </button>
            <button className="tx-panel-reset-btn" onClick={onReset}>
              <RotateCcw size={14} /> Réinitialiser à la dernière sauvegarde
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

// ── PDF export ────────────────────────────────────────────────
function exportToPDF(rows, slotMap, pipelineName) {
  const headers = ['Nom', 'Phase', 'Date de fermeture', 'Propriétaire', 'Montant']
  const tableRows = rows.map(row => {
    const phaseName = slotMap[row.phaseSlot]?.name || SLOT_FALLBACK[row.phaseSlot] || row.phaseSlot
    return `<tr><td>${row.nom||''}</td><td>${phaseName}</td><td>${row.dateCloture||''}</td><td>${row.commercial||''}</td><td>${row.montant||''}</td></tr>`
  }).join('')
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${pipelineName}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;margin:24px}h1{font-size:18px}
    table{width:100%;border-collapse:collapse}th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:11px;border-bottom:2px solid #e2e8f0}
    td{padding:7px 10px;border-bottom:1px solid #f1f5f9}</style>
  </head><body><h1>${pipelineName}</h1>
    <p style="color:#666;font-size:11px">Exporté le ${new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'})}</p>
    <table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${tableRows}</tbody></table>
  </body></html>`
  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 500) }
}

// ── Main ──────────────────────────────────────────────────────
export default function Transactions() {
  const rows    = useTransactions()
  const slotMap = useSlotMap()
  const COLUMNS = useMemo(() => makeColumns(slotMap), [slotMap])

  const [showSettings,        setShowSettings]        = useState(false)
  const [showAdd,             setShowAdd]             = useState(false)
  const [searchQuery,         setSearchQuery]         = useState('')
  const [toast,               setToast]               = useState(null)
  const [activeTransactionId, setActiveTransactionId] = useState(null)
  const [view,                setView]                = useState('table')

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3000) }
  const [pipelineName, setPipelineName] = useState(
    () => localStorage.getItem(PIPELINE_NAME_KEY) || 'Pipeline de transaction'
  )
  const [savedName, setSavedName] = useState(pipelineName)

  useEffect(() => {
    let mounted = true
    supabaseGet('pipeline_configs', { config_key: 'eq.main', select: 'name' })
      .then(data => {
        if (!mounted) return
        const name = data?.[0]?.name
        if (name) { setPipelineName(name); setSavedName(name); localStorage.setItem(PIPELINE_NAME_KEY, name) }
      })
    const sync = () => { const n = localStorage.getItem(PIPELINE_NAME_KEY); if (n) setPipelineName(n) }
    window.addEventListener('storage', sync)
    window.addEventListener('pipelineUpdated', sync)
    return () => {
      mounted = false
      window.removeEventListener('storage', sync)
      window.removeEventListener('pipelineUpdated', sync)
    }
  }, [])

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows
    const q = searchQuery.toLowerCase()
    return rows.filter(r => {
      const phaseName = slotMap[r.phaseSlot]?.name || SLOT_FALLBACK[r.phaseSlot] || ''
      return [r.nom, phaseName, r.commercial, r.dateCloture, r.montant]
        .some(v => String(v || '').toLowerCase().includes(q))
    })
  }, [rows, searchQuery, slotMap])

  const handleSave = () => {
    localStorage.setItem(PIPELINE_NAME_KEY, pipelineName)
    setSavedName(pipelineName)
    window.dispatchEvent(new Event('pipelineUpdated'))
  }

  const handleReset = () => {
    setPipelineName(savedName)
    localStorage.setItem(PIPELINE_NAME_KEY, savedName)
    window.dispatchEvent(new Event('pipelineUpdated'))
  }

  const handlePipelineNameChange = (name) => {
    setPipelineName(name)
    localStorage.setItem(PIPELINE_NAME_KEY, name)
    window.dispatchEvent(new Event('pipelineUpdated'))
  }

  if (activeTransactionId) {
    return (
      <TransactionDetail
        transactionId={activeTransactionId}
        onBack={() => setActiveTransactionId(null)}
        backLabel="Transactions"
      />
    )
  }

  return (
    <>
      {toast && <PageToast message={toast} />}
      <DossierListPage
        title="Transactions"
        addLabel="Ajouter une transaction"
        onAdd={() => setShowAdd(true)}
        tabs={['Tous les transactions', 'Mes transactions']}
        columns={COLUMNS}
        rows={filteredRows}
        alwaysShowTable
        onRowClick={row => setActiveTransactionId(row.id)}
        emptyIcon={<Zap size={34} strokeWidth={1.5} />}
        emptyTitle="Aucune transaction"
        emptyDesc="Les transactions issues de toutes les feuilles apparaîtront ici."
        contentOverride={view === 'kanban'
          ? <KanbanView rows={filteredRows} slotMap={slotMap} onRowClick={row => setActiveTransactionId(row.id)} />
          : undefined
        }
        rightTabsContent={
          <PipelineControls
            count={rows.length}
            pipelineName={pipelineName}
            onToggleSettings={() => setShowSettings(p => !p)}
            settingsActive={showSettings}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            view={view}
            onViewChange={setView}
          />
        }
      />
      {showAdd && (
        <AddTransactionPanel
          onClose={() => setShowAdd(false)}
          onCreated={msg => { setShowAdd(false); if (msg) showToast(msg) }}
        />
      )}
      {showSettings && (
        <SettingsPanel
          pipelineName={pipelineName}
          onPipelineNameChange={handlePipelineNameChange}
          onExport={() => exportToPDF(filteredRows, slotMap, pipelineName)}
          onSave={handleSave}
          onReset={handleReset}
          onClose={() => setShowSettings(false)}
        />
      )}
    </>
  )
}
