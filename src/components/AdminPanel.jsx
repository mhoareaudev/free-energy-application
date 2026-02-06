import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Upload, User, Edit2, XCircle, Users, Briefcase, Save, Shield } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ROLES, useAuth } from '../context/AuthContext'
import { SHEETS, getSheetColumns } from '../data/sheetsConfig'
import './AdminPanel.css'

export default function AdminPanel({ isOpen, onClose }) {
  const { userProfile } = useAuth()
  const [activeTab, setActiveTab] = useState('profiles')
  const [profiles, setProfiles] = useState([])
  const [commerciaux, setCommerciaux] = useState([])
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showCommercialForm, setShowCommercialForm] = useState(false)
  const [editingProfile, setEditingProfile] = useState(null)
  const [editingCommercial, setEditingCommercial] = useState(null)
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    identifiant: '',
    password: '',
    role: ROLES.COMMERCIAL,
  })
  const [commercialFormData, setCommercialFormData] = useState({
    nom: '',
    prenom: '',
  })
  const [roleVisibility, setRoleVisibility] = useState({})
  const [loadingRoles, setLoadingRoles] = useState(false)
  const [activeRoleTab, setActiveRoleTab] = useState('administratif')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Fetch data on mount and tab change
  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'profiles') {
        fetchProfiles()
      } else if (activeTab === 'commerciaux') {
        fetchCommerciaux()
      } else if (activeTab === 'roles') {
        fetchRoleVisibility()
      }
    }
  }, [isOpen, activeTab])

  const fetchProfiles = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setProfiles(data || [])
    } catch (err) {
      console.error('Error fetching profiles:', err)
      setError('Erreur lors du chargement des profils.')
    } finally {
      setLoading(false)
    }
  }

  const fetchCommerciaux = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('commerciaux')
        .select('*')
        .order('nom', { ascending: true })

      if (error) throw error
      setCommerciaux(data || [])
    } catch (err) {
      console.error('Error fetching commerciaux:', err)
      setError('Erreur lors du chargement des commerciaux.')
    } finally {
      setLoading(false)
    }
  }

  const fetchRoleVisibility = async () => {
    setLoadingRoles(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('role_visibility')
        .select('*')

      if (error) throw error

      const visibility = {}
      ;(data || []).forEach(row => {
        visibility[row.role] = row.hidden_groups || {}
      })
      setRoleVisibility(visibility)
    } catch (err) {
      console.error('Error fetching role visibility:', err)
      setError('Erreur lors du chargement de la visibilité des rôles.')
    } finally {
      setLoadingRoles(false)
    }
  }

  const toggleGroupVisibility = async (role, sheetId, groupName) => {
    setError(null)
    const currentHidden = roleVisibility[role] || {}
    const sheetHidden = currentHidden[sheetId] || []

    let newSheetHidden
    if (sheetHidden.includes(groupName)) {
      newSheetHidden = sheetHidden.filter(g => g !== groupName)
    } else {
      newSheetHidden = [...sheetHidden, groupName]
    }

    const newHidden = { ...currentHidden, [sheetId]: newSheetHidden }

    // Optimistic update
    setRoleVisibility(prev => ({ ...prev, [role]: newHidden }))

    try {
      const { error } = await supabase
        .from('role_visibility')
        .upsert({
          role,
          hidden_groups: newHidden,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'role' })

      if (error) throw error
    } catch (err) {
      console.error('Error updating role visibility:', err)
      setError('Erreur lors de la mise à jour.')
      // Revert optimistic update
      fetchRoleVisibility()
    }
  }

  const isGroupVisible = (role, sheetId, groupName) => {
    const hidden = roleVisibility[role]?.[sheetId] || []
    return !hidden.includes(groupName)
  }

  const handleUpdateRole = async (profileId, newRole) => {
    setError(null)
    setSuccess(null)

    if (profileId === userProfile?.id && newRole !== ROLES.ADMINISTRATEUR) {
      setError('Vous ne pouvez pas retirer votre propre rôle administrateur.')
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', profileId)

      if (error) throw error

      await fetchProfiles()
      setEditingProfile(null)
      setSuccess('Rôle mis à jour avec succès.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating role:', err)
      setError('Erreur lors de la mise à jour du rôle.')
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCommercialChange = (e) => {
    const { name, value } = e.target
    setCommercialFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleCreateProfile = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.identifiant,
        password: formData.password,
        options: {
          data: {
            nom: formData.nom,
            prenom: formData.prenom,
            role: formData.role,
          },
        },
      })

      if (authError) throw authError

      if (!authData.user) {
        throw new Error('Erreur lors de la création de l\'utilisateur')
      }

      await fetchProfiles()
      setFormData({
        nom: '',
        prenom: '',
        identifiant: '',
        password: '',
        role: ROLES.COMMERCIAL,
      })
      setShowCreateForm(false)
      setSuccess('Profil créé avec succès. Un email de confirmation a été envoyé.')
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      console.error('Error creating profile:', err)
      if (err.message?.includes('already registered')) {
        setError('Cet email est déjà utilisé.')
      } else {
        setError('Erreur lors de la création du profil. Veuillez réessayer.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCommercial = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await supabase
        .from('commerciaux')
        .insert({
          nom: commercialFormData.nom,
          prenom: commercialFormData.prenom,
        })

      if (error) throw error

      await fetchCommerciaux()
      setCommercialFormData({ nom: '', prenom: '' })
      setShowCommercialForm(false)
      setSuccess('Commercial ajouté avec succès.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error creating commercial:', err)
      setError('Erreur lors de l\'ajout du commercial.')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateCommercial = async (id) => {
    setError(null)
    try {
      const commercial = commerciaux.find(c => c.id === id)
      if (!commercial) return

      const { error } = await supabase
        .from('commerciaux')
        .update({
          nom: commercial.nom,
          prenom: commercial.prenom,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      setEditingCommercial(null)
      setSuccess('Commercial mis à jour avec succès.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error updating commercial:', err)
      setError('Erreur lors de la mise à jour du commercial.')
    }
  }

  const handleDeleteProfile = async (profileId) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce profil ?')) return

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', profileId)

      if (error) throw error
      await fetchProfiles()
    } catch (err) {
      console.error('Error deleting profile:', err)
      setError('Erreur lors de la suppression du profil.')
    }
  }

  const handleDeleteCommercial = async (id) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce commercial ?')) return

    try {
      const { error } = await supabase
        .from('commerciaux')
        .delete()
        .eq('id', id)

      if (error) throw error
      await fetchCommerciaux()
      setSuccess('Commercial supprimé.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      console.error('Error deleting commercial:', err)
      setError('Erreur lors de la suppression du commercial.')
    }
  }

  const handleImportExcel = () => {
    alert('Fonctionnalité d\'import Excel à venir')
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

  const updateCommercialField = (id, field, value) => {
    setCommerciaux(prev => prev.map(c =>
      c.id === id ? { ...c, [field]: value } : c
    ))
  }

  if (!isOpen) return null

  return (
    <div className="admin-overlay" onClick={onClose}>
      <div className="admin-panel" onClick={(e) => e.stopPropagation()}>
        <div className="admin-header">
          <h2 className="admin-title">Administration</h2>
          <button className="admin-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'profiles' ? 'active' : ''}`}
            onClick={() => setActiveTab('profiles')}
          >
            <Users size={16} />
            Profils
          </button>
          <button
            className={`admin-tab ${activeTab === 'commerciaux' ? 'active' : ''}`}
            onClick={() => setActiveTab('commerciaux')}
          >
            <Briefcase size={16} />
            Commerciaux
          </button>
          <button
            className={`admin-tab ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            <Shield size={16} />
            Rôles
          </button>
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}

        {success && (
          <div className="success-message">{success}</div>
        )}

        {/* Profiles Tab */}
        {activeTab === 'profiles' && (
          <>
            <div className="admin-actions">
              <button
                className="btn btn-primary"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus size={16} />
                Créer un profil
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleImportExcel}
              >
                <Upload size={16} />
                Importer un tableau Excel
              </button>
            </div>

            {showCreateForm && (
              <form className="create-form" onSubmit={handleCreateProfile}>
                <h3>Nouveau profil</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="nom">Nom</label>
                    <input
                      type="text"
                      id="nom"
                      name="nom"
                      value={formData.nom}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="prenom">Prénom</label>
                    <input
                      type="text"
                      id="prenom"
                      name="prenom"
                      value={formData.prenom}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="identifiant">Identifiant (email)</label>
                    <input
                      type="email"
                      id="identifiant"
                      name="identifiant"
                      value={formData.identifiant}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="password">Mot de passe</label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      minLength={6}
                      required
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="role">Rôle</label>
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleChange}
                      required
                    >
                      <option value={ROLES.COMMERCIAL}>Commercial</option>
                      <option value={ROLES.ADMINISTRATIF}>Administratif</option>
                      <option value={ROLES.TECHNIQUE}>Technique</option>
                      <option value={ROLES.ADMINISTRATEUR}>Administrateur</option>
                    </select>
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCreateForm(false)}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Création...' : 'Créer le profil'}
                  </button>
                </div>
              </form>
            )}

            <div className="profiles-list">
              <h3>Profils existants ({profiles.length})</h3>
              {loading && profiles.length === 0 ? (
                <div className="loading">Chargement...</div>
              ) : profiles.length === 0 ? (
                <div className="empty">Aucun profil créé</div>
              ) : (
                <div className="profiles-grid">
                  {profiles.map((profile) => (
                    <div key={profile.id} className="profile-card">
                      <div className="profile-avatar">
                        <User size={24} />
                      </div>
                      <div className="profile-info">
                        <div className="profile-name">
                          {profile.prenom} {profile.nom}
                        </div>
                        <div className="profile-email">
                          {profile.identifiant}
                        </div>
                        {editingProfile === profile.id ? (
                          <div className="profile-role-edit">
                            <select
                              value={profile.role}
                              onChange={(e) => handleUpdateRole(profile.id, e.target.value)}
                              className="role-select"
                            >
                              <option value={ROLES.COMMERCIAL}>Commercial</option>
                              <option value={ROLES.ADMINISTRATIF}>Administratif</option>
                              <option value={ROLES.TECHNIQUE}>Technique</option>
                              <option value={ROLES.ADMINISTRATEUR}>Administrateur</option>
                            </select>
                            <button
                              className="btn-icon"
                              onClick={() => setEditingProfile(null)}
                              title="Annuler"
                            >
                              <XCircle size={16} />
                            </button>
                          </div>
                        ) : (
                          <div className="profile-role-container">
                            <div className={`profile-role role-${profile.role}`}>
                              {getRoleLabel(profile.role)}
                            </div>
                            <button
                              className="btn-icon btn-edit"
                              onClick={() => setEditingProfile(profile.id)}
                              title="Modifier le rôle"
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                      {profile.id !== userProfile?.id && (
                        <button
                          className="profile-delete"
                          onClick={() => handleDeleteProfile(profile.id)}
                          title="Supprimer"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Commerciaux Tab */}
        {activeTab === 'commerciaux' && (
          <>
            <div className="admin-actions">
              <button
                className="btn btn-primary"
                onClick={() => setShowCommercialForm(true)}
              >
                <Plus size={16} />
                Ajouter un commercial
              </button>
            </div>

            {showCommercialForm && (
              <form className="create-form" onSubmit={handleCreateCommercial}>
                <h3>Nouveau commercial</h3>
                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="commercial-prenom">Prénom</label>
                    <input
                      type="text"
                      id="commercial-prenom"
                      name="prenom"
                      value={commercialFormData.prenom}
                      onChange={handleCommercialChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="commercial-nom">Nom</label>
                    <input
                      type="text"
                      id="commercial-nom"
                      name="nom"
                      value={commercialFormData.nom}
                      onChange={handleCommercialChange}
                      required
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowCommercialForm(false)}
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Ajout...' : 'Ajouter'}
                  </button>
                </div>
              </form>
            )}

            <div className="profiles-list">
              <h3>Liste des commerciaux ({commerciaux.length})</h3>
              <p className="list-hint">Ces noms apparaissent dans le menu déroulant lors d'une demande de VT.</p>
              {loading && commerciaux.length === 0 ? (
                <div className="loading">Chargement...</div>
              ) : commerciaux.length === 0 ? (
                <div className="empty">Aucun commercial ajouté</div>
              ) : (
                <div className="profiles-grid">
                  {commerciaux.map((commercial) => (
                    <div key={commercial.id} className="profile-card commercial-card">
                      <div className="profile-avatar commercial-avatar">
                        <Briefcase size={24} />
                      </div>
                      <div className="profile-info">
                        {editingCommercial === commercial.id ? (
                          <div className="commercial-edit-form">
                            <input
                              type="text"
                              value={commercial.prenom}
                              onChange={(e) => updateCommercialField(commercial.id, 'prenom', e.target.value)}
                              placeholder="Prénom"
                              className="edit-input"
                            />
                            <input
                              type="text"
                              value={commercial.nom}
                              onChange={(e) => updateCommercialField(commercial.id, 'nom', e.target.value)}
                              placeholder="Nom"
                              className="edit-input"
                            />
                            <div className="edit-actions">
                              <button
                                className="btn-icon btn-save"
                                onClick={() => handleUpdateCommercial(commercial.id)}
                                title="Sauvegarder"
                              >
                                <Save size={16} />
                              </button>
                              <button
                                className="btn-icon"
                                onClick={() => {
                                  setEditingCommercial(null)
                                  fetchCommerciaux()
                                }}
                                title="Annuler"
                              >
                                <XCircle size={16} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="profile-name">
                              {commercial.prenom} {commercial.nom}
                            </div>
                            <button
                              className="btn-icon btn-edit inline-edit"
                              onClick={() => setEditingCommercial(commercial.id)}
                              title="Modifier"
                            >
                              <Edit2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                      <button
                        className="profile-delete"
                        onClick={() => handleDeleteCommercial(commercial.id)}
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Rôles Tab */}
        {activeTab === 'roles' && (
          <>
            <div className="role-subtabs">
              <button
                className={`role-subtab ${activeRoleTab === 'administratif' ? 'active' : ''}`}
                onClick={() => setActiveRoleTab('administratif')}
              >
                <span className="role-badge-header administratif">Administratif</span>
              </button>
              <button
                className={`role-subtab ${activeRoleTab === 'technique' ? 'active' : ''}`}
                onClick={() => setActiveRoleTab('technique')}
              >
                <span className="role-badge-header technique">Technique</span>
              </button>
              <button
                className={`role-subtab ${activeRoleTab === 'commercial' ? 'active' : ''}`}
                onClick={() => setActiveRoleTab('commercial')}
              >
                <span className="role-badge-header commercial">Commercial</span>
              </button>
            </div>
            <div className="roles-container">
              <p className="list-hint">Configurez les groupes de colonnes visibles pour ce rôle. Les administrateurs et commerciaux voient toutes les colonnes.</p>
              {loadingRoles ? (
                <div className="loading">Chargement...</div>
              ) : (
                SHEETS.map(sheet => {
                  const config = getSheetColumns(sheet.id)
                  return (
                    <div key={sheet.id} className="sheet-subsection">
                      <div className="sheet-subsection-title">{sheet.name}</div>
                      {config.groups.map(group => (
                        <div key={group.name} className="group-toggle-row">
                          <div className="group-toggle-info">
                            <span
                              className="group-color-dot"
                              style={{ backgroundColor: group.colors.border }}
                            />
                            <span className="group-toggle-name">{group.name}</span>
                          </div>
                          <button
                            className={`toggle-switch ${isGroupVisible(activeRoleTab, sheet.id, group.name) ? 'active' : ''}`}
                            onClick={() => toggleGroupVisibility(activeRoleTab, sheet.id, group.name)}
                            title={isGroupVisible(activeRoleTab, sheet.id, group.name) ? 'Visible' : 'Masqué'}
                          />
                        </div>
                      ))}
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
