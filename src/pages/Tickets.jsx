import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Ticket, ChevronDown, Search, X, LayoutList,
  ArrowUpDown, RefreshCw, AlertCircle, Edit2, Trash2,
  Check, Calendar, MoreHorizontal, FileText, Image,
  Receipt, Plus, History, AlertTriangle, Clock,
  CheckCircle2,
} from 'lucide-react'
import { ilioSupabase } from '../lib/ilioSupabase'
import { generateBonIntervention } from '../lib/ilioPdf'
import { TicketModal }           from '../components/tickets/TicketModal'
import { BonInterventionModal }  from '../components/tickets/BonInterventionModal'
import { FactureModal }          from '../components/tickets/FactureModal'
import { PhotosModal }           from '../components/tickets/PhotosModal'
import { CalendarModal }         from '../components/tickets/CalendarModal'
import './Tickets.css'
import './dossiers/DossierListPage.css'

// ── Constants ──────────────────────────────────────────────────

const STATUS_MAP = {
  nouveau:    { label: 'Nouveau',    color: '#ea580c', bg: '#fff7ed' },
  en_cours:   { label: 'En cours',   color: '#d97706', bg: '#fffbeb' },
  en_attente: { label: 'En attente', color: '#7c3aed', bg: '#f5f3ff' },
  incomplet:  { label: 'Incomplet',  color: '#ca8a04', bg: '#fefce8' },
  termine:    { label: 'Terminé',    color: '#16a34a', bg: '#f0fdf4' },
  ferme:      { label: 'Fermé',      color: '#64748b', bg: '#f1f5f9' },
  annule:     { label: 'Annulé',     color: '#dc2626', bg: '#fef2f2' },
}

const PRIORITY_MAP = {
  basse:   { label: 'Basse',   color: '#94a3b8' },
  moyenne: { label: 'Normale', color: '#f97316' },
  haute:   { label: 'Haute',   color: '#ef4444' },
  urgente: { label: 'Urgente', color: '#dc2626' },
}

const INSTALL_LABELS = {
  chauffe_eau_solaire:      'Chauffe-eau solaire',
  borne_recharge:           'Borne de recharge',
  maintenance_pv:           'Maintenance PV',
  maintenance_industrielle: 'Maintenance industrielle',
  autre_installation:       'Autre',
}

const CHANNEL_LABELS = {
  appel:       'Appel tél.',
  email:       'Email',
  whatsapp:    'WhatsApp',
  presentiel:  'Présentiel',
  client_web:  'Demande client (web)',
  runcharge:   'GreenYellow',
  smartenergy: 'Smart Energies',
  autre:       'Autre',
}

const B2B_CHANNELS = ['runcharge', 'smartenergy']

const TABS = [
  { id: 'particuliers', label: 'Particuliers' },
  { id: 'runcharge',    label: 'GreenYellow' },
  { id: 'smartenergy',  label: 'Smart Energies' },
]

const EMPTY_FORM = {
  client_name: '', client_firstname: '',
  phone: '', email: '',
  address: '', postal_code: '', commune: '',
  subject: '', description: '',
  status: 'nouveau', priority: 'moyenne',
  assigned_to: '',
  channel: 'appel',
  installation_type: '', installation_other: '',
  maintenance_contract: '',
  internal_note: '',
  intervention_date: '',
}

const HISTORY_ICONS = {
  created:         { Icon: Plus,          color: '#22c55e' },
  status_changed:  { Icon: RefreshCw,     color: '#3b82f6' },
  priority_changed:{ Icon: AlertTriangle, color: '#f97316' },
  note_added:      { Icon: FileText,      color: '#8b5cf6' },
  updated:         { Icon: Edit2,         color: '#64748b' },
  doc_added:       { Icon: CheckCircle2,  color: '#22c55e' },
  calendar_set:    { Icon: Calendar,      color: '#0ea5e9' },
}

// ── Helpers ────────────────────────────────────────────────────

function normalizeAssignees(val) {
  if (!val) return []
  if (Array.isArray(val)) return val.filter(Boolean)
  if (typeof val === 'string') return val.split(',').map(s => s.trim()).filter(Boolean)
  return []
}

function formatDate(str) {
  if (!str) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('fr-FR')
  }
  return new Date(str).toLocaleDateString('fr-FR')
}

function formatDateTime(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function docStatus(bon, photos, factureUrl) {
  const hasBon     = !!bon
  const hasPhotos  = Array.isArray(photos) && photos.length > 0
  const hasFacture = !!factureUrl && factureUrl !== 'non_facturable'
  if (hasBon && hasPhotos && hasFacture) return 'ferme'
  if (hasBon && hasPhotos)              return 'termine'
  if (hasBon || hasPhotos || hasFacture) return 'incomplet'
  return null
}

const AVATAR_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f97316', '#ec4899', '#14b8a6', '#ef4444']

function avatarColor(email) {
  let h = 0
  for (const c of (email || '')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function getInitials(email) {
  const [local = ''] = (email || '').split('@')
  const parts = local.split(/[._-]/)
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('')
}

function techName(email, technicians) {
  const t = technicians.find(t => t.email === email)
  return t?.full_name?.trim() || email?.split('@')[0] || email
}

// ── Small UI components ────────────────────────────────────────

function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status, color: '#64748b', bg: '#f8fafc' }
  return (
    <span style={{
      background: s.bg, color: s.color, fontWeight: 600,
      fontSize: '11.5px', padding: '3px 9px', borderRadius: 99,
      whiteSpace: 'nowrap', display: 'inline-block',
    }}>
      {s.label}
    </span>
  )
}

function PriorityBadge({ priority }) {
  const p = PRIORITY_MAP[priority] || { label: priority, color: '#94a3b8' }
  return (
    <span className="tk-priority">
      <span className="tk-priority-dot" style={{ background: p.color }} />
      {p.label}
    </span>
  )
}

function StatusDot({ present, onClick }) {
  if (present) return (
    <button className="tk-status-dot tk-status-dot--filled" onClick={onClick} title="Voir">
      <Check size={11} strokeWidth={3} color="#fff" />
    </button>
  )
  return <span className="tk-status-dot tk-status-dot--empty" />
}

function FactureDot({ ticket, onClick }) {
  const hasItems    = Array.isArray(ticket.items_facturation) && ticket.items_facturation.length > 0
  const hasFacture  = !!ticket.facture_url && ticket.facture_url !== 'non_facturable'
  const isNF        = ticket.facture_url === 'non_facturable'

  let cls = 'tkm-facture-dot'
  let title = ''
  let content = null

  if (hasFacture) {
    cls += ' tk-facture-dot--green'; title = 'Facture uploadée'; content = <Check size={11} strokeWidth={3} color="#fff" />
  } else if (!isNF && hasItems) {
    cls += ' tk-facture-dot--red'; title = 'Articles sans facture'; content = <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>!</span>
  } else if (isNF) {
    return <span className="tk-facture-dot tk-facture-dot--gray" title="Non facturable">—</span>
  } else {
    return <span className="tk-status-dot tk-status-dot--empty" />
  }

  return (
    <div className="tk-facture-dot-wrap">
      <button className={cls} onClick={onClick} title={title}>{content}</button>
    </div>
  )
}

// ── AssigneeDropdown ───────────────────────────────────────────

function AssigneeDropdown({ ticket, technicians, onUpdate }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = normalizeAssignees(ticket.assigned_to)

  useOutsideClick(ref, () => setOpen(false))

  const toggle = async (email) => {
    const next = current.includes(email)
      ? current.filter(e => e !== email)
      : [...current, email]
    await onUpdate(ticket.id, { assigned_to: next })
  }

  const clear = async () => {
    await onUpdate(ticket.id, { assigned_to: null })
    setOpen(false)
  }

  return (
    <div className="tk-assignee-wrap" ref={ref}>
      <button
        type="button"
        className="tk-assignee-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
      >
        {current.length === 0 ? (
          <span style={{ fontSize: 12, color: '#cbd5e1' }}>—</span>
        ) : (
          <div className="tk-assignee-avatars">
            {current.slice(0, 3).map((email, i) => (
              <div key={i} className="tk-assignee-av" style={{ background: avatarColor(email) }} title={email}>
                {getInitials(email)}
              </div>
            ))}
            {current.length > 3 && (
              <div className="tk-assignee-av tk-assignee-av--more">+{current.length - 3}</div>
            )}
          </div>
        )}
      </button>
      {open && (
        <div className="tk-assignee-dropdown" onClick={e => e.stopPropagation()}>
          {technicians.map(t => {
            const checked = current.includes(t.email)
            const name = t.full_name?.trim() || t.email.split('@')[0]
            return (
              <button key={t.email} type="button" className="tk-assignee-option" onClick={() => toggle(t.email)}>
                <div className={`tk-assignee-check${checked ? ' tk-assignee-check--on' : ''}`}>
                  {checked && <Check size={9} strokeWidth={3} color="#fff" />}
                </div>
                <div className="tk-assignee-av" style={{ background: avatarColor(t.email) }}>
                  {getInitials(t.email)}
                </div>
                <span style={{ fontSize: 12 }}>{name}</span>
              </button>
            )
          })}
          {current.length > 0 && (
            <button type="button" className="tk-assignee-remove" onClick={clear}>
              Retirer tous
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── RowMenu (3-dot) ────────────────────────────────────────────

function RowMenu({ ticket, onEdit, onCalendar, onBon, onFacture, onPhotos, onCancel, onDelete }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutsideClick(ref, () => setOpen(false))

  const close = () => setOpen(false)
  const act = (fn) => (e) => { e.stopPropagation(); close(); fn() }

  const isCancelled = ticket.status === 'annule'

  return (
    <div className="tk-menu-wrap" ref={ref}>
      <button
        type="button"
        className="tk-menu-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <div className="tk-menu-dropdown tk-menu-dropdown--down" onClick={e => e.stopPropagation()}>
          <button className="tk-menu-item" onClick={act(onEdit)}>
            <Edit2 size={14} /> Modifier le ticket
          </button>
          <button className="tk-menu-item" onClick={act(() => generateBonIntervention(ticket, {}))}>
            <FileText size={14} /> Voir le bon PDF
          </button>
          <div className="tk-menu-sep" />
          <button className="tk-menu-item" onClick={act(onCalendar)}>
            <Calendar size={14} /> Planifier une date
          </button>
          <button className="tk-menu-item" onClick={act(onBon)}>
            <CheckCircle2 size={14} /> Bon d'intervention
          </button>
          <button className="tk-menu-item" onClick={act(onPhotos)}>
            <Image size={14} /> Photos
          </button>
          <button className="tk-menu-item" onClick={act(onFacture)}>
            <Receipt size={14} /> Facture
          </button>
          <div className="tk-menu-sep" />
          {isCancelled ? (
            <button className="tk-menu-item tk-menu-item--indigo" onClick={act(onCancel)}>
              <RefreshCw size={14} /> Réactiver
            </button>
          ) : (
            <button className="tk-menu-item" onClick={act(onCancel)}>
              <X size={14} /> Annuler le ticket
            </button>
          )}
          <div className="tk-menu-sep" />
          <button className="tk-menu-item tk-menu-item--red" onClick={act(onDelete)}>
            <Trash2 size={14} /> Supprimer
          </button>
        </div>
      )}
    </div>
  )
}

// ── Delete confirm portal ──────────────────────────────────────

function DeleteConfirmModal({ ticket, onConfirm, onCancel }) {
  return createPortal(
    <>
      <div className="tkm-overlay" onClick={onCancel} style={{ zIndex: 700 }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 701, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="tk-delete-modal-card">
          <div className="tk-delete-icon">
            <AlertTriangle size={24} color="#ef4444" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#1e293b' }}>
              Supprimer le ticket ?
            </p>
            <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
              <span className="tkm-ref">{ticket.reference}</span> — {ticket.client_name}
              <br />Cette action est irréversible.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, width: '100%' }}>
            <button className="tkm-btn-cancel" style={{ flex: 1 }} onClick={onCancel}>Annuler</button>
            <button
              style={{ flex: 1, height: 36, padding: '0 16px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              onClick={onConfirm}
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

// ── Mobile card ────────────────────────────────────────────────

function MobileTicketCard({ ticket, technicians, onClick, onMenu }) {
  const s = STATUS_MAP[ticket.status] || { label: ticket.status, color: '#64748b', bg: '#f8fafc' }
  const assignees = normalizeAssignees(ticket.assigned_to)
  const name = [ticket.client_name, ticket.client_firstname].filter(Boolean).join(' ')

  return (
    <div className="tk-mobile-card" onClick={onClick}>
      <div className="tk-mobile-card-top">
        <div className="tk-mobile-card-content">
          <div className="tk-mobile-card-name">{name}</div>
          <div className="tk-mobile-card-meta">
            <span className="tk-ref">{ticket.reference}</span>
            <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99 }}>{s.label}</span>
          </div>
          {ticket.description && (
            <div className="tk-mobile-card-desc">{ticket.description}</div>
          )}
          {ticket.intervention_date && (
            <div className="tk-mobile-card-dates">
              <Calendar size={11} />
              {formatDate(ticket.intervention_date)}
            </div>
          )}
          {assignees.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {assignees.slice(0, 3).map((email, i) => (
                <div key={i} className="tk-assignee-av" style={{ background: avatarColor(email), width: 18, height: 18, fontSize: 8 }} title={techName(email, technicians)}>
                  {getInitials(email)}
                </div>
              ))}
            </div>
          )}
        </div>
        <div onClick={e => e.stopPropagation()}>
          <RowMenu
            ticket={ticket}
            onEdit={() => onMenu('edit', ticket)}
            onCalendar={() => onMenu('calendar', ticket)}
            onBon={() => onMenu('bon', ticket)}
            onFacture={() => onMenu('facture', ticket)}
            onPhotos={() => onMenu('photos', ticket)}
            onCancel={() => onMenu('cancel', ticket)}
            onDelete={() => onMenu('delete', ticket)}
          />
        </div>
      </div>
    </div>
  )
}

// ── Hooks ──────────────────────────────────────────────────────

function useOutsideClick(ref, handler) {
  useEffect(() => {
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) handler() }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [ref, handler])
}

function useIlioTickets() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await ilioSupabase
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) throw err
      setTickets(data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const updateTicket = async (id, updates) => {
    const { error: err } = await ilioSupabase
      .from('tickets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (err) throw err
    setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
  }

  const createTicket = async (data) => {
    const { data: created, error: err } = await ilioSupabase
      .from('tickets')
      .insert([data])
      .select()
      .single()
    if (err) throw err
    setTickets(prev => [created, ...prev])
    return created
  }

  const deleteTicket = async (id) => {
    const { error: err } = await ilioSupabase.from('tickets').delete().eq('id', id)
    if (err) throw err
    setTickets(prev => prev.filter(t => t.id !== id))
  }

  return { tickets, loading, error, reload: load, updateTicket, createTicket, deleteTicket }
}

export function useTechnicians() {
  const [list, setList] = useState([])
  useEffect(() => {
    ilioSupabase
      .from('profiles')
      .select('id, email, full_name, role')
      .then(({ data }) => { if (Array.isArray(data)) setList(data) })
  }, [])
  return list
}

// ── Ticket History ─────────────────────────────────────────────

function useTicketHistory(ticketId) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!ticketId) return
    setLoading(true)
    const { data } = await ilioSupabase
      .from('ticket_history')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
    setHistory(data || [])
    setLoading(false)
  }, [ticketId])

  useEffect(() => { load() }, [load])

  const addHistory = async (entry) => {
    await ilioSupabase.from('ticket_history').insert([{ ticket_id: ticketId, ...entry }])
    load()
  }

  return { history, loading, addHistory }
}

function HistoryTimeline({ history, loading }) {
  if (loading) return (
    <div className="tk-history-empty"><RefreshCw size={16} className="tk-spin" /></div>
  )
  if (!history.length) return (
    <div className="tk-history-empty">Aucun historique disponible</div>
  )
  return (
    <div className="tk-history">
      <div className="tk-history-line" />
      <ul className="tk-history-list">
        {history.map((h, i) => {
          const { Icon, color } = HISTORY_ICONS[h.action] || HISTORY_ICONS.updated
          return (
            <li key={h.id || i} className="tk-history-item">
              <div className="tk-history-dot" style={{ background: color }} />
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                  <span className="tk-history-label" style={{ color }}>{h.action_label || h.action}</span>
                  {h.actor && <span className="tk-history-actor">par {h.actor}</span>}
                </div>
                {(h.old_value || h.new_value) && (
                  <div className="tk-history-change">
                    {h.old_value && <span className="tk-history-old">{h.old_value}</span>}
                    {h.old_value && h.new_value && <span> → </span>}
                    {h.new_value && <span className="tk-history-new">{h.new_value}</span>}
                  </div>
                )}
                <div className="tk-history-time">
                  <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
                  {formatDateTime(h.created_at)}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Ticket Drawer ──────────────────────────────────────────────

export function TicketDrawer({ ticket, technicians, onClose, onSave, onCreate, prefill }) {
  const isEdit = !!ticket
  const [tab, setTab] = useState('info')
  const { history, loading: histLoading } = useTicketHistory(isEdit ? ticket.id : null)

  const [form, setForm] = useState(() => {
    if (!ticket) return { ...EMPTY_FORM, ...prefill }
    return {
      client_name:          ticket.client_name || '',
      client_firstname:     ticket.client_firstname || '',
      phone:                ticket.phone || '',
      email:                ticket.email || '',
      address:              ticket.address || '',
      postal_code:          ticket.postal_code || '',
      commune:              ticket.commune || '',
      subject:              ticket.subject || '',
      description:          ticket.description || '',
      status:               ticket.status || 'nouveau',
      priority:             ticket.priority || 'moyenne',
      assigned_to:          normalizeAssignees(ticket.assigned_to).join(', '),
      channel:              ticket.channel || 'appel',
      installation_type:    ticket.installation_type || '',
      installation_other:   ticket.installation_other || '',
      maintenance_contract: ticket.maintenance_contract || '',
      internal_note:        ticket.internal_note || '',
      intervention_date:    ticket.intervention_date || '',
    }
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleAddTech = e => {
    if (!e.target.value) return
    const current = form.assigned_to
      ? form.assigned_to.split(',').map(s => s.trim()).filter(Boolean)
      : []
    if (!current.includes(e.target.value))
      set('assigned_to', [...current, e.target.value].join(', '))
    e.target.value = ''
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const assignees = form.assigned_to
        ? form.assigned_to.split(',').map(s => s.trim()).filter(Boolean)
        : null
      const payload = {
        client_name:          form.client_name,
        client_firstname:     form.client_firstname || null,
        phone:                form.phone || null,
        email:                form.email || null,
        address:              form.address || null,
        postal_code:          form.postal_code || null,
        commune:              form.commune || null,
        subject:              form.subject || form.description?.slice(0, 80) || 'Sans objet',
        description:          form.description || null,
        status:               form.status,
        priority:             form.priority,
        assigned_to:          assignees,
        channel:              form.channel,
        installation_type:    form.installation_type || null,
        installation_other:   form.installation_other || null,
        maintenance_contract: form.maintenance_contract || null,
        internal_note:        form.internal_note || null,
        intervention_date:    form.intervention_date || null,
      }
      if (isEdit) await onSave(ticket.id, payload)
      else await onCreate(payload)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const isPVMaintenance = form.installation_type === 'maintenance_pv'

  return (
    <>
      <div className="tk-drawer-backdrop" onClick={onClose} />
      <aside className="tk-drawer">
        <div className="tk-drawer-header">
          <span className="tk-drawer-title">
            {isEdit
              ? <><span className="tk-ref">{ticket.reference}</span> — {ticket.client_name}</>
              : 'Nouveau ticket'}
          </span>
          <button className="tk-drawer-close" onClick={onClose}><X size={16} /></button>
        </div>

        {isEdit && (
          <div className="tk-drawer-tabs">
            <button
              type="button"
              className={`tk-drawer-tab${tab === 'info' ? ' tk-drawer-tab--active' : ''}`}
              onClick={() => setTab('info')}
            >
              Informations
            </button>
            <button
              type="button"
              className={`tk-drawer-tab${tab === 'history' ? ' tk-drawer-tab--active' : ''}`}
              onClick={() => setTab('history')}
            >
              <History size={13} style={{ marginRight: 5 }} />
              Historique
            </button>
          </div>
        )}

        {tab === 'history' ? (
          <div className="tk-drawer-body" style={{ padding: 0 }}>
            <HistoryTimeline history={history} loading={histLoading} />
          </div>
        ) : (
          <form className="tk-drawer-body" onSubmit={handleSubmit} id="tk-form">
            {error && <div className="tk-form-error">{error}</div>}

            {isEdit && (
              <div className="tk-form-row">
                <div className="tk-form-group">
                  <label>Statut</label>
                  <select value={form.status} onChange={e => set('status', e.target.value)}>
                    {Object.entries(STATUS_MAP).map(([v, { label }]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </div>
                <div className="tk-form-group">
                  <label>Priorité</label>
                  <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                    {Object.entries(PRIORITY_MAP).map(([v, { label }]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {isEdit && (
              <div className="tk-drawer-docs">
                <div className={`tk-drawer-doc${ticket.bon_data ? ' tk-drawer-doc--ok' : ''}`}>
                  <span className="tk-drawer-doc-icon">{ticket.bon_data ? '✓' : '○'}</span>
                  Bon d'intervention
                </div>
                <div className={`tk-drawer-doc${Array.isArray(ticket.photos) && ticket.photos.length ? ' tk-drawer-doc--ok' : ''}`}>
                  <span className="tk-drawer-doc-icon">{Array.isArray(ticket.photos) && ticket.photos.length ? '✓' : '○'}</span>
                  Photos ({Array.isArray(ticket.photos) ? ticket.photos.length : 0})
                </div>
                <div className={`tk-drawer-doc${ticket.facture_url && ticket.facture_url !== 'non_facturable' ? ' tk-drawer-doc--ok' : ticket.facture_url === 'non_facturable' ? ' tk-drawer-doc--na' : ''}`}>
                  <span className="tk-drawer-doc-icon">
                    {ticket.facture_url === 'non_facturable' ? '—' : ticket.facture_url ? '✓' : '○'}
                  </span>
                  Facture{ticket.facture_amount ? ` (${Number(ticket.facture_amount).toLocaleString('fr-FR')} €)` : ''}
                </div>
              </div>
            )}

            <div className="tk-form-section">Informations client</div>
            <div className="tk-form-row">
              <div className="tk-form-group">
                <label>Nom *</label>
                <input required value={form.client_name} onChange={e => set('client_name', e.target.value)} placeholder="Nom" />
              </div>
              <div className="tk-form-group">
                <label>Prénom</label>
                <input value={form.client_firstname} onChange={e => set('client_firstname', e.target.value)} placeholder="Prénom" />
              </div>
            </div>
            <div className="tk-form-row">
              <div className="tk-form-group">
                <label>Téléphone</label>
                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="Téléphone" />
              </div>
              <div className="tk-form-group">
                <label>E-mail</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="E-mail" />
              </div>
            </div>
            <div className="tk-form-group">
              <label>Adresse</label>
              <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Adresse" />
            </div>
            <div className="tk-form-row">
              <div className="tk-form-group">
                <label>Code postal</label>
                <input value={form.postal_code} onChange={e => set('postal_code', e.target.value)} placeholder="Code postal" />
              </div>
              <div className="tk-form-group">
                <label>Commune</label>
                <input value={form.commune} onChange={e => set('commune', e.target.value)} placeholder="Commune" />
              </div>
            </div>

            <div className="tk-form-section">Ticket</div>
            <div className="tk-form-row">
              <div className="tk-form-group">
                <label>Canal</label>
                <select value={form.channel} onChange={e => set('channel', e.target.value)}>
                  {Object.entries(CHANNEL_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              {!isEdit && (
                <div className="tk-form-group">
                  <label>Priorité</label>
                  <select value={form.priority} onChange={e => set('priority', e.target.value)}>
                    {Object.entries(PRIORITY_MAP).map(([v, { label }]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="tk-form-row">
              <div className="tk-form-group">
                <label>Type d'installation</label>
                <select value={form.installation_type} onChange={e => {
                  set('installation_type', e.target.value)
                  if (e.target.value !== 'autre_installation') set('installation_other', '')
                  if (e.target.value === 'maintenance_pv') set('maintenance_contract', 'oui')
                }}>
                  <option value="">— Sélectionner —</option>
                  {Object.entries(INSTALL_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              {(form.installation_type === 'chauffe_eau_solaire' || isPVMaintenance) && (
                <div className="tk-form-group">
                  <label>Maintenance / Garantie</label>
                  {isPVMaintenance ? (
                    <input readOnly value="Inclus (maintenance PV)" className="tk-input-readonly" />
                  ) : (
                    <select value={form.maintenance_contract} onChange={e => set('maintenance_contract', e.target.value)}>
                      <option value="">— Sélectionner —</option>
                      <option value="sous_garantie">Sous garantie</option>
                      <option value="hors_garantie">Hors garantie</option>
                    </select>
                  )}
                </div>
              )}
            </div>
            {form.installation_type === 'autre_installation' && (
              <div className="tk-form-group">
                <label>Préciser le type</label>
                <input value={form.installation_other} onChange={e => set('installation_other', e.target.value)} placeholder="Type d'installation" />
              </div>
            )}
            <div className="tk-form-group">
              <label>Objet</label>
              <input value={form.subject} onChange={e => set('subject', e.target.value)} placeholder="Objet du ticket" />
            </div>
            <div className="tk-form-group">
              <label>Description</label>
              <textarea rows={4} value={form.description} onChange={e => set('description', e.target.value)} placeholder="Description détaillée du problème..." />
            </div>

            <div className="tk-form-section">Assignation & Planning</div>
            <div className="tk-form-group">
              <label>Technicien(s) assigné(s)</label>
              {technicians.length > 0 && (
                <select onChange={handleAddTech} defaultValue="">
                  <option value="">+ Ajouter depuis la liste</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.email}>{t.full_name || t.email}</option>
                  ))}
                </select>
              )}
              <input
                value={form.assigned_to}
                onChange={e => set('assigned_to', e.target.value)}
                placeholder="Emails séparés par des virgules"
                style={{ marginTop: technicians.length ? 6 : 0 }}
              />
            </div>
            <div className="tk-form-group">
              <label>Date d'intervention</label>
              <input type="date" value={form.intervention_date} onChange={e => set('intervention_date', e.target.value)} />
            </div>

            {isEdit && (
              <>
                <div className="tk-form-section">Note interne</div>
                <div className="tk-form-group">
                  <textarea rows={3} value={form.internal_note} onChange={e => set('internal_note', e.target.value)} placeholder="Note interne (non visible par le client)..." />
                </div>
              </>
            )}
          </form>
        )}

        {tab === 'info' && (
          <div className="tk-drawer-footer">
            <button type="button" className="tk-btn-cancel" onClick={onClose} disabled={saving}>
              Annuler
            </button>
            <button type="submit" form="tk-form" className="tk-btn-save" disabled={saving || !form.client_name}>
              {saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer le ticket'}
            </button>
          </div>
        )}
      </aside>
    </>
  )
}

// ── Sync contacts ──────────────────────────────────────────────

async function syncAllTicketContacts() {
  const { data: allTickets } = await ilioSupabase
    .from('tickets')
    .select('id,reference,client_name,client_firstname,email,phone,address,postal_code,commune,installation_type,channel')
    .not('email', 'is', null)
    .neq('email', '')

  if (!allTickets?.length) return 0

  const { data: existing } = await ilioSupabase
    .from('ticket_clients')
    .select('email')

  const knownEmails = new Set(
    (existing || []).map(c => c.email?.toLowerCase()).filter(Boolean)
  )

  const seen = new Set()
  const toCreate = []
  for (const t of allTickets) {
    const emailKey = t.email.toLowerCase()
    if (knownEmails.has(emailKey) || seen.has(emailKey)) continue
    seen.add(emailKey)
    const fullName = [t.client_firstname, t.client_name].filter(Boolean).join(' ').trim()
    toCreate.push({
      ticket_id:            t.id,
      ticket_reference:     t.reference,
      client_name:          t.client_name,
      client_firstname:     t.client_firstname || null,
      full_name:            fullName,
      full_name_normalized: fullName.toLowerCase().replace(/\s+/g, ' ').trim(),
      phone:                t.phone || null,
      email:                t.email,
      address:              t.address || null,
      postal_code:          t.postal_code || null,
      commune:              t.commune || null,
      installation_type:    t.installation_type || null,
      channel:              t.channel || null,
    })
  }

  if (!toCreate.length) return 0
  await ilioSupabase.from('ticket_clients').insert(toCreate)
  return toCreate.length
}

// ── Main page ──────────────────────────────────────────────────

export default function Tickets() {
  const { tickets, loading, error, reload, updateTicket, createTicket, deleteTicket } = useIlioTickets()
  const technicians = useTechnicians()

  const [activeTab, setActiveTab]         = useState('particuliers')
  const [search, setSearch]               = useState('')
  const [installFilter, setInstallFilter] = useState('')
  const [drawer, setDrawer]               = useState(null)
  const [sortCol, setSortCol]             = useState(null)
  const [sortDir, setSortDir]             = useState('desc')
  const [syncing, setSyncing]             = useState(false)
  const [syncToast, setSyncToast]         = useState(null)

  // Modal states
  const [detailTicket, setDetailTicket]   = useState(null)
  const [bonTicket, setBonTicket]         = useState(null)
  const [factureTicket, setFactureTicket] = useState(null)
  const [photosTicket, setPhotosTicket]   = useState(null)
  const [calTicket, setCalTicket]         = useState(null)
  const [deleteTarget, setDeleteTarget]   = useState(null)

  // Helper: get latest ticket state from local list
  const getTicket = (id) => tickets.find(t => t.id === id)

  const handleRefresh = async () => {
    setSyncing(true)
    setSyncToast(null)
    try {
      const created = await syncAllTicketContacts()
      await reload()
      if (created > 0) {
        setSyncToast(`${created} nouveau${created > 1 ? 'x' : ''} contact${created > 1 ? 's' : ''} importé${created > 1 ? 's' : ''}`)
      } else {
        setSyncToast('Contacts à jour')
      }
    } catch {
      setSyncToast('Erreur lors de la synchronisation')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncToast(null), 3500)
    }
  }

  // Doc update helpers with auto-status
  const handleBonConfirm = async (t, bonData) => {
    const updates = { bon_data: bonData }
    const newStatus = docStatus(bonData, t.photos, t.facture_url)
    if (newStatus && !['ferme', 'annule'].includes(t.status)) updates.status = newStatus
    await updateTicket(t.id, updates)
    if (detailTicket?.id === t.id) setDetailTicket(prev => ({ ...prev, ...updates }))
  }

  const handlePhotosConfirm = async (t, photos) => {
    const updates = { photos }
    const newStatus = docStatus(t.bon_data, photos, t.facture_url)
    if (newStatus && !['ferme', 'annule'].includes(t.status)) updates.status = newStatus
    await updateTicket(t.id, updates)
    if (detailTicket?.id === t.id) setDetailTicket(prev => ({ ...prev, ...updates }))
  }

  const handleFactureConfirm = async (t, factureData) => {
    const updates = {
      facture_url:      factureData.url,
      facture_filename: factureData.filename,
      facture_amount:   factureData.amount,
    }
    const newStatus = docStatus(t.bon_data, t.photos, factureData.url)
    if (newStatus && !['ferme', 'annule'].includes(t.status)) updates.status = newStatus
    await updateTicket(t.id, updates)
    if (detailTicket?.id === t.id) setDetailTicket(prev => ({ ...prev, ...updates }))
  }

  const handleCalendarConfirm = async (t, date, assignees) => {
    const dateStr = toLocalDateStr(date)
    const updates = { intervention_date: dateStr, assigned_to: assignees }
    await updateTicket(t.id, updates)
    if (detailTicket?.id === t.id) setDetailTicket(prev => ({ ...prev, ...updates }))
    setCalTicket(null)
  }

  const handleCancel = async (t) => {
    const newStatus = t.status === 'annule' ? 'nouveau' : 'annule'
    await updateTicket(t.id, { status: newStatus })
    if (detailTicket?.id === t.id) setDetailTicket(prev => ({ ...prev, status: newStatus }))
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await deleteTicket(deleteTarget.id)
    setDeleteTarget(null)
    if (detailTicket?.id === deleteTarget.id) setDetailTicket(null)
  }

  // Menu action dispatcher
  const handleMenuAction = (action, ticket) => {
    switch (action) {
      case 'edit':     setDrawer(ticket); break
      case 'calendar': setCalTicket(ticket); break
      case 'bon':      setBonTicket(ticket); break
      case 'facture':  setFactureTicket(ticket); break
      case 'photos':   setPhotosTicket(ticket); break
      case 'cancel':   handleCancel(ticket); break
      case 'delete':   setDeleteTarget(ticket); break
    }
  }

  const filtered = useMemo(() => {
    let rows = tickets

    if (activeTab === 'particuliers') rows = rows.filter(t => !B2B_CHANNELS.includes(t.channel))
    else rows = rows.filter(t => t.channel === activeTab)

    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(t =>
        (t.client_name || '').toLowerCase().includes(q) ||
        (t.client_firstname || '').toLowerCase().includes(q) ||
        (t.reference || '').toLowerCase().includes(q) ||
        (t.phone || '').includes(q) ||
        (t.subject || '').toLowerCase().includes(q)
      )
    }

    if (installFilter) rows = rows.filter(t => t.installation_type === installFilter)

    if (sortCol) {
      rows = [...rows].sort((a, b) => {
        const va = String(a[sortCol] ?? ''), vb = String(b[sortCol] ?? '')
        const cmp = va.localeCompare(vb, 'fr', { sensitivity: 'base' })
        return sortDir === 'asc' ? cmp : -cmp
      })
    }

    return [...rows].sort((a, b) => {
      if (a.status === 'ferme' && b.status !== 'ferme') return 1
      if (b.status === 'ferme' && a.status !== 'ferme') return -1
      return 0
    })
  }, [tickets, activeTab, search, installFilter, sortCol, sortDir])

  const newCounts = useMemo(() => {
    const c = {}
    TABS.forEach(tab => {
      const rows = tab.id === 'particuliers'
        ? tickets.filter(t => !B2B_CHANNELS.includes(t.channel))
        : tickets.filter(t => t.channel === tab.id)
      c[tab.id] = rows.filter(t => t.status === 'nouveau').length
    })
    return c
  }, [tickets])

  const toggleSort = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const showInstall = activeTab === 'particuliers'

  const COLS = [
    { key: 'reference',         label: 'Référence',    w: 110, sortable: true  },
    { key: 'created_at',        label: 'Créé le',      w: 100, sortable: true  },
    { key: 'client_name',       label: 'Client',       w: 190, sortable: true  },
    { key: 'status',            label: 'Statut',       w: 120, sortable: true  },
    { key: 'priority',          label: 'Priorité',     w: 100, sortable: true  },
    ...(showInstall ? [{ key: 'installation_type', label: "Type d'install.", w: 160, sortable: false }] : []),
    { key: 'assigned_to',       label: 'Assigné',      w: 110, sortable: false },
    { key: 'intervention_date', label: 'Intervention', w: 120, sortable: true  },
    { key: 'bon_data',          label: 'Bon',          w: 50,  sortable: false },
    { key: 'photos',            label: 'Photos',       w: 60,  sortable: false },
    { key: 'facture_url',       label: 'Facture',      w: 60,  sortable: false },
    { key: '__actions',         label: '',             w: 44,  sortable: false },
  ]

  const renderCell = (col, t) => {
    switch (col.key) {
      case 'reference':
        return <span className="tk-ref">{t.reference || '—'}</span>
      case 'created_at':
        return <span className="tk-date">{formatDate(t.created_at)}</span>
      case 'client_name':
        return (
          <span className="dossier-td--name">
            {[t.client_name, t.client_firstname].filter(Boolean).join(' ')}
          </span>
        )
      case 'status':
        return <StatusBadge status={t.status} />
      case 'priority':
        return <PriorityBadge priority={t.priority} />
      case 'installation_type':
        return <span className="tk-install-label">{INSTALL_LABELS[t.installation_type] || '—'}</span>
      case 'assigned_to':
        return (
          <AssigneeDropdown
            ticket={t}
            technicians={technicians}
            onUpdate={updateTicket}
          />
        )
      case 'intervention_date':
        return t.intervention_date
          ? <span className="tk-date-with-icon"><Calendar size={12} />{formatDate(t.intervention_date)}</span>
          : <span className="tk-empty-cell">—</span>
      case 'bon_data':
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <StatusDot
              present={!!t.bon_data}
              onClick={(e) => { e.stopPropagation(); setBonTicket(t) }}
            />
          </div>
        )
      case 'photos':
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <StatusDot
              present={Array.isArray(t.photos) && t.photos.length > 0}
              onClick={(e) => { e.stopPropagation(); setPhotosTicket(t) }}
            />
          </div>
        )
      case 'facture_url':
        return (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <FactureDot ticket={t} onClick={(e) => { e.stopPropagation(); setFactureTicket(t) }} />
          </div>
        )
      case '__actions':
        return (
          <div onClick={e => e.stopPropagation()}>
            <RowMenu
              ticket={t}
              onEdit={() => setDrawer(t)}
              onCalendar={() => setCalTicket(t)}
              onBon={() => setBonTicket(t)}
              onFacture={() => setFactureTicket(t)}
              onPhotos={() => setPhotosTicket(t)}
              onCancel={() => handleCancel(t)}
              onDelete={() => setDeleteTarget(t)}
            />
          </div>
        )
      default:
        return t[col.key] || <span className="tk-empty-cell">—</span>
    }
  }

  return (
    <div className="dossier-page">

      {syncToast && (
        <div className="tk-sync-toast">
          <Check size={13} strokeWidth={3} />
          {syncToast}
        </div>
      )}

      <div className="dossier-header">
        <button className="dossier-title-btn">
          <h1>Tickets</h1>
          <ChevronDown size={15} />
        </button>
        <div className="dossier-header-right">
          <button
            className="tk-reload-btn"
            onClick={handleRefresh}
            title="Rafraîchir et synchroniser les contacts"
            disabled={syncing}
          >
            <RefreshCw size={14} className={syncing ? 'tk-spin' : ''} />
          </button>
          <button className="dossier-add-btn" onClick={() => setDrawer('new')}>
            Nouveau ticket <ChevronDown size={12} />
          </button>
        </div>
      </div>

      <div className="dossier-tabs-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`dossier-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => { setActiveTab(tab.id); setInstallFilter('') }}
          >
            <LayoutList size={12} />
            {tab.label}
            {newCounts[tab.id] > 0 && (
              <span className="tk-tab-badge">{newCounts[tab.id]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="dossier-filter-bar">
        <div className="tk-search-wrap">
          <Search size={13} className="tk-search-icon" />
          <input
            className="tk-search-input"
            placeholder="Rechercher par nom, référence, téléphone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="tk-search-clear" onClick={() => setSearch('')}>
              <X size={11} />
            </button>
          )}
        </div>
        {showInstall && (
          <select
            className={`dossier-filter-chip${installFilter ? ' tk-filter-active' : ''}`}
            value={installFilter}
            onChange={e => setInstallFilter(e.target.value)}
          >
            <option value="">Toutes installations</option>
            {Object.entries(INSTALL_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        )}
        <div className="tk-count-label">
          {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {loading ? (
        <div className="tk-loading">
          <RefreshCw size={18} className="tk-spin" />
          <span>Chargement des tickets...</span>
        </div>
      ) : error ? (
        <div className="tk-error-state">
          <AlertCircle size={18} />
          <span>Erreur : {error}</span>
          <button className="tk-reload-btn" onClick={reload}>Réessayer</button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="dossier-table-wrap">
            <table className="dossier-table">
              <thead>
                <tr>
                  {COLS.map(col => (
                    <th
                      key={col.key}
                      className={`dossier-th${col.sortable ? ' sortable' : ''}`}
                      style={{ width: col.w, minWidth: col.w }}
                      onClick={() => col.sortable && toggleSort(col.key)}
                    >
                      {col.label}
                      {col.sortable && (
                        <ArrowUpDown size={11} className={`sort-icon${sortCol === col.key ? ' active' : ''}`} />
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={COLS.length} className="dossier-td dossier-empty-row">
                      <div className="dossier-empty-row-inner">
                        <Ticket size={22} strokeWidth={1.5} />
                        <span>Aucun ticket trouvé</span>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map(t => (
                  <tr
                    key={t.id}
                    className="dossier-row dossier-row--clickable"
                    onClick={() => setDetailTicket(t)}
                  >
                    {COLS.map(col => (
                      <td key={col.key} className="dossier-td">
                        {renderCell(col, t)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="tk-mobile-cards">
            {filtered.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                Aucun ticket trouvé
              </div>
            ) : filtered.map(t => (
              <MobileTicketCard
                key={t.id}
                ticket={t}
                technicians={technicians}
                onClick={() => setDetailTicket(t)}
                onMenu={handleMenuAction}
              />
            ))}
          </div>
        </>
      )}

      {/* Ticket detail modal */}
      {detailTicket && (
        <TicketModal
          ticket={getTicket(detailTicket.id) || detailTicket}
          onClose={() => setDetailTicket(null)}
          onUpdate={async (id, updates) => {
            await updateTicket(id, updates)
            setDetailTicket(prev => ({ ...prev, ...updates }))
          }}
        />
      )}

      {/* Drawer (create/edit) */}
      {drawer && (
        <TicketDrawer
          ticket={drawer === 'new' ? null : drawer}
          technicians={technicians}
          onClose={() => setDrawer(null)}
          onSave={updateTicket}
          onCreate={createTicket}
        />
      )}

      {/* Sub-modals */}
      {bonTicket && (
        <BonInterventionModal
          ticket={getTicket(bonTicket.id) || bonTicket}
          onClose={() => setBonTicket(null)}
          onConfirm={(bonData) => {
            handleBonConfirm(getTicket(bonTicket.id) || bonTicket, bonData)
            setBonTicket(null)
          }}
        />
      )}

      {photosTicket && (
        <PhotosModal
          ticket={getTicket(photosTicket.id) || photosTicket}
          initialPhotos={(getTicket(photosTicket.id) || photosTicket).photos || []}
          onClose={() => setPhotosTicket(null)}
          onConfirm={(photos) => {
            handlePhotosConfirm(getTicket(photosTicket.id) || photosTicket, photos)
            setPhotosTicket(null)
          }}
        />
      )}

      {factureTicket && (
        <FactureModal
          ticket={getTicket(factureTicket.id) || factureTicket}
          onClose={() => setFactureTicket(null)}
          onConfirm={(data) => {
            handleFactureConfirm(getTicket(factureTicket.id) || factureTicket, data)
            setFactureTicket(null)
          }}
        />
      )}

      {calTicket && (
        <CalendarModal
          ticket={getTicket(calTicket.id) || calTicket}
          technicians={technicians}
          allTickets={tickets}
          onClose={() => setCalTicket(null)}
          onConfirm={(date, assignees) =>
            handleCalendarConfirm(getTicket(calTicket.id) || calTicket, date, assignees)
          }
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <DeleteConfirmModal
          ticket={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
