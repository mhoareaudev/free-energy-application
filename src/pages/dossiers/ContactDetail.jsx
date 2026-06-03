import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ArrowLeft, ChevronDown, UserPlus, Mail,
  CheckSquare, Calendar, MoreHorizontal, Plus, Zap, Building2,
  Paperclip, StickyNote, PhoneCall, Trash2, X, AlertTriangle, CheckCircle2, FileText, GripVertical, Ticket, Ban,
  Edit2, Send,
} from 'lucide-react'
import { downloadVTPdfAuto } from '../../utils/generateVTPdf'
import { useSpreadsheet } from '../../context/SpreadsheetContext'
import { getColumnIdToLetterMap } from '../../data/sheetsConfig'
import { supabaseGet, supabaseDelete, supabaseUpsert, supabasePost, storageUpload } from '../../lib/supabase'
import { supabase } from '../../lib/supabase'
import { ilioSupabase } from '../../lib/ilioSupabase'
import { PIPELINE_PHASES_KEY, DEFAULT_PHASES } from '../PipelineConfig'
import { TicketDrawer, useTechnicians } from '../Tickets'
import { useAuth } from '../../context/AuthContext'
import '../Tickets.css'
import { AddTransactionPanel } from './Transactions'
import './ContactDetail.css'

const INSTALL_LABELS = {
  chauffe_eau_solaire:      'Chauffe-eau solaire',
  borne_recharge:           'Borne de recharge',
  maintenance_pv:           'Maintenance PV',
  maintenance_industrielle: 'Maintenance industrielle',
  autre_installation:       'Autre',
}

const ILIO_STATUS_MAP = {
  nouveau:    { label: 'Nouveau',    color: '#ea580c', bg: '#fff7ed' },
  en_cours:   { label: 'En cours',   color: '#d97706', bg: '#fffbeb' },
  en_attente: { label: 'En attente', color: '#7c3aed', bg: '#f5f3ff' },
  incomplet:  { label: 'Incomplet',  color: '#ca8a04', bg: '#fefce8' },
  termine:    { label: 'Terminé',    color: '#16a34a', bg: '#f0fdf4' },
  ferme:      { label: 'Fermé',      color: '#64748b', bg: '#f1f5f9' },
  annule:     { label: 'Annulé',     color: '#dc2626', bg: '#fef2f2' },
}

const CONTACT_TYPES = [
  { value: 'recommendation', label: 'Recommandation',        color: '#22c55e' },
  { value: 'web',            label: 'Web / Réseaux sociaux',  color: '#3b82f6' },
  { value: 'foire',          label: 'Foire / Salon',          color: '#8b5cf6' },
  { value: 'telephone',      label: 'Démarchage tél.',         color: '#f97316' },
  { value: 'terrain',        label: 'Prospection terrain',    color: '#f59e0b' },
  { value: 'partenaire',     label: 'Partenaire',             color: '#06b6d4' },
  { value: 'publicite',      label: 'Publicité',              color: '#ec4899' },
  { value: 'autre',          label: 'Autre',                  color: '#64748b' },
]

// ── Slot map (same pattern as Transactions) ───────────────────
const SLOT_FALLBACK = {
  installe: 'Centrale posée', cno: 'CNO reçu', dp_lancee: 'DP lancée',
  dp_cours: 'DP en cours', vt_validee: 'VT validée', vt_cours: 'VT en cours',
  signe: 'Signé', lead: 'Lead entrant',
}

function loadSlotMap() {
  try {
    const saved = localStorage.getItem(PIPELINE_PHASES_KEY)
    const phases = saved ? JSON.parse(saved) : DEFAULT_PHASES
    const map = {}
    for (const p of phases) { if (p.slot) map[p.slot] = { name: p.name, color: p.color } }
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
        if (!Array.isArray(phases) || !phases.length) return
        localStorage.setItem(PIPELINE_PHASES_KEY, JSON.stringify(phases))
        const m = {}
        for (const p of phases) { if (p.slot) m[p.slot] = { name: p.name, color: p.color } }
        setMap(m)
      })
    const sync = () => setMap(loadSlotMap())
    window.addEventListener('storage', sync)
    window.addEventListener('pipelineUpdated', sync)
    return () => { mounted = false; window.removeEventListener('storage', sync); window.removeEventListener('pipelineUpdated', sync) }
  }, [])
  return map
}

function computePhaseKey(cells, colMap, row, sheetId) {
  const get = id => { const l = colMap[id]; return l ? (cells[`${l}${row}`] || '') : '' }
  let dpDone = false
  try { const j = cells[`__dpForm:${row}`]; if (j) dpDone = JSON.parse(j).isComplete === true } catch { /* ignore */ }
  const posed = sheetId === 'btob' ? get('DATE_POSE') : get('DATE_REELLE_POSE')
  if (posed)                 return 'installe'
  if (get('RECEPTION_CNO'))  return 'cno'
  if (dpDone || get('N_DP')) return 'dp_lancee'
  if (get('DEMANDE_DP'))     return 'dp_cours'
  if (get('DATE_RETOUR_VT')) return 'vt_validee'
  if (get('DATE_DDE_VT'))    return 'vt_cours'
  if (get('SIGNE_LE'))       return 'signe'
  return 'lead'
}

// ── Contact transactions (all rows matching this client name) ─
function useContactTransactions(nom, slotMap) {
  const { sheets } = useSpreadsheet()
  return useMemo(() => {
    if (!nom) return []
    const normalizedNom = nom.toLowerCase().trim()
    const results = []

    const process = (cells, colMap, nameColId, prefix, sheetId, typeLabel, typeKey) => {
      const nameLetter       = colMap[nameColId]
      const commercialLetter = colMap['COMMERCIAL']
      if (!nameLetter || !commercialLetter) return
      const rowSet = new Set()
      Object.keys(cells).forEach(k => {
        if (k.startsWith('__')) return
        const m = k.match(/^[A-Z]+(\d+)$/)
        if (m && parseInt(m[1]) >= 2) rowSet.add(parseInt(m[1]))
      })
      rowSet.forEach(r => {
        const rowNom = cells[`${nameLetter}${r}`]
        if (!rowNom || rowNom.toLowerCase().trim() !== normalizedNom) return
        const commercial = cells[`${commercialLetter}${r}`]
        if (!commercial) return
        const cancelled = (() => { try { return JSON.parse(cells[`__cancelled:${r}`] || 'null') } catch { return null } })()
        const phaseSlot = cancelled ? '__cancelled' : computePhaseKey(cells, colMap, r, sheetId)
        const montantRaw = sheetId === 'btoc-abonnement'
          ? cells[`${colMap['MONTANT_TTC_VENTE']}${r}`]
          : cells[`${colMap['TOTAL_TTC']}${r}`]
        results.push({
          id: `${prefix}:${r}`,
          phaseSlot,
          phaseName:  cancelled ? 'Annulé' : (slotMap[phaseSlot]?.name  || SLOT_FALLBACK[phaseSlot] || phaseSlot),
          phaseColor: cancelled ? '#dc2626' : (slotMap[phaseSlot]?.color || '#64748b'),
          montant: cancelled ? '—' : fmtMontant(montantRaw || ''),
          commercial,
          typeLabel,
          typeKey,
          cancelled,
        })
      })
    }

    process(sheets['btoc-comptant']?.cells   || {}, getColumnIdToLetterMap('btoc-comptant'),   'Colonne1',  'c', 'btoc-comptant',   'Comptant',   'comptant')
    process(sheets['btoc-abonnement']?.cells || {}, getColumnIdToLetterMap('btoc-abonnement'), 'NOM_PRENOM', 'a', 'btoc-abonnement', 'Abonnement', 'abonnement')
    process(sheets['btob']?.cells            || {}, getColumnIdToLetterMap('btob'),            'NOM_PRENOM', 'b', 'btob',            'BtoB',        'btob')

    return results
  }, [sheets, nom, slotMap])
}

// ── Activity helpers ──────────────────────────────────────────
const TYPE_CONFIG = {
  creation:    { Icon: UserPlus,    color: '#22c55e', bg: '#dcfce7' },
  note:        { Icon: StickyNote,  color: '#3b82f6', bg: '#dbeafe' },
  call:        { Icon: PhoneCall,   color: '#f97316', bg: '#fed7aa' },
  email:       { Icon: Mail,        color: '#3b82f6', bg: '#dbeafe' },
  task:        { Icon: CheckSquare, color: '#f97316', bg: '#fed7aa' },
  meeting:     { Icon: Calendar,    color: '#8b5cf6', bg: '#ede9fe' },
  transaction: { Icon: Zap,         color: '#f97316', bg: '#fed7aa' },
  pdf:         { Icon: FileText,    color: '#64748b', bg: '#f1f5f9' },
  ticket:      { Icon: Ticket,      color: '#6366f1', bg: '#eef2ff' },
  cancelled:   { Icon: Ban,         color: '#dc2626', bg: '#fee2e2' },
}

const TABS = [
  { key: 'all',     label: 'Toutes les activités' },
  { key: 'note',    label: 'Notes'                },
  { key: 'email',   label: 'E-mails'              },
  { key: 'call',    label: 'Appels'               },
  { key: 'task',    label: 'Tâches'               },
  { key: 'meeting', label: 'Réunions'             },
]

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const gmt4 = new Date(d.getTime() + 4 * 60 * 60 * 1000)
  const months = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.']
  const day   = gmt4.getUTCDate()
  const month = months[gmt4.getUTCMonth()]
  const year  = gmt4.getUTCFullYear()
  const h     = String(gmt4.getUTCHours()).padStart(2, '0')
  const m     = String(gmt4.getUTCMinutes()).padStart(2, '0')
  return `${day} ${month} ${year} à ${h}h${m} GMT+4`
}

function fmtMontant(raw) {
  if (!raw) return ''
  const n = parseFloat(String(raw).replace(/[^\d.-]/g, ''))
  if (isNaN(n)) return raw
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

// ── Left: contact card ────────────────────────────────────────
function ContactCard({ nom, commercial, email, hasTransaction, onTaskClick }) {
  const initials = nom ? nom.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'
  const [plusOpen, setPlusOpen] = useState(false)
  const plusRef = useRef(null)

  useEffect(() => {
    const h = e => { if (plusRef.current && !plusRef.current.contains(e.target)) setPlusOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="cd-contact-card">
      <div className="cd-avatar">{initials}</div>
      <div className="cd-contact-name">{nom || '—'}</div>
      {commercial && <div className="cd-contact-sub">Suivi par {commercial}</div>}
      {email && <a className="cd-contact-email" href={`mailto:${email}`}>{email}</a>}
      <div className="cd-action-btns">
        {[
          { Icon: StickyNote, label: 'Note'   },
          { Icon: Mail,       label: 'E-mail' },
          { Icon: PhoneCall,  label: 'Appel'  },
        ].map(({ Icon, label }) => (
          <button key={label} className="cd-action-btn" title={label}>
            <Icon size={14} />
            <span>{label}</span>
          </button>
        ))}

        <div className="cd-action-plus-wrap" ref={plusRef}>
          <button className="cd-action-btn" onClick={() => setPlusOpen(p => !p)}>
            <MoreHorizontal size={14} />
            <span>Plus</span>
          </button>
          {plusOpen && (
            <div className="cd-action-plus-menu">
              <button className="cd-action-plus-item">
                <Calendar size={13} />
                Réunion
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Left: info section ────────────────────────────────────────
function InfoSection({ rows: infoRows }) {
  return (
    <div className="cd-info-section">
      <div className="cd-info-header">
        <span className="cd-info-title">Informations clés</span>
      </div>
      {infoRows.map(({ label, value, renderValue }) => (
        <div key={label} className="cd-info-row">
          <div className="cd-info-label">{label}</div>
          <div className={`cd-info-value${!value && !renderValue ? ' cd-info-empty' : ''}`}>
            {renderValue ? renderValue() : (value || '—')}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Middle: activity timeline ─────────────────────────────────
function ActivityTimeline({ activities, activeTab }) {
  const filtered = activeTab === 'all' ? activities : activities.filter(a => a.type === activeTab)

  if (!filtered.length) {
    return (
      <div className="cd-act-empty">
        <span>Aucune activité pour le moment.</span>
      </div>
    )
  }

  return (
    <div>
      {filtered.map(act => {
        const cfg = TYPE_CONFIG[act.type] || TYPE_CONFIG.note
        const { Icon } = cfg
        return (
          <div key={act.id} className="cd-act-item">
            <div className="cd-act-icon" style={{ background: cfg.bg }}>
              <Icon size={14} color={cfg.color} />
            </div>
            <div className="cd-act-content">
              <div className="cd-act-header">
                <span className="cd-act-title">{act.title}</span>
                <span className="cd-act-date">{fmtDate(act.created_at)}</span>
              </div>
              {act.created_by_name && (
                <div className="cd-act-author">{act.created_by_name}</div>
              )}
              {act.body && (() => {
                const parsed = typeof act.body === 'object' && act.body !== null
                  ? act.body
                  : (() => { try { return JSON.parse(act.body) } catch { return null } })()
                if (parsed?.filename) return <div className="cd-act-body">{parsed.filename}</div>
                if (typeof act.body === 'string') return <div className="cd-act-body">{act.body}</div>
                return null
              })()}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Notes panel ───────────────────────────────────────────────
function NotesPanel({ contactId, notes, onRefresh, authorName, clientName }) {
  const [text, setText]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [editId, setEditId]     = useState(null)
  const [editText, setEditText] = useState('')
  const textareaRef = useRef(null)
  const listRef     = useRef(null)

  // Scroll to bottom when notes change
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight
  }, [notes.length])

  const sortedNotes = [...notes].reverse()

  const handleSubmit = async () => {
    if (!text.trim()) return
    setSaving(true)
    await supabasePost('contact_activities', {
      contact_id:      contactId,
      type:            'note',
      title:           `Nouvelle note${clientName ? ` pour ${clientName}` : ''}`,
      body:            text.trim(),
      created_by_name: authorName,
    })
    setText('')
    setSaving(false)
    onRefresh()
  }

  const handleDelete = async id => {
    await supabaseDelete('contact_activities', { id: `eq.${id}` })
    onRefresh()
  }

  const startEdit = note => {
    setEditId(note.id)
    setEditText(note.body || note.title || '')
  }

  const handleSaveEdit = async () => {
    if (!editText.trim()) return
    await supabase.from('contact_activities').update({
      title: editText.trim().slice(0, 80),
      body:  editText.trim(),
    }).eq('id', editId)
    setEditId(null)
    setEditText('')
    onRefresh()
  }

  return (
    <div className="cd-notes">
      {/* List */}
      {sortedNotes.length === 0 ? (
        <div className="cd-notes-list" ref={listRef} style={{ justifyContent:'center', alignItems:'center', display:'flex' }}>
          <span style={{ color:'#94a3b8', fontSize:'13px', fontStyle:'italic' }}>Aucune note pour le moment.</span>
        </div>
      ) : (
        <div className="cd-notes-list" ref={listRef}>
          {sortedNotes.map(note => (
            <div key={note.id} className="cd-note-item">
              <div className="cd-note-header">
                <div className="cd-note-meta">
                  <span className="cd-note-author">{note.created_by_name || 'Inconnu'}</span>
                  <span className="cd-note-dot">·</span>
                  <span className="cd-note-date">{fmtDate(note.created_at)}</span>
                </div>
                <div className="cd-note-actions">
                  <button className="cd-note-btn" title="Modifier" onClick={() => startEdit(note)}>
                    <Edit2 size={12} />
                  </button>
                  <button className="cd-note-btn cd-note-btn--delete" title="Supprimer" onClick={() => handleDelete(note.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              {editId === note.id ? (
                <div className="cd-note-edit">
                  <textarea
                    className="cd-notes-textarea"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    rows={3}
                    autoFocus
                  />
                  <div className="cd-notes-composer-footer">
                    <button className="cd-note-cancel" onClick={() => setEditId(null)}>Annuler</button>
                    <button className="cd-notes-submit" onClick={handleSaveEdit} disabled={!editText.trim()}>
                      <CheckCircle2 size={13} />
                      Enregistrer
                    </button>
                  </div>
                </div>
              ) : (
                <div className="cd-note-body">{note.body || note.title}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Composer — toujours en bas */}
      <div className="cd-notes-composer">
        <textarea
          ref={textareaRef}
          className="cd-notes-textarea"
          placeholder="Écrire une note…"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit() }}
          rows={3}
        />
        <div className="cd-notes-composer-footer">
          <span className="cd-notes-hint">Ctrl+Entrée pour publier</span>
          <button
            className="cd-notes-submit"
            onClick={handleSubmit}
            disabled={saving || !text.trim()}
          >
            <Send size={13} />
            {saving ? 'Envoi…' : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Right: ilio tickets section ───────────────────────────────
function IlioTicketsSection({ email, nom, tel, adresse, codePostal, ville }) {
  const [tickets, setTickets]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const technicians = useTechnicians()

  const load = () => {
    if (!email) { setLoading(false); return }
    ilioSupabase
      .from('tickets')
      .select('id,reference,subject,description,status,created_at,installation_type,intervention_date')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setTickets(data || []); setLoading(false) })
  }

  useEffect(() => { load() }, [email])

  const handleCreate = async payload => {
    const { data: created, error } = await ilioSupabase
      .from('tickets')
      .insert([payload])
      .select()
      .single()
    if (error) throw error
    setTickets(prev => [created, ...prev])
  }

  const fmtD = str => str
    ? new Date(str).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
    : ''

  // Pre-fill form with contact data
  const prefilled = {
    client_name:      nom?.split(' ').slice(1).join(' ') || nom || '',
    client_firstname: nom?.split(' ')[0] || '',
    email:            email || '',
    phone:            tel || '',
    address:          adresse || '',
    postal_code:      codePostal || '',
    commune:          ville || '',
  }

  return (
    <div className="cd-rp-section">
      <div className="cd-rp-header">
        <span className="cd-rp-title">
          <Ticket size={13} />
          Tickets Ilio
          {tickets.length > 0 && <span className="cd-rp-count">({tickets.length})</span>}
        </span>
        <button className="cd-rp-add" onClick={() => setShowCreate(true)}>
          <Plus size={11} /> Ajouter
        </button>
      </div>

      {loading ? (
        <div className="cd-rp-empty"><p className="cd-rp-empty-text">Chargement…</p></div>
      ) : tickets.length === 0 ? (
        <div className="cd-rp-empty">
          <div className="cd-rp-empty-icon"><Ticket size={18} /></div>
          <p className="cd-rp-empty-text">Aucun ticket associé.</p>
        </div>
      ) : (
        <div className="cd-rp-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tickets.map(t => {
            const s = ILIO_STATUS_MAP[t.status] || { label: t.status, color: '#64748b', bg: '#f8fafc' }
            return (
              <div key={t.id} className="cd-rp-tx-card">
                <div className="cd-rp-tx-name" style={{ fontFamily: 'monospace', color: '#3b82f6', fontWeight: 700, fontSize: 12 }}>
                  {t.reference}
                </div>
                {(t.subject || t.description) && (
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                    {t.subject || t.description?.slice(0, 60)}
                  </div>
                )}
                <div className="cd-rp-tx-meta" style={{ marginTop: 4 }}>
                  <span style={{
                    background: s.bg, color: s.color,
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                  }}>{s.label}</span>
                  {t.installation_type && INSTALL_LABELS[t.installation_type] && (
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{INSTALL_LABELS[t.installation_type]}</span>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>{fmtD(t.created_at)}</div>
              </div>
            )
          })}
        </div>
      )}

      {showCreate && (
        <TicketDrawer
          ticket={null}
          technicians={technicians}
          prefill={prefilled}
          onClose={() => setShowCreate(false)}
          onCreate={async payload => { await handleCreate(payload); setShowCreate(false) }}
          onSave={null}
        />
      )}
    </div>
  )
}

// ── Right: related panel ──────────────────────────────────────
function RightPanel({ nom, email, tel, adresse, codePostal, ville, transactions, activities, onAddTransaction, onTransactionClick, contactId, onRefreshActivities, uploaderName }) {
  const docActivities = activities.filter(a => a.type === 'pdf' || a.type === 'fiche-vt' || a.type === 'document')

  const parseBody = b => typeof b === 'object' && b !== null ? b : (() => { try { return JSON.parse(b) } catch { return null } })()

  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const uploadFree = async file => {
    if (!file || !contactId) return
    setUploading(true)
    try {
      const path = `attachments/${contactId}/${Date.now()}_${file.name}`
      const { publicUrl } = await storageUpload('documents', path, file)
      await supabasePost('contact_activities', {
        contact_id: contactId,
        type: 'document',
        title: file.name,
        body: JSON.stringify({ url: publicUrl, filename: file.name }),
        created_by_name: uploaderName,
      })
      onRefreshActivities?.()
    } catch (e) { console.error(e) }
    finally { setUploading(false) }
  }

  const deleteDoc = async id => {
    await supabaseDelete('contact_activities', { id: `eq.${id}` })
    onRefreshActivities?.()
  }

  return (
    <>
      {/* Transactions */}
      <div className="cd-rp-section">
        <div className="cd-rp-header">
          <span className="cd-rp-title">
            <Zap size={13} />
            Transactions
            {transactions.length > 0 && <span className="cd-rp-count">({transactions.length})</span>}
          </span>
          <button className="cd-rp-add" onClick={onAddTransaction}><Plus size={11} /> Ajouter</button>
        </div>
        {transactions.length === 0 ? (
          <div className="cd-rp-empty">
            <div className="cd-rp-empty-icon"><Zap size={18} /></div>
            <p className="cd-rp-empty-text">Aucune transaction associée.</p>
          </div>
        ) : (
          <div className="cd-rp-body" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {transactions.map(tx => (
              <div
                key={tx.id}
                className={`cd-rp-tx-card${onTransactionClick ? ' cd-rp-tx-card--clickable' : ''}`}
                onClick={() => onTransactionClick?.(tx.id)}
              >
                <div className="cd-rp-tx-name">{nom}</div>
                <div className="cd-rp-tx-meta">
                  <span style={{
                    background: tx.phaseColor + '22', color: tx.phaseColor,
                    fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '99px',
                  }}>
                    {tx.phaseName}
                  </span>
                  {tx.montant && <span className="cd-rp-tx-amount">{tx.montant}</span>}
                </div>
                <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '4px' }}>
                  {tx.typeLabel}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Entreprises */}
      <div className="cd-rp-section">
        <div className="cd-rp-header">
          <span className="cd-rp-title">
            <Building2 size={13} />
            Entreprises
            <span className="cd-rp-count">(0)</span>
          </span>
          <button className="cd-rp-add"><Plus size={11} /> Ajouter</button>
        </div>
        <div className="cd-rp-empty">
          <div className="cd-rp-empty-icon"><Building2 size={18} /></div>
          <p className="cd-rp-empty-text">Aucune entreprise associée.</p>
        </div>
      </div>

      {/* Pièces jointes */}
      <div className="cd-rp-section">
        <div className="cd-rp-header">
          <span className="cd-rp-title">
            <Paperclip size={13} />
            Pièces jointes
            {docActivities.length > 0 && <span className="cd-rp-count">({docActivities.length})</span>}
          </span>
          <button
            className="cd-rp-add"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); uploadFree(e.dataTransfer.files[0]) }}
            style={dragging ? { background: '#eff6ff', borderColor: '#3b82f6', color: '#3b82f6' } : undefined}
          >
            <Plus size={11} /> {uploading ? '…' : 'Ajouter'}
          </button>
          <input ref={fileRef} type="file" style={{ display: 'none' }}
            onChange={e => { uploadFree(e.target.files[0]); e.target.value = '' }} />
        </div>
        {docActivities.length === 0 ? (
          <div className="cd-rp-empty">
            <div className="cd-rp-empty-icon"><Paperclip size={18} /></div>
            <p className="cd-rp-empty-text">Aucun fichier joint.</p>
          </div>
        ) : (
          <div className="cd-rp-body" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {docActivities.map(act => {
              const body = parseBody(act.body)
              const url  = body?.url || null
              const name = body?.filename || act.title

              if (act.type === 'document') {
                const Tag = url ? 'a' : 'div'
                const linkProps = url ? { href: url, target: '_blank', rel: 'noreferrer' } : {}
                return (
                  <Tag key={act.id} className={`cd-rp-attachment${url ? ' cd-rp-attachment--link' : ''}`} {...linkProps}>
                    <FileText size={13} color="#3b82f6" style={{ flexShrink: 0 }} />
                    <span className="cd-rp-attachment-name">{name}</span>
                    <button
                      className="cd-rp-delete-btn"
                      title="Supprimer"
                      onClick={e => { e.preventDefault(); e.stopPropagation(); deleteDoc(act.id) }}
                    >
                      <X size={11} />
                    </button>
                  </Tag>
                )
              }

              // fiche-vt / pdf
              const vtFormData = body?.vtFormData || null
              const filename = body?.filename || act.title
              return (
                <div key={act.id} className={`cd-rp-attachment${vtFormData ? ' cd-rp-attachment--link' : ''}`}
                  style={{ cursor: vtFormData ? 'pointer' : 'default' }}
                  onClick={() => vtFormData && downloadVTPdfAuto(vtFormData, filename)}
                >
                  <FileText size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
                  <span className="cd-rp-attachment-name">{filename}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Tickets Ilio */}
      {email && (
        <IlioTicketsSection
          email={email}
          nom={nom}
          tel={tel}
          adresse={adresse}
          codePostal={codePostal}
          ville={ville}
        />
      )}
    </>
  )
}

// ── Task panel ────────────────────────────────────────────────
function TaskListInline({ contactId }) {
  const [tasks, setTasks]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [newTitle, setNewTitle] = useState('')
  const [editId, setEditId]     = useState(null)
  const [editText, setEditText] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    supabaseGet('contact_task_lists', { contact_id: `eq.${contactId}`, select: 'tasks' })
      .then(data => { setTasks(data?.[0]?.tasks || []); setLoading(false) })
  }, [contactId])

  const persist = async updated => {
    setTasks(updated)
    await supabaseUpsert('contact_task_lists', {
      contact_id: contactId, tasks: updated, updated_at: new Date().toISOString(),
    }, 'contact_id')
  }

  const addTask = () => {
    if (!newTitle.trim()) return
    persist([...tasks, { id: crypto.randomUUID(), title: newTitle.trim(), completed: false }])
    setNewTitle('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const toggleTask = id => persist(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))

  const deleteTask = id => persist(tasks.filter(t => t.id !== id))

  const saveEdit = () => {
    if (!editText.trim()) return
    persist(tasks.map(t => t.id === editId ? { ...t, title: editText.trim() } : t))
    setEditId(null); setEditText('')
  }

  if (loading) return <div className="cd-act-empty"><span>Chargement…</span></div>

  return (
    <div className="cd-tasks-panel">
      {/* Ajouter */}
      <div className="cd-task-add-row">
        <input
          ref={inputRef}
          className="cd-task-add-input"
          placeholder="Nouvelle tâche…"
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addTask() }}
        />
        <button className="cd-task-add-confirm" onClick={addTask} disabled={!newTitle.trim()}>
          <Plus size={14} />
          Ajouter
        </button>
      </div>

      {/* Liste */}
      {tasks.length === 0 ? (
        <div className="cd-act-empty"><span>Aucune tâche pour le moment.</span></div>
      ) : (
        <div className="cd-task-list-simple">
          {tasks.map(task => (
            <div key={task.id} className={`cd-task-simple-item${task.completed ? ' cd-task-simple-item--done' : ''}`}>
              <input
                type="checkbox"
                className="cd-task-check"
                checked={task.completed}
                onChange={() => toggleTask(task.id)}
              />
              {editId === task.id ? (
                <div className="cd-task-edit-row">
                  <input
                    autoFocus
                    className="cd-task-add-input"
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit()
                      if (e.key === 'Escape') { setEditId(null); setEditText('') }
                    }}
                  />
                  <button className="cd-task-add-confirm" onClick={saveEdit}><CheckCircle2 size={13} /></button>
                  <button className="cd-task-add-cancel" onClick={() => { setEditId(null); setEditText('') }}>✕</button>
                </div>
              ) : (
                <span className="cd-task-title">{task.title}</span>
              )}
              {editId !== task.id && (
                <div className="cd-task-simple-actions">
                  <button className="cd-note-btn" title="Modifier" onClick={() => { setEditId(task.id); setEditText(task.title) }}>
                    <Edit2 size={12} />
                  </button>
                  <button className="cd-note-btn cd-note-btn--delete" title="Supprimer" onClick={() => deleteTask(task.id)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Delete modal ─────────────────────────────────────────────
function DeleteModal({ nom, onConfirm, onCancel, loading }) {
  return (
    <div className="cd-modal-backdrop" onClick={onCancel}>
      <div className="cd-modal" onClick={e => e.stopPropagation()}>
        <div className="cd-modal-header">
          <div className="cd-modal-icon"><AlertTriangle size={20} /></div>
          <div className="cd-modal-head-text">
            <h3 className="cd-modal-title">Supprimer le contact</h3>
            <p className="cd-modal-subtitle">Cette action est irréversible.</p>
          </div>
          <button className="cd-modal-x" onClick={onCancel}><X size={16} /></button>
        </div>
        <div className="cd-modal-body">
          <p>Vous êtes sur le point de supprimer <strong>{nom}</strong> ainsi que toutes les données associées : activités, transactions et pièces jointes.</p>
        </div>
        <div className="cd-modal-footer">
          <button className="cd-modal-cancel" onClick={onCancel} disabled={loading}>Annuler</button>
          <button className="cd-modal-delete" onClick={onConfirm} disabled={loading}>
            <Trash2 size={13} />
            {loading ? 'Suppression...' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function ContactDetail({ contactId, onBack, onTransactionClick, onTypeChange, ilioContact }) {
  const isIlio = !!ilioContact

  const [prefix, rowStr] = isIlio ? ['', '0'] : contactId.split(':')
  const rowNum  = parseInt(rowStr) || 0
  const sheetId = isIlio ? 'btoc-comptant' : (prefix === 'c' ? 'btoc-comptant' : prefix === 'a' ? 'btoc-abonnement' : 'btob')
  const clientColId = sheetId === 'btoc-comptant' ? 'Colonne1' : 'NOM_PRENOM'

  const { sheets, clearContactRow } = useSpreadsheet()
  const { userProfile } = useAuth()
  const loggedInName = [userProfile?.prenom, userProfile?.nom].filter(Boolean).join(' ') || 'Inconnu'
  const colMap      = useMemo(() => getColumnIdToLetterMap(sheetId), [sheetId])
  const cells       = isIlio ? {} : (sheets[sheetId]?.cells || {})
  const get         = colId => { const l = colMap[colId]; return l ? (cells[`${l}${rowNum}`] || '') : '' }

  const nom        = isIlio ? (ilioContact.nom        || '') : get(clientColId)
  const email      = isIlio ? (ilioContact.email      || '') : get('EMAIL')
  const tel        = isIlio ? ''                             : get('TELEPHONE')
  const ville      = isIlio ? (ilioContact.ville      || '') : get('VILLE')
  const commercial = isIlio ? ''                             : get('COMMERCIAL')
  const adresse    = isIlio ? (ilioContact.adresse    || '') : get('ADRESSE_INSTALLATION')
  const codePostal = isIlio ? (ilioContact.codePostal || '') : get('CODE_POSTAL')
  const typeLabel  = isIlio ? 'Tickets Ilio Systems'         : (sheetId === 'btob' ? 'BtoB' : sheetId === 'btoc-comptant' ? 'Comptant' : 'Abonnement')

  const slotMap      = useSlotMap()
  const transactions = useContactTransactions(nom, slotMap)

  const [activities, setActivities] = useState([])
  const [activeTab, setActiveTab]   = useState('all')
  const [actMenuOpen, setActMenuOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showAddTx, setShowAddTx]             = useState(false)
  const [txToast, setTxToast]                 = useState(null)
  const [contactType, setContactType]         = useState('')
  const [deleting, setDeleting]     = useState(false)
  const [deleted, setDeleted]       = useState(false)
  const actMenuRef = useRef(null)

  const hasTransaction = activities.some(a => a.type === 'transaction')

  const lockedContact = useMemo(
    () => ({ id: contactId, nom, email, adresse, codePostal, ville, tel }),
    [contactId, nom, email, adresse, codePostal, ville, tel]
  )

  useEffect(() => {
    supabaseGet('contact_metadata', { contact_id: `eq.${contactId}`, select: 'contact_type' })
      .then(data => setContactType(data?.[0]?.contact_type || ''))
  }, [contactId])

  const handleContactTypeChange = async value => {
    setContactType(value)
    onTypeChange?.(contactId, value)
    await supabaseUpsert('contact_metadata', {
      contact_id: contactId, contact_type: value, updated_at: new Date().toISOString(),
    }, 'contact_id')
  }

  const refreshActivities = () => {
    supabaseGet('contact_activities', {
      contact_id: `eq.${contactId}`,
      order: 'created_at.desc',
      select: '*',
    }).then(data => setActivities(Array.isArray(data) ? data : []))
  }

  useEffect(() => {
    if (isIlio) {
      if (!email) return
      ilioSupabase
        .from('tickets')
        .select('id,reference,subject,description,status,created_at,installation_type')
        .eq('email', email)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          const acts = (data || []).map(t => ({
            id: t.id,
            type: 'ticket',
            title: [t.reference, t.subject].filter(Boolean).join(' — '),
            body: t.description || '',
            created_at: t.created_at,
            created_by_name: t.installation_type ? INSTALL_LABELS[t.installation_type] || t.installation_type : '',
          }))
          setActivities(acts)
        })
      return
    }
    supabaseGet('contact_activities', {
      contact_id: `eq.${contactId}`,
      order: 'created_at.desc',
      select: '*',
    }).then(data => setActivities(Array.isArray(data) ? data : []))
  }, [contactId, isIlio, email])

  // Close actions menu on outside click
  useEffect(() => {
    const h = e => { if (actMenuRef.current && !actMenuRef.current.contains(e.target)) setActMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleDelete = async () => {
    setDeleting(true)

    // Find every row across all 3 sheets that matches this client's name
    const normalizedNom = nom.toLowerCase().trim()
    const sheetConfigs = [
      { id: 'btoc-comptant',   nameColId: 'Colonne1',   prefix: 'c' },
      { id: 'btoc-abonnement', nameColId: 'NOM_PRENOM', prefix: 'a' },
      { id: 'btob',            nameColId: 'NOM_PRENOM', prefix: 'b' },
    ]

    const matches = []
    for (const cfg of sheetConfigs) {
      const cm    = getColumnIdToLetterMap(cfg.id)
      const sc    = sheets[cfg.id]?.cells || {}
      const nameLetter = cm[cfg.nameColId]
      if (!nameLetter) continue
      const rowSet = new Set()
      Object.keys(sc).forEach(k => {
        if (k.startsWith('__')) return
        const m = k.match(/^[A-Z]+(\d+)$/)
        if (m && parseInt(m[1]) >= 2) rowSet.add(parseInt(m[1]))
      })
      rowSet.forEach(r => {
        const rowNom = sc[`${nameLetter}${r}`]
        if (rowNom && rowNom.toLowerCase().trim() === normalizedNom)
          matches.push({ sheetId: cfg.id, rowNum: r, contactId: `${cfg.prefix}:${r}` })
      })
    }

    // Clear all matching spreadsheet rows
    matches.forEach(({ sheetId: sid, rowNum: rn }) => clearContactRow(sid, rn))

    // Delete all Supabase records for every matched contact ID
    const allIds = matches.map(m => m.contactId)
    await Promise.allSettled([
      ...allIds.map(id => supabaseDelete('contact_activities', { contact_id: `eq.${id}` })),
      ...allIds.map(id => supabaseDelete('contact_task_lists',  { contact_id: `eq.${id}` })),
      ...allIds.map(id => supabaseDelete('contact_metadata',    { contact_id: `eq.${id}` })),
      ...allIds.map(id => supabaseDelete('vt_requests',         { contact_id: `eq.${id}` })),
    ])

    setDeleting(false)
    setShowDeleteModal(false)
    setDeleted(true)
    setTimeout(() => onBack(), 2000)
  }

  const infoRows = isIlio ? [
    { label: 'Type de contact',     value: 'Tickets Ilio Systems' },
    { label: 'E-mail',              value: email      },
    { label: 'Adresse',             value: adresse    },
    { label: 'Code postal',         value: codePostal },
    { label: 'Ville',               value: ville      },
    { label: "Type d'installation", value: INSTALL_LABELS[ilioContact.installType] || '' },
  ].filter(r => r.value) : [
    {
      label: 'Type de contact',
      value: contactType,
      renderValue: () => (
        <select
          className="cd-info-select"
          value={contactType}
          onChange={e => handleContactTypeChange(e.target.value)}
        >
          <option value="">—</option>
          {CONTACT_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      ),
    },
    { label: 'Propriétaire du contact', value: commercial },
    { label: 'Numéro de téléphone',     value: tel        },
    { label: 'Ville',                   value: ville      },
    { label: 'Code postal',             value: codePostal },
    { label: 'Adresse',                 value: adresse    },
    { label: 'Type de contrat',         value: typeLabel  },
    { label: 'E-mail',                  value: email      },
  ]

  return (
    <div className="cd-root">
      {/* Success toast */}
      {deleted && (
        <div className="cd-toast cd-toast--success">
          <CheckCircle2 size={15} />
          Contact supprimé avec succès
        </div>
      )}


      {/* Add transaction panel */}
      {txToast && (
        <div className="page-toast page-toast--success">
          <CheckCircle2 size={15} />
          {txToast}
        </div>
      )}
      {!isIlio && showAddTx && (
        <AddTransactionPanel
          lockedContact={lockedContact}
          onClose={() => setShowAddTx(false)}
          onCreated={msg => {
            setShowAddTx(false)
            if (msg) { setTxToast(msg); setTimeout(() => setTxToast(null), 3000) }
            refreshActivities()
          }}
        />
      )}

      {/* Delete modal */}
      {!isIlio && showDeleteModal && (
        <DeleteModal
          nom={nom}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}

      {/* Breadcrumb */}
      <div className="cd-breadcrumb">
        <button className="cd-back-btn" onClick={onBack}>
          <ArrowLeft size={13} />
          Contacts
        </button>
        <div className="cd-actions-wrap" ref={actMenuRef}>
          <button className="cd-actions-btn" onClick={() => setActMenuOpen(p => !p)}>
            Actions <ChevronDown size={11} />
          </button>
          {!isIlio && actMenuOpen && (
            <div className="cd-actions-menu">
              <button
                className="cd-actions-menu-item cd-actions-menu-item--danger"
                onClick={() => { setActMenuOpen(false); setShowDeleteModal(true) }}
              >
                <Trash2 size={13} />
                Supprimer le contact
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="cd-body">
        {/* Left */}
        <aside className="cd-left">
          <ContactCard
            nom={nom}
            commercial={commercial}
            email={email}
            hasTransaction={hasTransaction}
            onTaskClick={undefined}
          />
          <InfoSection rows={infoRows} />
        </aside>

        {/* Middle */}
        <main className="cd-middle">
          <div className="cd-act-tabs">
            {TABS.map(t => (
              <button
                key={t.key}
                className={`cd-act-tab${activeTab === t.key ? ' active' : ''}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className={`cd-act-timeline${activeTab === 'note' ? ' cd-act-timeline--notes' : ''}`}>
            {activeTab === 'task' ? (
              <TaskListInline contactId={contactId} />
            ) : activeTab === 'note' ? (
              <NotesPanel
                contactId={contactId}
                notes={activities.filter(a => a.type === 'note')}
                onRefresh={refreshActivities}
                authorName={loggedInName}
                clientName={nom}
              />
            ) : (
              <ActivityTimeline activities={activities} activeTab={activeTab} />
            )}
          </div>
        </main>

        {/* Right */}
        <aside className="cd-right">
          <RightPanel
            nom={nom}
            email={email}
            tel={tel}
            adresse={adresse}
            codePostal={codePostal}
            ville={ville}
            transactions={isIlio ? [] : transactions}
            activities={activities}
            onAddTransaction={isIlio ? undefined : () => setShowAddTx(true)}
            onTransactionClick={isIlio ? undefined : onTransactionClick}
            contactId={contactId}
            onRefreshActivities={refreshActivities}
            uploaderName={loggedInName}
          />
        </aside>
      </div>
    </div>
  )
}
