import { useState } from 'react'
import { User, Lock, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import './ProfilPreferences.css'

const TABS = [
  { key: 'profil',   label: 'Profil',   icon: User },
  { key: 'securite', label: 'Sécurité', icon: Lock },
]

export default function ProfilPreferences() {
  const { user, userProfile } = useAuth()
  const [tab, setTab] = useState('profil')

  const [newPwd,     setNewPwd]     = useState('')
  const [confirmPwd, setConfirmPwd] = useState('')
  const [showNew,    setShowNew]    = useState(false)
  const [showConf,   setShowConf]   = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [success,    setSuccess]    = useState(null)
  const [error,      setError]      = useState(null)

  const fullName = [userProfile?.prenom, userProfile?.nom].filter(Boolean).join(' ')
  const initials = fullName ? fullName.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() : '?'

  const handlePasswordChange = async () => {
    setError(null); setSuccess(null)
    if (!newPwd) return setError('Le nouveau mot de passe est requis.')
    if (newPwd.length < 6) return setError('Le mot de passe doit contenir au moins 6 caractères.')
    if (newPwd !== confirmPwd) return setError('Les deux mots de passe ne correspondent pas.')
    setLoading(true)
    const { error: err } = await supabase.auth.updateUser({ password: newPwd })
    if (err) setError(err.message)
    else { setSuccess('Mot de passe modifié avec succès !'); setNewPwd(''); setConfirmPwd('') }
    setLoading(false)
  }

  return (
    <div className="pp-page">
      {/* Sidebar de navigation */}
      <aside className="pp-nav">
        <div className="pp-nav-header">
          <div className="pp-avatar">{initials}</div>
          <div className="pp-nav-name">{fullName || 'Utilisateur'}</div>
          <div className="pp-nav-role">{userProfile?.role}</div>
        </div>
        <nav className="pp-nav-list">
          {TABS.map(t => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                className={`pp-nav-item${tab === t.key ? ' pp-nav-item--active' : ''}`}
                onClick={() => { setTab(t.key); setError(null); setSuccess(null) }}
              >
                <Icon size={15} />
                {t.label}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Contenu */}
      <main className="pp-content">
        {tab === 'profil' && (
          <div className="pp-section">
            <h2 className="pp-section-title">Informations du profil</h2>
            <p className="pp-section-sub">Vos informations personnelles telles qu'elles apparaissent dans l'application.</p>

            <div className="pp-fields">
              <div className="pp-field">
                <label>Nom complet</label>
                <div className="pp-field-val">{fullName || '—'}</div>
              </div>
              <div className="pp-field">
                <label>Adresse email</label>
                <div className="pp-field-val">{user?.email || '—'}</div>
              </div>
              <div className="pp-field">
                <label>Rôle</label>
                <div className="pp-field-val">
                  <span className="pp-role-badge">{userProfile?.role || '—'}</span>
                </div>
              </div>
              <div className="pp-field">
                <label>Identifiant</label>
                <div className="pp-field-val">{userProfile?.identifiant || '—'}</div>
              </div>
              <div className="pp-field">
                <label>Prénom</label>
                <div className="pp-field-val">{userProfile?.prenom || '—'}</div>
              </div>
              <div className="pp-field">
                <label>Nom</label>
                <div className="pp-field-val">{userProfile?.nom || '—'}</div>
              </div>
            </div>
          </div>
        )}

        {tab === 'securite' && (
          <div className="pp-section">
            <h2 className="pp-section-title">Modifier le mot de passe</h2>
            <p className="pp-section-sub">Choisissez un mot de passe sécurisé d'au moins 6 caractères.</p>

            <div className="pp-pwd-form">
              <div className="pp-field">
                <label>Nouveau mot de passe</label>
                <div className="pp-pwd-wrap">
                  <input
                    type={showNew ? 'text' : 'password'}
                    className="pp-input"
                    placeholder="Entrez votre nouveau mot de passe"
                    value={newPwd}
                    onChange={e => setNewPwd(e.target.value)}
                  />
                  <button type="button" className="pp-eye" onClick={() => setShowNew(p => !p)}>
                    {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="pp-field">
                <label>Confirmer le mot de passe</label>
                <div className="pp-pwd-wrap">
                  <input
                    type={showConf ? 'text' : 'password'}
                    className="pp-input"
                    placeholder="Confirmez votre nouveau mot de passe"
                    value={confirmPwd}
                    onChange={e => setConfirmPwd(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePasswordChange()}
                  />
                  <button type="button" className="pp-eye" onClick={() => setShowConf(p => !p)}>
                    {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error   && <div className="pp-error">{error}</div>}
              {success && <div className="pp-success"><CheckCircle2 size={15} />{success}</div>}

              <button
                className="pp-save-btn"
                onClick={handlePasswordChange}
                disabled={loading || !newPwd || !confirmPwd}
              >
                {loading ? 'Modification en cours…' : 'Modifier le mot de passe'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
