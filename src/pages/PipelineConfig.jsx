import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Plus, Trash2, GripVertical, ChevronDown, Search, ArrowLeft,
  LayoutDashboard, FolderOpen, Package, User, Check, X, CheckCircle2,
  UserPlus, Edit2, Save, Users, Building2, Zap, Table2, LogOut, Ticket, Mail, Loader,
} from 'lucide-react'
import RichTextEditor, { VT_EMAIL_VARIABLES } from '../components/RichTextEditor'
import { supabase, supabaseGet, supabaseUpsert, supabaseDelete } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import '../components/Sidebar.css'
import './PipelineConfig.css'

export const PIPELINE_NAME_KEY   = 'fe_pipeline_name'
export const PIPELINE_PHASES_KEY = 'fe_pipeline_phases'

const COLOR_OPTIONS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899',
  '#64748b', '#0ea5e9', '#84cc16', '#f43f5e',
]

const PROB_OPTIONS = [
  '0%','10%','20%','30%','40%','50%',
  '60%','70%','80%','90%','100% (Gagné)','Perdu (0%)',
]

// slot = stable key linking to computePhase in Transactions (null = custom phase without data mapping)
export const DEFAULT_PHASES = [
  { id: 1,  name: 'Lead entrant',   color: '#64748b', prob: '10%',          count: 0, slot: 'lead'       },
  { id: 2,  name: 'VT en cours',    color: '#8b5cf6', prob: '20%',          count: 0, slot: 'vt_cours'   },
  { id: 3,  name: 'VT validée',     color: '#14b8a6', prob: '30%',          count: 0, slot: 'vt_validee' },
  { id: 4,  name: 'Signé',          color: '#22c55e', prob: '40%',          count: 0, slot: 'signe'      },
  { id: 5,  name: 'DP en cours',    color: '#eab308', prob: '50%',          count: 0, slot: 'dp_cours'   },
  { id: 6,  name: 'DP lancée',      color: '#f97316', prob: '60%',          count: 0, slot: 'dp_lancee'  },
  { id: 7,  name: 'CNO reçu',       color: '#3b82f6', prob: '80%',          count: 0, slot: 'cno'        },
  { id: 8,  name: 'Centrale posée', color: '#22c55e', prob: '100% (Gagné)', count: 0, slot: 'installe'   },
  { id: 9,  name: 'Projet terminé', color: '#14b8a6', prob: '100% (Gagné)', count: 0, slot: null         },
  { id: 10, name: 'Projet perdu',   color: '#ef4444', prob: 'Perdu (0%)',   count: 0, slot: null         },
]

function loadPhases() {
  try {
    const saved = localStorage.getItem(PIPELINE_PHASES_KEY)
    if (saved) return JSON.parse(saved)
  } catch { /* ignore */ }
  return DEFAULT_PHASES
}

// ── Color picker ──────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="pc-color-picker" ref={ref}>
      <button className="pc-color-dot-btn" style={{ background: value }}
        onClick={() => setOpen(p => !p)} title="Couleur" />
      {open && (
        <div className="pc-color-popover">
          {COLOR_OPTIONS.map(c => (
            <button key={c} className={`pc-color-opt ${c === value ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => { onChange(c); setOpen(false) }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Prob select ───────────────────────────────────────────────
function ProbSelect({ value, onChange }) {
  return (
    <div className="pc-prob-wrap">
      <select className="pc-prob-select" value={value} onChange={e => onChange(e.target.value)}>
        {PROB_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
      <ChevronDown size={11} className="pc-prob-chevron" />
    </div>
  )
}

// ── Mini sidebar — même structure que Sidebar.jsx ─────────────
function MiniSidebar() {
  const navigate    = useNavigate()
  const { userProfile, signOut } = useAuth()

  const go = page => navigate('/', { state: { activePage: page } })

  const initials = [userProfile?.prenom, userProfile?.nom]
    .filter(Boolean).map(s => s[0]?.toUpperCase() || '').join('')
  const fullName = [userProfile?.prenom, userProfile?.nom].filter(Boolean).join(' ')

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <img src="/logo.png" alt="FE" />
      </div>

      <nav className="sidebar-nav">
        <button className="sidebar-nav-item" onClick={() => go('dashboard')}>
          <LayoutDashboard size={19} strokeWidth={1.75} />
          <span className="sidebar-tooltip">Tableau de bord</span>
        </button>

        <div className="sidebar-dossiers-wrap">
          <button className="sidebar-nav-item">
            <FolderOpen size={19} strokeWidth={1.75} />
          </button>
          <div className="sidebar-submenu">
            <div className="sidebar-submenu-header">Dossiers</div>
            <button className="sidebar-submenu-item" onClick={() => go('contacts')}>
              <Users size={14} strokeWidth={1.75} />Contacts
            </button>
            <button className="sidebar-submenu-item" onClick={() => go('entreprises')}>
              <Building2 size={14} strokeWidth={1.75} />Entreprises
            </button>
            <button className="sidebar-submenu-item" onClick={() => go('transactions')}>
              <Zap size={14} strokeWidth={1.75} />Transactions
            </button>
            <div className="sidebar-submenu-sep" />
            <button className="sidebar-submenu-item" onClick={() => go('tickets')}>
              <Ticket size={14} strokeWidth={1.75} />Tickets
            </button>
            <button className="sidebar-submenu-item" onClick={() => go('dossiers')}>
              <Table2 size={14} strokeWidth={1.75} />Vue tableau
            </button>
          </div>
        </div>

        <button className="sidebar-nav-item" onClick={() => go('nomenclatures')}>
          <Package size={19} strokeWidth={1.75} />
          <span className="sidebar-tooltip">Nomenclatures</span>
        </button>
      </nav>

      <div className="sidebar-bottom">
        <button className="sidebar-icon-btn" onClick={signOut}>
          <LogOut size={17} strokeWidth={1.75} />
          <span className="sidebar-tooltip">Se déconnecter</span>
        </button>
        <div className="sidebar-avatar-wrap">
          <div className="sidebar-avatar">{initials || <User size={14} />}</div>
          <div className="sidebar-tooltip sidebar-tooltip--user">
            <span className="sidebar-tooltip-name">{fullName || 'Utilisateur'}</span>
            <span className="sidebar-tooltip-role">{userProfile?.role}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Settings nav panel ────────────────────────────────────────
function SettingsNav() {
  const navigate        = useNavigate()
  const { pathname }    = useLocation()
  const [query, setQuery] = useState('')

  return (
    <aside className="pc-settings-nav">
      <div className="pc-settings-nav-header">
        <button className="pc-settings-back" onClick={() => navigate('/')}>
          <ArrowLeft size={13} />
          Tableau de bord
        </button>
      </div>
      <div className="pc-settings-search-wrap">
        <Search size={13} className="pc-settings-search-icon" />
        <input
          className="pc-settings-search"
          placeholder="Paramètres de rech..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {query && (
          <button className="pc-settings-search-clear" onClick={() => setQuery('')}>
            <X size={11} />
          </button>
        )}
      </div>
      <div className="pc-settings-section">
        <div className="pc-settings-section-label">Gestion des données</div>
        <button
          className={`pc-settings-nav-item${pathname === '/pipeline' ? ' pc-settings-nav-item--active' : ''}`}
          onClick={() => navigate('/pipeline')}
        >
          Pipeline
        </button>
      </div>
      <div className="pc-settings-section">
        <div className="pc-settings-section-label">Gestion des équipes</div>
        <button
          className={`pc-settings-nav-item${pathname === '/membres' ? ' pc-settings-nav-item--active' : ''}`}
          onClick={() => navigate('/membres')}
        >
          <Users size={13} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
          Membres &amp; rôles
        </button>
      </div>
    </aside>
  )
}

// ── Team management ───────────────────────────────────────────
const ROLE_LABELS = {
  administrateur: 'Administrateur',
  technique:      'Technique',
  commercial:     'Commercial',
  administratif:  'Administratif',
}
const ROLE_COLORS = {
  administrateur: { bg: '#ede9fe', color: '#7c3aed' },
  technique:      { bg: '#dbeafe', color: '#1d4ed8' },
  commercial:     { bg: '#dcfce7', color: '#15803d' },
  administratif:  { bg: '#fff7ed', color: '#c2410c' },
}

function TeamManagement() {
  const [profiles,      setProfiles]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [editingId,     setEditingId]     = useState(null)
  const [editData,      setEditData]      = useState({})
  const [savingId,      setSavingId]      = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [showAdd,       setShowAdd]       = useState(false)
  const [addForm,       setAddForm]       = useState({ prenom: '', nom: '', identifiant: '', password: '', role: 'commercial' })
  const [addError,      setAddError]      = useState('')
  const [addLoading,    setAddLoading]    = useState(false)

  const loadProfiles = async () => {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').order('nom')
    setProfiles(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { loadProfiles() }, [])

  const startEdit = p => { setEditingId(p.id); setEditData({ prenom: p.prenom || '', nom: p.nom || '', role: p.role || 'commercial' }) }
  const cancelEdit = () => { setEditingId(null); setEditData({}) }

  const saveEdit = async id => {
    setSavingId(id)
    await supabaseUpsert('profiles', { id, ...editData }, 'id')
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...editData } : p))
    setEditingId(null); setSavingId(null)
  }

  const handleDelete = async id => {
    await supabaseDelete('profiles', { id: `eq.${id}` })
    setProfiles(prev => prev.filter(p => p.id !== id))
    setDeleteConfirm(null)
  }

  const handleAdd = async () => {
    setAddError(''); setAddLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ email: addForm.identifiant, password: addForm.password })
      if (error) throw error
      const userId = data.user?.id
      if (!userId) throw new Error('Confirmation par e-mail requise — le compte sera actif après confirmation.')
      await supabaseUpsert('profiles', { id: userId, prenom: addForm.prenom, nom: addForm.nom, role: addForm.role, identifiant: addForm.identifiant }, 'id')
      setShowAdd(false)
      setAddForm({ prenom: '', nom: '', identifiant: '', password: '', role: 'commercial' })
      loadProfiles()
    } catch (e) {
      setAddError(e.message || 'Erreur lors de la création du compte.')
    }
    setAddLoading(false)
  }

  const initials = p => [p.prenom?.[0], p.nom?.[0]].filter(Boolean).join('').toUpperCase()

  return (
    <div>
      <div className="pc-page-header">
        <h1 className="pc-page-title">Gestion des équipes</h1>
        <p className="pc-page-desc">Gérez les comptes et les rôles des membres de votre équipe.</p>
      </div>

      <div className="pc-table-card">
        <div className="pc-team-toolbar">
          <span className="pc-team-count">{profiles.length} membre{profiles.length > 1 ? 's' : ''}</span>
          <button className="pc-team-add-btn" onClick={() => setShowAdd(p => !p)}>
            <UserPlus size={14} />
            Ajouter un membre
          </button>
        </div>

        {showAdd && (
          <div className="pc-team-add-form">
            <div className="pc-team-add-grid">
              {[
                { label: 'Prénom',        key: 'prenom',      type: 'text',     ph: 'Prénom'            },
                { label: 'Nom',           key: 'nom',         type: 'text',     ph: 'Nom'               },
                { label: 'E-mail',        key: 'identifiant', type: 'email',    ph: 'email@exemple.com' },
                { label: 'Mot de passe',  key: 'password',    type: 'password', ph: '••••••••'          },
              ].map(({ label, key, type, ph }) => (
                <div key={key} className="pc-team-field">
                  <label>{label}</label>
                  <input type={type} placeholder={ph} value={addForm[key]}
                    onChange={e => setAddForm(p => ({ ...p, [key]: e.target.value }))} />
                </div>
              ))}
              <div className="pc-team-field">
                <label>Rôle</label>
                <div className="pc-prob-wrap" style={{ width: '100%' }}>
                  <select className="pc-prob-select" style={{ width: '100%' }}
                    value={addForm.role} onChange={e => setAddForm(p => ({ ...p, role: e.target.value }))}>
                    {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <ChevronDown size={11} className="pc-prob-chevron" />
                </div>
              </div>
            </div>
            {addError && <div className="pc-team-error">{addError}</div>}
            <div className="pc-team-add-actions">
              <button className="pc-btn-cancel" onClick={() => { setShowAdd(false); setAddError('') }}>Annuler</button>
              <button className="pc-btn-save" onClick={handleAdd} disabled={addLoading}>
                {addLoading ? 'Création…' : 'Créer le compte'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="pc-team-loading">Chargement des membres…</div>
        ) : profiles.length === 0 ? (
          <div className="pc-team-loading">Aucun membre trouvé.</div>
        ) : (
          <table className="pc-table">
            <thead>
              <tr>
                <th className="pc-th">Membre</th>
                <th className="pc-th">E-mail</th>
                <th className="pc-th">Rôle</th>
                <th className="pc-th" style={{ width: 110 }} />
              </tr>
            </thead>
            <tbody>
              {profiles.map(profile => {
                const isEditing = editingId === profile.id
                const rc = ROLE_COLORS[profile.role] || ROLE_COLORS.administratif
                return (
                  <tr key={profile.id} className="pc-row">
                    <td className="pc-td">
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <input className="pc-name-input" style={{ maxWidth: 100 }} placeholder="Prénom"
                            value={editData.prenom} onChange={e => setEditData(p => ({ ...p, prenom: e.target.value }))} />
                          <input className="pc-name-input" style={{ maxWidth: 130 }} placeholder="Nom"
                            value={editData.nom} onChange={e => setEditData(p => ({ ...p, nom: e.target.value }))} />
                        </div>
                      ) : (
                        <div className="pc-team-member-cell">
                          <div className="pc-team-avatar">{initials(profile) || <User size={13} />}</div>
                          <div className="pc-team-member-name">
                            {[profile.prenom, profile.nom].filter(Boolean).join(' ') || '—'}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="pc-td" style={{ fontSize: 12.5, color: '#64748b' }}>
                      {profile.identifiant || '—'}
                    </td>
                    <td className="pc-td">
                      <div className="pc-team-role-select-wrap">
                        <select
                          className="pc-team-role-select"
                          style={{ background: rc.bg, color: rc.color }}
                          value={isEditing ? editData.role : (profile.role || 'commercial')}
                          onChange={async e => {
                            const role = e.target.value
                            if (isEditing) {
                              setEditData(p => ({ ...p, role }))
                            } else {
                              setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, role } : p))
                              await supabaseUpsert('profiles', { id: profile.id, role }, 'id')
                            }
                          }}
                        >
                          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                        <ChevronDown size={10} className="pc-team-role-chevron" style={{ color: rc.color }} />
                      </div>
                    </td>
                    <td className="pc-td">
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {isEditing ? (
                          <>
                            <button className="pc-team-save-btn" title="Enregistrer"
                              onClick={() => saveEdit(profile.id)} disabled={savingId === profile.id}>
                              <Save size={13} />
                            </button>
                            <button className="pc-del-btn" onClick={cancelEdit} title="Annuler"><X size={13} /></button>
                          </>
                        ) : deleteConfirm === profile.id ? (
                          <>
                            <button className="pc-team-confirm-del" onClick={() => handleDelete(profile.id)}>Confirmer</button>
                            <button className="pc-del-btn" onClick={() => setDeleteConfirm(null)}><X size={13} /></button>
                          </>
                        ) : (
                          <>
                            <button className="pc-team-edit-btn" title="Modifier" onClick={() => startEdit(profile)}><Edit2 size={13} /></button>
                            <button className="pc-del-btn" title="Supprimer" onClick={() => setDeleteConfirm(profile.id)}><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}


// ── Main component ────────────────────────────────────────────
export default function PipelineConfig() {
  const navigate       = useNavigate()
  const { pathname }   = useLocation()
  const activeSection  = pathname === '/membres' ? 'equipes' : 'pipeline'
  const [phases, setPhases]     = useState(loadPhases)
  const [nextId, setNextId]     = useState(() => Math.max(...loadPhases().map(p => p.id)) + 1)
  const [pipelineName, setPipelineName] = useState(
    () => localStorage.getItem(PIPELINE_NAME_KEY) || 'Pipeline de transaction'
  )
  const [showPipelineMenu, setShowPipelineMenu] = useState(false)
  const [notif, setNotif]                       = useState(false)
  const pipelineMenuRef = useRef(null)

  useEffect(() => {
    const h = e => {
      if (pipelineMenuRef.current && !pipelineMenuRef.current.contains(e.target))
        setShowPipelineMenu(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Load from Supabase on mount (overrides localStorage if DB has data)
  useEffect(() => {
    let mounted = true
    supabaseGet('pipeline_configs', { config_key: 'eq.main', select: 'name,phases' })
      .then(data => {
        if (!mounted) return
        const config = data?.[0]
        if (!config) return
        if (config.name) {
          setPipelineName(config.name)
          localStorage.setItem(PIPELINE_NAME_KEY, config.name)
        }
        if (Array.isArray(config.phases) && config.phases.length > 0) {
          setPhases(config.phases)
          setNextId(Math.max(...config.phases.map(p => p.id)) + 1)
          localStorage.setItem(PIPELINE_PHASES_KEY, JSON.stringify(config.phases))
        }
      })
    return () => { mounted = false }
  }, [])

  const updatePhase = (id, field, val) =>
    setPhases(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p))

  const deletePhase = (id) =>
    setPhases(prev => prev.filter(p => p.id !== id))

  const addPhase = () => {
    setPhases(prev => [...prev, { id: nextId, name: 'Nouvelle phase', color: '#64748b', prob: '10%', count: 0 }])
    setNextId(n => n + 1)
  }

  const handleSave = async () => {
    localStorage.setItem(PIPELINE_NAME_KEY, pipelineName)
    localStorage.setItem(PIPELINE_PHASES_KEY, JSON.stringify(phases))
    window.dispatchEvent(new Event('pipelineUpdated'))
    supabaseUpsert('pipeline_configs', {
      config_key: 'main',
      name: pipelineName,
      phases,
      updated_at: new Date().toISOString(),
    }, 'config_key').catch(e => console.warn('Pipeline save to Supabase failed:', e))
    setNotif(true)
    setTimeout(() => setNotif(false), 3000)
  }

  const handleCancel = () => navigate('/')

  return (
    <div className="pc-root">
      {notif && (
        <div className="pc-save-notif">
          <CheckCircle2 size={16} />
          Modifications enregistrées avec succès
        </div>
      )}
      <MiniSidebar />
      <SettingsNav />

      <main className="pc-main">
        {/* ── Top: pipeline selector ── */}
        <header className="pc-topnav">
          <div className="pc-pipeline-select-wrap" ref={pipelineMenuRef}>
            <button
              className="pc-pipeline-select-btn"
              onClick={() => setShowPipelineMenu(p => !p)}
            >
              {pipelineName}
              <ChevronDown size={13} />
            </button>
            {showPipelineMenu && (
              <div className="pc-pipeline-menu">
                <div className="pc-pipeline-menu-item pc-pipeline-menu-item--active">
                  <Check size={13} />
                  {pipelineName}
                </div>
                <div className="pc-pipeline-menu-sep" />
                <button className="pc-pipeline-menu-create">
                  <Plus size={13} />
                  Créer un nouveau pipeline
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── Scrollable body ── */}
        <div className="pc-body">

          {activeSection === 'equipes' && <TeamManagement />}

          {activeSection === 'pipeline' && <>
          {/* Pipeline name */}
          <div className="pc-page-header">
            <h1 className="pc-page-title">Personnaliser les étapes de Transaction</h1>
            <p className="pc-page-desc">
              Définissez les phases de votre pipeline et configurez les probabilités associées.
            </p>
          </div>

          <div className="pc-name-card">
            <label className="pc-name-label">Nom du pipeline</label>
            <input
              className="pc-pipeline-name-field"
              value={pipelineName}
              onChange={e => {
                setPipelineName(e.target.value)
                localStorage.setItem(PIPELINE_NAME_KEY, e.target.value)
                window.dispatchEvent(new Event('pipelineUpdated'))
              }}
            />
          </div>

          {/* Display color option */}
          <div className="pc-display-section">
            <div className="pc-display-label">Définir les couleurs d'affichage du pipeline</div>
            <div className="pc-display-options">
              {[
                { label: 'Couleur de la phase',       desc: 'Chaque phase a sa propre couleur' },
                { label: 'Couleur de la probabilité', desc: 'Basé sur le pourcentage de probabilité' },
                { label: 'Pas de couleur',            desc: 'Affichage neutre sans couleur' },
              ].map((opt, i) => (
                <label key={i} className="pc-display-opt">
                  <input type="radio" name="displayMode" defaultChecked={i === 0} />
                  <div>
                    <div className="pc-display-opt-label">{opt.label}</div>
                    <div className="pc-display-opt-desc">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Phases table */}
          <div className="pc-table-card">
            <table className="pc-table">
              <thead>
                <tr>
                  <th className="pc-th pc-th--grip" />
                  <th className="pc-th">Nom de la phase</th>
                  <th className="pc-th pc-th--center">Couleur</th>
                  <th className="pc-th">Probabilité</th>
                  <th className="pc-th pc-th--center">Utilisé dans</th>
                  <th className="pc-th" />
                </tr>
              </thead>
              <tbody>
                {phases.map(phase => (
                  <tr key={phase.id} className="pc-row">
                    <td className="pc-td pc-td--grip">
                      <GripVertical size={15} className="pc-grip-icon" />
                    </td>
                    <td className="pc-td">
                      <input
                        className="pc-name-input"
                        value={phase.name}
                        onChange={e => updatePhase(phase.id, 'name', e.target.value)}
                      />
                    </td>
                    <td className="pc-td pc-td--center">
                      <ColorPicker value={phase.color} onChange={val => updatePhase(phase.id, 'color', val)} />
                    </td>
                    <td className="pc-td">
                      <ProbSelect value={phase.prob} onChange={val => updatePhase(phase.id, 'prob', val)} />
                    </td>
                    <td className="pc-td pc-td--center">
                      <span className="pc-count-badge">{phase.count}</span>
                    </td>
                    <td className="pc-td pc-td--del">
                      <button className="pc-del-btn" onClick={() => deletePhase(phase.id)} title="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="pc-add-phase-btn" onClick={addPhase}>
              <Plus size={14} />
              Ajouter une phase
            </button>
          </div>

          {/* Footer */}
          <div className="pc-footer">
            <button className="pc-btn-cancel" onClick={handleCancel}>Annuler</button>
            <button className="pc-btn-save" onClick={handleSave}>Enregistrer les modifications</button>
          </div>
          </>}
        </div>
      </main>
    </div>
  )
}
