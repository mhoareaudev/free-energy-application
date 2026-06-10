import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDateFR } from '../utils/dateUtils'
import {
  Search, Phone, MessageSquare, HelpCircle, Settings,
  Bell, CheckCheck, X, Trash2, ClipboardList, BellOff,
  Sparkles, ChevronDown, User, Lock, Eye, EyeOff, CheckCircle2,
  Users, Building2, Zap,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import { useGlobalSearchIndex } from '../hooks/useGlobalSearch'
import { supabase } from '../lib/supabase'
import './TopBar.css'

const SEARCH_RESULT_LIMIT = 5

function ProfileModal({ user, userProfile, onClose }) {
  const [tab, setTab]           = useState('profil')
  const [oldPwd, setOldPwd]     = useState('')
  const [newPwd, setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showOld, setShowOld]   = useState(false)
  const [showNew, setShowNew]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(null)
  const [error, setError]       = useState(null)

  const fullName = [userProfile?.prenom, userProfile?.nom].filter(Boolean).join(' ')

  const handlePasswordChange = async () => {
    setError(null); setSuccess(null)
    if (!newPwd) return setError('Le nouveau mot de passe est requis.')
    if (newPwd.length < 6) return setError('Le mot de passe doit faire au moins 6 caractères.')
    if (newPwd !== confirmPwd) return setError('Les mots de passe ne correspondent pas.')
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password: newPwd })
    if (err) setError(err.message)
    else { setSuccess('Mot de passe modifié avec succès !'); setOldPwd(''); setNewPwd(''); setConfirmPwd('') }
    setLoading(false)
  }

  return (
    <div className="profile-modal-backdrop" onClick={onClose}>
      <div className="profile-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="profile-modal-header">
          <div className="profile-modal-avatar">
            {fullName ? fullName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : <User size={20} />}
          </div>
          <div>
            <div className="profile-modal-name">{fullName || 'Utilisateur'}</div>
            <div className="profile-modal-email">{user?.email}</div>
            <div className="profile-modal-role">{userProfile?.role}</div>
          </div>
          <button className="profile-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {/* Tabs */}
        <div className="profile-modal-tabs">
          <button className={`profile-tab${tab === 'profil' ? ' profile-tab--active' : ''}`} onClick={() => setTab('profil')}>
            <User size={13} /> Profil
          </button>
          <button className={`profile-tab${tab === 'securite' ? ' profile-tab--active' : ''}`} onClick={() => setTab('securite')}>
            <Lock size={13} /> Sécurité
          </button>
        </div>

        {/* Content */}
        <div className="profile-modal-body">
          {tab === 'profil' && (
            <div className="profile-info-list">
              <div className="profile-info-row">
                <span className="profile-info-label">Nom complet</span>
                <span className="profile-info-val">{fullName || '—'}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Email</span>
                <span className="profile-info-val">{user?.email || '—'}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Rôle</span>
                <span className="profile-info-val">{userProfile?.role || '—'}</span>
              </div>
              <div className="profile-info-row">
                <span className="profile-info-label">Identifiant</span>
                <span className="profile-info-val">{userProfile?.identifiant || '—'}</span>
              </div>
            </div>
          )}

          {tab === 'securite' && (
            <div className="profile-pwd-form">
              <p className="profile-pwd-hint">Choisissez un mot de passe d'au moins 6 caractères.</p>

              <label>Nouveau mot de passe</label>
              <div className="profile-pwd-wrap">
                <input
                  type={showNew ? 'text' : 'password'}
                  className="profile-pwd-input"
                  placeholder="Nouveau mot de passe"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                />
                <button type="button" className="profile-pwd-eye" onClick={() => setShowNew(p => !p)}>
                  {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              <label>Confirmer le mot de passe</label>
              <div className="profile-pwd-wrap">
                <input
                  type={showOld ? 'text' : 'password'}
                  className="profile-pwd-input"
                  placeholder="Confirmer le mot de passe"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handlePasswordChange()}
                />
                <button type="button" className="profile-pwd-eye" onClick={() => setShowOld(p => !p)}>
                  {showOld ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>

              {error   && <div className="profile-pwd-error">{error}</div>}
              {success && <div className="profile-pwd-success"><CheckCircle2 size={14} />{success}</div>}

              <button className="profile-pwd-save" onClick={handlePasswordChange} disabled={loading || !newPwd || !confirmPwd}>
                {loading ? 'Modification…' : 'Modifier le mot de passe'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function TopBar({ onOpenAssistant, onNavigate }) {
  const navigate = useNavigate()
  const { userProfile, user, signOut } = useAuth()
  const {
    notifications, unreadCount,
    markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications,
    requestNotificationPermission,
  } = useNotifications()

  const [searchQuery, setSearchQuery]       = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu]     = useState(false)

  const notifRef   = useRef(null)
  const userMenuRef = useRef(null)
  const searchRef  = useRef(null)

  const { contacts, entreprises, dossiers } = useGlobalSearchIndex()

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return null
    const match = list => list.filter(r => r.nom.toLowerCase().includes(q)).slice(0, SEARCH_RESULT_LIMIT)
    return {
      contacts:    match(contacts),
      entreprises: match(entreprises),
      dossiers:    match(dossiers),
    }
  }, [searchQuery, contacts, entreprises, dossiers])

  const hasSearchResults = !!searchResults && (
    searchResults.contacts.length || searchResults.entreprises.length || searchResults.dossiers.length
  )

  const goToContact = (id) => {
    sessionStorage.setItem('pendingContactId', id)
    onNavigate?.('contacts')
    setSearchQuery('')
    setShowSearchResults(false)
  }

  const goToDossier = (id) => {
    sessionStorage.setItem('pendingTxId', id)
    onNavigate?.('transactions')
    setSearchQuery('')
    setShowSearchResults(false)
  }

  const goToEntreprise = () => {
    onNavigate?.('entreprises')
    setSearchQuery('')
    setShowSearchResults(false)
  }

  useEffect(() => {
    const handle = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target))  setShowNotifications(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false)
      if (searchRef.current && !searchRef.current.contains(e.target)) setShowSearchResults(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const handleOpenNotifications = () => {
    setShowNotifications(p => !p)
    if (!showNotifications) requestNotificationPermission()
  }

  const getTimeAgo = (dateStr) => {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMin   = Math.floor((now - date) / 60000)
    const diffHours = Math.floor((now - date) / 3600000)
    const diffDays  = Math.floor((now - date) / 86400000)
    if (diffMin  < 1)  return "À l'instant"
    if (diffMin  < 60) return `Il y a ${diffMin}min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays  < 7)  return `Il y a ${diffDays}j`
    return formatDateFR(date)
  }

  const initials = [userProfile?.prenom, userProfile?.nom]
    .filter(Boolean).map(s => s[0]?.toUpperCase() || '').join('')
  const fullName = [userProfile?.prenom, userProfile?.nom].filter(Boolean).join(' ')

  const role = userProfile?.role || ''
  const canSeeAdminIcons = role === 'marketing' || role === 'administrateur'

  return (
    <header className="topbar">

      {/* ── Logo mobile uniquement ── */}
      <img src="/logo.png" alt="FE" className="topbar-logo-mob" />

      {/* ── Search ── */}
      <div className="topbar-search" ref={searchRef}>
        <Search size={14} className="topbar-search-icon" />
        <input
          type="text"
          className="topbar-search-input"
          placeholder="Rechercher un dossier, client..."
          value={searchQuery}
          onChange={e => { setSearchQuery(e.target.value); setShowSearchResults(true) }}
          onFocus={() => setShowSearchResults(true)}
          onKeyDown={e => { if (e.key === 'Escape') setShowSearchResults(false) }}
        />

        {showSearchResults && searchQuery.trim() && (
          <div className="topbar-search-results">
            {!hasSearchResults ? (
              <div className="topbar-search-empty">Aucun résultat pour « {searchQuery.trim()} »</div>
            ) : (
              <>
                {searchResults.contacts.length > 0 && (
                  <div className="topbar-search-group">
                    <div className="topbar-search-group-label">Contacts</div>
                    {searchResults.contacts.map(r => (
                      <button key={`c-${r.id}`} className="topbar-search-item" onClick={() => goToContact(r.id)}>
                        <Users size={13} className="topbar-search-item-icon" />
                        <span className="topbar-search-item-name">{r.nom}</span>
                        {r.ville && <span className="topbar-search-item-sub">{r.ville}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.entreprises.length > 0 && (
                  <div className="topbar-search-group">
                    <div className="topbar-search-group-label">Entreprises</div>
                    {searchResults.entreprises.map(r => (
                      <button key={`e-${r.id}`} className="topbar-search-item" onClick={goToEntreprise}>
                        <Building2 size={13} className="topbar-search-item-icon" />
                        <span className="topbar-search-item-name">{r.nom}</span>
                        {r.sub && <span className="topbar-search-item-sub">{r.sub}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.dossiers.length > 0 && (
                  <div className="topbar-search-group">
                    <div className="topbar-search-group-label">Dossiers</div>
                    {searchResults.dossiers.map(r => (
                      <button key={`d-${r.id}`} className="topbar-search-item" onClick={() => goToDossier(r.id)}>
                        <Zap size={13} className="topbar-search-item-icon" />
                        <span className="topbar-search-item-name">{r.nom}</span>
                        {r.sub && <span className="topbar-search-item-sub">{r.sub}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Right actions ── */}
      <div className="topbar-right">

        {/* Icon group */}
        <div className="topbar-icon-group">
          {canSeeAdminIcons && <>
            <button className="topbar-icon-btn topbar-icon-btn--mob-hide" title="Appels"><Phone size={15} /></button>
            <button className="topbar-icon-btn topbar-icon-btn--mob-hide" title="Messages"><MessageSquare size={15} /></button>
            <button className="topbar-icon-btn" title="Aide"><HelpCircle size={15} /></button>
            <button className="topbar-icon-btn" title="Paramètres" onClick={() => navigate('/pipeline')}><Settings size={15} /></button>
          </>}

          {/* Notifications */}
          {canSeeAdminIcons && <div className="topbar-notif-wrap" ref={notifRef}>
            <button
              className="topbar-icon-btn topbar-icon-btn--notif"
              onClick={handleOpenNotifications}
              title="Notifications"
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span className="topbar-notif-badge">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="topbar-notif-menu">
                <div className="topbar-notif-header">
                  <div className="topbar-notif-header-left">
                    <Bell size={14} /> Notifications
                    {unreadCount > 0 && <span className="topbar-notif-count">{unreadCount}</span>}
                  </div>
                  {unreadCount > 0 && (
                    <button className="topbar-notif-read-all" onClick={markAllAsRead}>
                      <CheckCheck size={13} /> Tout lire
                    </button>
                  )}
                </div>
                <div className="topbar-notif-list">
                  {notifications.length === 0 ? (
                    <div className="topbar-notif-empty">
                      <BellOff size={28} strokeWidth={1.5} />
                      <p>Aucune notification</p>
                    </div>
                  ) : (
                    notifications.slice(0, 30).map(n => (
                      <div
                        key={n.id}
                        className={`topbar-notif-item ${!n.read ? 'unread' : ''}`}
                        onClick={() => !n.read && markAsRead(n.id)}
                      >
                        <div className="topbar-notif-item-icon"><ClipboardList size={14} /></div>
                        <div className="topbar-notif-item-body">
                          <div className="topbar-notif-item-title">{n.title}</div>
                          {n.body && <div className="topbar-notif-item-sub">{n.body}</div>}
                          <div className="topbar-notif-item-time">{getTimeAgo(n.created_at)}</div>
                        </div>
                        <button
                          className="topbar-notif-item-del"
                          onClick={e => { e.stopPropagation(); deleteNotification(n.id) }}
                        ><X size={12} /></button>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="topbar-notif-footer">
                    <button className="topbar-notif-del-all" onClick={deleteAllNotifications}>
                      <Trash2 size={11} /> Tout supprimer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>}
        </div>

        <div className="topbar-sep" />

        {/* Assistant */}
        <button className="topbar-assistant-btn" onClick={onOpenAssistant}>
          <Sparkles size={13} />
          Assistant
        </button>

        <div className="topbar-sep" />

        {/* User / company dropdown */}
        <div className="topbar-user-wrap" ref={userMenuRef}>
          <button className="topbar-user-btn" onClick={() => setShowUserMenu(p => !p)}>
            <span className="topbar-user-dot" />
            <span className="topbar-user-company">Free Energy</span>
            <ChevronDown size={12} />
          </button>

          {showUserMenu && (
            <div className="topbar-user-menu">
              {/* User info */}
              <div className="tum-header">
                <div className="tum-avatar">{initials || <User size={16} />}</div>
                <div className="tum-info">
                  <div className="tum-name">{fullName || 'Utilisateur'}</div>
                  <div className="tum-email">{user?.email || userProfile?.role || ''}</div>
                  <button className="tum-profil-link" onClick={() => { onNavigate?.('profil'); setShowUserMenu(false) }}>Profil et préférences</button>
                </div>
              </div>

              <div className="tum-divider" />

              {/* Compte */}
              <div className="tum-section">
                <div className="tum-section-label">Compte</div>
                <div className="tum-company-name">Free Energy</div>
                <div className="tum-company-role">{userProfile?.role}</div>
              </div>

              <div className="tum-divider" />

              {/* Footer */}
              <div className="tum-footer">
                <button className="tum-logout" onClick={signOut}>Déconnexion</button>
              </div>
            </div>
          )}
        </div>

      </div>

    </header>
  )
}
