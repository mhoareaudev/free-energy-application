import { useState, useRef, useEffect } from 'react'
import { Search, Settings, User, ChevronDown, LogOut, Shield, Bell, CheckCheck, X, Trash2, ClipboardList, BellOff } from 'lucide-react'
import { useAuth, ROLES } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationContext'
import './TopBar.css'

export default function TopBar({ onRequestVT, onOpenAdmin }) {
  const { userProfile, signOut, isAdministratif, isAdmin } = useAuth()
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications, requestNotificationPermission } = useNotifications()
  const [searchQuery, setSearchQuery] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const userMenuRef = useRef(null)
  const settingsRef = useRef(null)
  const notificationsRef = useRef(null)

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Request notification permission on first open
  const handleOpenNotifications = () => {
    setShowNotifications(!showNotifications)
    if (!showNotifications) {
      requestNotificationPermission()
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    console.log('Searching for:', searchQuery)
  }

  const handleSignOut = async () => {
    await signOut()
    setShowUserMenu(false)
  }

  const getRoleLabel = (role) => {
    switch (role) {
      case ROLES.ADMINISTRATIF:
        return 'Administratif'
      case ROLES.TECHNIQUE:
        return 'Technique'
      case ROLES.COMMERCIAL:
        return 'Commercial'
      case ROLES.ADMINISTRATEUR:
        return 'Administrateur'
      default:
        return role
    }
  }

  const getTimeAgo = (dateStr) => {
    const now = new Date()
    const date = new Date(dateStr)
    const diffMs = now - date
    const diffMin = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return "A l'instant"
    if (diffMin < 60) return `Il y a ${diffMin}min`
    if (diffHours < 24) return `Il y a ${diffHours}h`
    if (diffDays < 7) return `Il y a ${diffDays}j`
    return date.toLocaleDateString('fr-FR')
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-logo">
          <img src="/logo.png" alt="Free Energy" className="logo-image" />
        </div>
      </div>

      <div className="topbar-center">
        <form className="search-form" onSubmit={handleSearch}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Rechercher..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      <div className="topbar-right">
        {isAdministratif() && (
          <button className="btn-request-vt" onClick={onRequestVT}>
            Demander une VT
          </button>
        )}

        {isAdmin() && (
          <button className="btn-admin" onClick={onOpenAdmin} title="Administration">
            <Shield size={18} />
          </button>
        )}

        {/* Notifications */}
        <div className="notifications-container" ref={notificationsRef}>
          <button
            className="btn-notifications"
            onClick={handleOpenNotifications}
            title="Notifications"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="notification-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="notifications-menu">
              <div className="notifications-menu-header">
                <div className="notifications-header-left">
                  <Bell size={15} />
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="notifications-header-count">{unreadCount}</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    className="btn-mark-all-read"
                    onClick={markAllAsRead}
                    title="Tout marquer comme lu"
                  >
                    <CheckCheck size={14} />
                    <span>Tout lire</span>
                  </button>
                )}
              </div>
              <div className="notifications-menu-content">
                {notifications.length === 0 ? (
                  <div className="notification-empty">
                    <BellOff size={32} strokeWidth={1.5} />
                    <p>Aucune notification</p>
                    <span>Les nouvelles notifications apparaitront ici</span>
                  </div>
                ) : (
                  notifications.slice(0, 30).map((notif) => (
                    <div
                      key={notif.id}
                      className={`notification-item ${!notif.read ? 'unread' : ''}`}
                      onClick={() => !notif.read && markAsRead(notif.id)}
                    >
                      <div className="notification-icon-container">
                        <ClipboardList size={16} />
                      </div>
                      <div className="notification-content">
                        <div className="notification-title">{notif.title}</div>
                        {notif.body && (
                          <div className="notification-body">{notif.body}</div>
                        )}
                        <div className="notification-time">
                          {getTimeAgo(notif.created_at)}
                        </div>
                      </div>
                      <button
                        className="notification-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNotification(notif.id)
                        }}
                        title="Supprimer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
              {notifications.length > 0 && (
                <div className="notifications-menu-footer">
                  <button
                    className="btn-delete-all"
                    onClick={deleteAllNotifications}
                  >
                    <Trash2 size={13} />
                    <span>Tout supprimer</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="settings-container" ref={settingsRef}>
          <button
            className="btn-settings"
            onClick={() => setShowSettings(!showSettings)}
            title="Paramètres"
          >
            <Settings size={18} />
          </button>

          {showSettings && (
            <div className="settings-menu">
              <div className="settings-menu-header">Paramètres</div>
              <div className="settings-menu-content">
                <div className="settings-item">
                  <span>Notifications</span>
                  <input type="checkbox" defaultChecked />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="user-container" ref={userMenuRef}>
          <button
            className="btn-user"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="user-avatar">
              <User size={18} />
            </div>
            <span className="user-name">
              {userProfile?.prenom || 'Utilisateur'}
            </span>
            <ChevronDown size={14} className={`chevron ${showUserMenu ? 'open' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="user-menu">
              <div className="user-menu-header">
                <div className="user-full-name">
                  {userProfile?.prenom} {userProfile?.nom}
                </div>
                <div className="user-role">
                  {getRoleLabel(userProfile?.role)}
                </div>
              </div>
              <div className="user-menu-divider" />
              <button className="user-menu-item" onClick={handleSignOut}>
                <LogOut size={16} />
                <span>Déconnexion</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
