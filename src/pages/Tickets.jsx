import { useState, useEffect, useMemo } from 'react'
import {
  Ticket, ChevronDown, Search, X, LayoutList,
  ArrowUpDown, RefreshCw, AlertCircle, Edit2, Trash2,
  Check, Calendar,
} from 'lucide-react'
import { ilioSupabase } from '../lib/ilioSupabase'
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

function DocDot({ present, isNonFacturable }) {
  if (isNonFacturable) return <span className="tk-doc-dot tk-doc-dot--na">—</span>
  if (present) return <span className="tk-doc-dot tk-doc-dot--yes"><Check size={9} strokeWidth={3} /></span>
  return <span className="tk-doc-dot tk-doc-dot--no" />
}

function AssigneeAvatars({ assigned_to }) {
  const list = normalizeAssignees(assigned_to)
  if (!list.length) return <span className="tk-empty-cell">—</span>
  return (
    <div className="tk-assignees">
      {list.slice(0, 3).map((email, i) => (
        <div
          key={i} title={email}
          className="tk-avatar"
          style={{ background: avatarColor(email) }}
        >
          {getInitials(email)}
        </div>
      ))}
      {list.length > 3 && (
        <div className="tk-avatar tk-avatar--more">+{list.length - 3}</div>
      )}
    </div>
  )
}

// ── Data hooks ─────────────────────────────────────────────────

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

// ── Ticket Drawer ──────────────────────────────────────────────

export function TicketDrawer({ ticket, technicians, onClose, onSave, onCreate, prefill }) {
  const isEdit = !!ticket

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

        <form className="tk-drawer-body" onSubmit={handleSubmit} id="tk-form">
          {error && <div className="tk-form-error">{error}</div>}

          {/* Status + Priority (edit only, at top) */}
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

          {/* Documents indicators (read-only) */}
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

          {/* Client */}
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

          {/* Ticket info */}
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

          {/* Assignment & Planning */}
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

          {/* Internal note (edit only) */}
          {isEdit && (
            <>
              <div className="tk-form-section">Note interne</div>
              <div className="tk-form-group">
                <textarea rows={3} value={form.internal_note} onChange={e => set('internal_note', e.target.value)} placeholder="Note interne (non visible par le client)..." />
              </div>
            </>
          )}
        </form>

        <div className="tk-drawer-footer">
          <button type="button" className="tk-btn-cancel" onClick={onClose} disabled={saving}>
            Annuler
          </button>
          <button type="submit" form="tk-form" className="tk-btn-save" disabled={saving || !form.client_name}>
            {saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer le ticket'}
          </button>
        </div>
      </aside>
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────

async function syncAllTicketContacts() {
  // 1. Tous les tickets ayant un email
  const { data: allTickets } = await ilioSupabase
    .from('tickets')
    .select('id,reference,client_name,client_firstname,email,phone,address,postal_code,commune,installation_type,channel')
    .not('email', 'is', null)
    .neq('email', '')

  if (!allTickets?.length) return 0

  // 2. Emails déjà dans ticket_clients
  const { data: existing } = await ilioSupabase
    .from('ticket_clients')
    .select('email')

  const knownEmails = new Set(
    (existing || []).map(c => c.email?.toLowerCase()).filter(Boolean)
  )

  // 3. Filtrer ceux qui manquent + dédoublonner par email
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

export default function Tickets() {
  const { tickets, loading, error, reload, updateTicket, createTicket, deleteTicket } = useIlioTickets()
  const technicians = useTechnicians()

  const [activeTab, setActiveTab]     = useState('particuliers')
  const [search, setSearch]           = useState('')
  const [installFilter, setInstallFilter] = useState('')
  const [drawer, setDrawer]           = useState(null)  // null | 'new' | ticket object
  const [sortCol, setSortCol]         = useState(null)
  const [sortDir, setSortDir]         = useState('desc')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [syncing, setSyncing]         = useState(false)
  const [syncToast, setSyncToast]     = useState(null)

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

    // Closed always at bottom
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
    { key: 'assigned_to',       label: 'Assigné',      w: 100, sortable: false },
    { key: 'intervention_date', label: 'Intervention', w: 120, sortable: true  },
    { key: 'bon_data',          label: 'Bon',          w: 50,  sortable: false },
    { key: 'photos',            label: 'Photos',       w: 60,  sortable: false },
    { key: 'facture_url',       label: 'Facture',      w: 60,  sortable: false },
    { key: '__actions',         label: '',             w: 80,  sortable: false },
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
        return <AssigneeAvatars assigned_to={t.assigned_to} />
      case 'intervention_date':
        return t.intervention_date
          ? <span className="tk-date-with-icon"><Calendar size={12} />{formatDate(t.intervention_date)}</span>
          : <span className="tk-empty-cell">—</span>
      case 'bon_data':
        return <DocDot present={!!t.bon_data} />
      case 'photos':
        return <DocDot present={Array.isArray(t.photos) && t.photos.length > 0} />
      case 'facture_url':
        return <DocDot present={!!t.facture_url && t.facture_url !== 'non_facturable'} isNonFacturable={t.facture_url === 'non_facturable'} />
      case '__actions':
        return (
          <div className="tk-row-actions" onClick={e => e.stopPropagation()}>
            <button className="tk-action-btn" title="Modifier" onClick={() => setDrawer(t)}>
              <Edit2 size={13} />
            </button>
            {deleteConfirm === t.id ? (
              <>
                <button className="tk-action-btn tk-action-btn--danger" onClick={async () => {
                  await deleteTicket(t.id); setDeleteConfirm(null)
                }}><Check size={13} /></button>
                <button className="tk-action-btn" onClick={() => setDeleteConfirm(null)}><X size={12} /></button>
              </>
            ) : (
              <button className="tk-action-btn tk-action-btn--danger" title="Supprimer" onClick={() => setDeleteConfirm(t.id)}>
                <Trash2 size={13} />
              </button>
            )}
          </div>
        )
      default:
        return t[col.key] || <span className="tk-empty-cell">—</span>
    }
  }

  return (
    <div className="dossier-page">

      {/* Toast sync */}
      {syncToast && (
        <div className="tk-sync-toast">
          <Check size={13} strokeWidth={3} />
          {syncToast}
        </div>
      )}

      {/* Header */}
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

      {/* Tabs */}
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

      {/* Filter bar */}
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

      {/* Table */}
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
                  onClick={() => setDrawer(t)}
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
      )}

      {/* Drawer */}
      {drawer && (
        <TicketDrawer
          ticket={drawer === 'new' ? null : drawer}
          technicians={technicians}
          onClose={() => setDrawer(null)}
          onSave={updateTicket}
          onCreate={createTicket}
        />
      )}
    </div>
  )
}
