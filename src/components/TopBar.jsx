import { useState, useRef, useEffect } from 'react'
import { Search, Settings, User, ChevronDown, LogOut, Shield } from 'lucide-react'
import { useAuth, ROLES } from '../context/AuthContext'
import './TopBar.css'

export default function TopBar({ onRequestVT, onOpenAdmin }) {
  const { userProfile, signOut, isAdministratif, isAdmin } = useAuth()
  const [searchQuery, setSearchQuery] = useState('')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const userMenuRef = useRef(null)
  const settingsRef = useRef(null)

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    console.log('Searching for:', searchQuery)
    // TODO: Implement search functionality
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
                  <span>Thème</span>
                  <select defaultValue="light">
                    <option value="light">Clair</option>
                    <option value="dark">Sombre</option>
                  </select>
                </div>
                <div className="settings-item">
                  <span>Langue</span>
                  <select defaultValue="fr">
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                  </select>
                </div>
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
