import { useState, useEffect, useRef } from 'react'
import { LayoutDashboard, FolderOpen, Package, LogOut, User, Shield, Users, Building2, Zap, Table2, Ticket, Megaphone, Mail, Bot, CalendarDays } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Sidebar.css'

const DOSSIERS_PAGES = new Set(['contacts', 'entreprises', 'transactions', 'tickets', 'dossiers', 'calendrier'])
const MARKETING_PAGES = new Set(['mailing', 'assistant-admin'])

const DOSSIERS_SUBITEMS = [
  { id: 'contacts',      label: 'Contacts',      icon: Users },
  { id: 'entreprises',   label: 'Entreprises',   icon: Building2 },
  { id: 'transactions',  label: 'Transactions',  icon: Zap },
  { id: 'calendrier',   label: 'Calendrier',    icon: CalendarDays },
  { id: 'tickets',      label: 'Tickets',       icon: Ticket, separator: true },
  { id: 'dossiers',      label: 'Vue tableau',   icon: Table2, noMobile: true },
]

const MARKETING_SUBITEMS = [
  { id: 'mailing',          label: 'Mailing',    icon: Mail },
  { id: 'assistant-admin',  label: 'Assistant',  icon: Bot  },
]

export default function Sidebar({ activePage, setActivePage, onOpenAdmin }) {
  const { userProfile, signOut, isAdmin } = useAuth()
  const role = userProfile?.role || ''
  const canSeeMarketing = role === 'marketing' || role === 'administrateur'

  const [isMobile,       setIsMobile]       = useState(() => window.innerWidth <= 768)
  const [dossiersOpen,   setDossiersOpen]   = useState(false)
  const [marketingOpen,  setMarketingOpen]  = useState(false)
  const [avatarOpen,     setAvatarOpen]     = useState(false)
  const dossiersRef  = useRef(null)
  const marketingRef = useRef(null)
  const avatarRef    = useRef(null)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  useEffect(() => {
    if (!dossiersOpen) return
    const h = e => { if (dossiersRef.current && !dossiersRef.current.contains(e.target)) setDossiersOpen(false) }
    document.addEventListener('mousedown', h)
    document.addEventListener('touchstart', h)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h) }
  }, [dossiersOpen])

  useEffect(() => {
    if (!marketingOpen) return
    const h = e => { if (marketingRef.current && !marketingRef.current.contains(e.target)) setMarketingOpen(false) }
    document.addEventListener('mousedown', h)
    document.addEventListener('touchstart', h)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h) }
  }, [marketingOpen])

  useEffect(() => {
    if (!avatarOpen) return
    const h = e => { if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false) }
    document.addEventListener('mousedown', h)
    document.addEventListener('touchstart', h)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('touchstart', h) }
  }, [avatarOpen])

  const handleNav = id => { setActivePage(id); setDossiersOpen(false) }

  const initials = [userProfile?.prenom, userProfile?.nom]
    .filter(Boolean)
    .map(s => s[0]?.toUpperCase() || '')
    .join('')

  const fullName = [userProfile?.prenom, userProfile?.nom].filter(Boolean).join(' ')

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <img src="/logo.png" alt="FE" />
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">

        {/* Dashboard */}
        <button
          className={`sidebar-nav-item ${activePage === 'dashboard' ? 'active' : ''}`}
          onClick={() => handleNav('dashboard')}
        >
          <LayoutDashboard size={19} strokeWidth={1.75} />
          <span className="sidebar-tooltip">Tableau de bord</span>
        </button>

        {/* Dossiers — submenu flyout (hover on desktop, click on mobile) */}
        <div
          ref={dossiersRef}
          className={`sidebar-dossiers-wrap${dossiersOpen ? ' sidebar-dossiers-wrap--open' : ''}`}
        >
          <button
            className={`sidebar-nav-item ${DOSSIERS_PAGES.has(activePage) ? 'active' : ''}`}
            onClick={() => isMobile && setDossiersOpen(o => !o)}
          >
            <FolderOpen size={19} strokeWidth={1.75} />
          </button>
          <div className="sidebar-submenu">
            <div className="sidebar-submenu-header">Dossiers</div>
            {DOSSIERS_SUBITEMS.map(item => {
              const Icon = item.icon
              return (
                <div key={item.id} className={item.noMobile ? 'sidebar-submenu-wrap--no-mobile' : ''}>
                  {item.separator && <div className="sidebar-submenu-sep" />}
                  <button
                    className={`sidebar-submenu-item ${activePage === item.id ? 'active' : ''}`}
                    onClick={() => handleNav(item.id)}
                  >
                    <Icon size={14} strokeWidth={1.75} />
                    {item.label}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Nomenclatures */}
        <button
          className={`sidebar-nav-item ${activePage === 'nomenclatures' ? 'active' : ''}`}
          onClick={() => handleNav('nomenclatures')}
        >
          <Package size={19} strokeWidth={1.75} />
          <span className="sidebar-tooltip">Nomenclatures</span>
        </button>

        {/* Marketing — submenu flyout (marketing + administrateur uniquement) */}
        {canSeeMarketing && <div
          ref={marketingRef}
          className={`sidebar-dossiers-wrap${marketingOpen ? ' sidebar-dossiers-wrap--open' : ''}`}
        >
          <button
            className={`sidebar-nav-item ${MARKETING_PAGES.has(activePage) ? 'active' : ''}`}
            onClick={() => isMobile && setMarketingOpen(o => !o)}
          >
            <Megaphone size={19} strokeWidth={1.75} />
          </button>
          <div className="sidebar-submenu">
            <div className="sidebar-submenu-header">Marketing</div>
            {MARKETING_SUBITEMS.map(item => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  className={`sidebar-submenu-item ${activePage === item.id ? 'active' : ''}`}
                  onClick={() => { handleNav(item.id); setMarketingOpen(false) }}
                >
                  <Icon size={14} strokeWidth={1.75} />
                  {item.label}
                </button>
              )
            })}
          </div>
        </div>}

      </nav>

      {/* Bottom */}
      <div className="sidebar-bottom">
        {isAdmin && isAdmin() && (
          <button className="sidebar-icon-btn" onClick={onOpenAdmin}>
            <Shield size={17} strokeWidth={1.75} />
            <span className="sidebar-tooltip">Administration</span>
          </button>
        )}

        {/* Logout — hidden on mobile (moved to avatar popup) */}
        <button className="sidebar-icon-btn sidebar-icon-btn--mob-hide" onClick={signOut}>
          <LogOut size={17} strokeWidth={1.75} />
          <span className="sidebar-tooltip">Se déconnecter</span>
        </button>

        {/* Avatar — tap on mobile opens logout popup */}
        <div ref={avatarRef} className="sidebar-avatar-wrap" onClick={() => isMobile && setAvatarOpen(o => !o)}>
          <div className="sidebar-avatar">
            {initials || <User size={14} />}
          </div>
          <div className="sidebar-tooltip sidebar-tooltip--user">
            <span className="sidebar-tooltip-name">{fullName || 'Utilisateur'}</span>
            <span className="sidebar-tooltip-role">{userProfile?.role}</span>
          </div>
          {avatarOpen && (
            <div className="sidebar-avatar-menu">
              <div className="sidebar-avatar-menu-info">
                <div className="sidebar-avatar-menu-name">{fullName || 'Utilisateur'}</div>
                <div className="sidebar-avatar-menu-role">{userProfile?.role}</div>
              </div>
              <div className="sidebar-avatar-menu-sep" />
              <button className="sidebar-avatar-menu-logout" onClick={signOut}>
                <LogOut size={14} strokeWidth={1.75} />
                Se déconnecter
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
