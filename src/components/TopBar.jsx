import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatDateFR } from '../utils/dateUtils'
import {
  Search, Phone, MessageSquare, HelpCircle, Settings,
  Bell, CheckCheck, X, Trash2, ClipboardList, BellOff,
  Sparkles, ChevronDown, User,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import './TopBar.css'

export default function TopBar({ onOpenAssistant }) {
  const navigate = useNavigate()
  const { userProfile, user, signOut } = useAuth()
  const {
    notifications, unreadCount,
    markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications,
    requestNotificationPermission,
  } = useNotifications()

  const [searchQuery, setSearchQuery]       = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showUserMenu, setShowUserMenu]     = useState(false)

  const notifRef   = useRef(null)
  const userMenuRef = useRef(null)

  useEffect(() => {
    const handle = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target))  setShowNotifications(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false)
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
      <div className="topbar-search">
        <Search size={14} className="topbar-search-icon" />
        <input
          type="text"
          className="topbar-search-input"
          placeholder="Rechercher un dossier, client..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
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
                  <button className="tum-profil-link">Profil et préférences</button>
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
