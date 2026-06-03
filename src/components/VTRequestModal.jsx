import { useState, useEffect } from 'react'
import { formatDateFR } from '../utils/dateUtils'
import { X } from 'lucide-react'
import { supabaseGet, supabasePost } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import { useNotifications } from '../context/NotificationContext'
import './Modal.css'

export default function VTRequestModal({ isOpen, onClose }) {
  const { userProfile } = useAuth()
  const { addVTRequest } = useSpreadsheet()
  const { notifyAllExcept } = useNotifications()
  const [commerciaux, setCommerciaux] = useState([])
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    commercial: '',
    typeClient: 'btoc',
    typeContrat: 'comptant',
    puissance: '',
    adresse: '',
    codePostal: '',
    commune: '',
    email: '',
    tel: '',
    reventeSurplus: '',
    contratMaintenance: '',
    batterie: '',
    priseSécurisée: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Fetch commerciaux on open
  useEffect(() => {
    if (!isOpen) return
    supabaseGet('commerciaux', { select: 'id,nom,prenom', order: 'nom.asc' })
      .then(data => setCommerciaux(data))
  }, [isOpen])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Determine which sheet to use based on type_client and type_contrat
  const getTargetSheet = () => {
    if (formData.typeClient === 'btob') {
      return 'btob'
    }
    return formData.typeContrat === 'comptant' ? 'btoc-comptant' : 'btoc-abonnement'
  }

  const getSheetLabel = (sheetId) => {
    switch (sheetId) {
      case 'btoc-comptant': return 'Suivi activités BtoC – Comptant'
      case 'btoc-abonnement': return 'Suivi activités BtoC – Abonnement'
      case 'btob': return 'Suivi activités BtoB'
      default: return sheetId
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const targetSheet = getTargetSheet()
      const commercialName = formData.commercial || `${userProfile?.prenom} ${userProfile?.nom}`
      const clientName = `${formData.prenom} ${formData.nom}`
      const today = formatDateFR()
      const chargesAffaires = [userProfile?.prenom, userProfile?.nom].filter(Boolean).join(' ')

      // Add to spreadsheet
      addVTRequest(targetSheet, {
        commercial: commercialName,
        clientName: clientName,
        dateDemandeVT: today,
        chargesAffaires,
        vtFormData: {
          commercial: commercialName,
          clientName: clientName,
          chargesAffaires,
          date: today,
          typeContrat: formData.typeContrat,
          puissance: formData.puissance,
          adresse: formData.adresse,
          codePostal: formData.codePostal,
          commune: formData.commune,
          email: formData.email,
          tel: formData.tel,
          reventeSurplus: formData.reventeSurplus,
          contratMaintenance: formData.contratMaintenance,
          batterie: formData.batterie,
          priseSécurisée: formData.priseSécurisée,
        },
      })

      // Save to Supabase for tracking (fire-and-forget — non-critical)
      supabasePost('vt_requests', {
        nom: formData.nom,
        prenom: formData.prenom,
        commercial: commercialName,
        type_client: formData.typeClient,
        type_contrat: formData.typeContrat,
        target_sheet: targetSheet,
        requested_by: userProfile?.id,
        status: 'pending',
      }).catch(e => console.warn('Could not save to vt_requests:', e))

      // Notify all other users about the new VT request
      const requesterName = `${userProfile?.prenom || ''} ${userProfile?.nom || ''}`.trim()
      notifyAllExcept(
        userProfile?.id,
        'vt_request',
        'Nouvelle demande de VT',
        `Faite par ${requesterName} pour ${clientName}`,
        { target_sheet: targetSheet }
      )

      setSuccess(true)
      setFormData({
        nom: '',
        prenom: '',
        commercial: '',
        typeClient: 'btoc',
        typeContrat: 'comptant',
        puissance: '',
        adresse: '',
        codePostal: '',
        commune: '',
        email: '',
        tel: '',
        reventeSurplus: '',
        contratMaintenance: '',
        batterie: '',
        priseSécurisée: '',
      })

      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 2000)
    } catch (err) {
      console.error('Error submitting VT request:', err)
      setError('Erreur lors de l\'envoi de la demande. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Demander une VT</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          {success ? (
            <div className="success-message">
              <div className="success-icon">✓</div>
              <p>Demande envoyée avec succès !</p>
              <p className="success-detail">Ajoutée à : {getSheetLabel(getTargetSheet())}</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="error-message">{error}</div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="nom">Nom du client</label>
                  <input
                    type="text"
                    id="nom"
                    name="nom"
                    value={formData.nom}
                    onChange={handleChange}
                    required
                    placeholder="Entrez le nom"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="prenom">Prénom du client</label>
                  <input
                    type="text"
                    id="prenom"
                    name="prenom"
                    value={formData.prenom}
                    onChange={handleChange}
                    required
                    placeholder="Entrez le prénom"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="commercial">Nom du commercial</label>
                <select
                  id="commercial"
                  name="commercial"
                  value={formData.commercial}
                  onChange={handleChange}
                  required
                >
                  <option value="">Sélectionnez un commercial</option>
                  {commerciaux.map((c) => (
                    <option key={c.id} value={`${c.prenom} ${c.nom}`}>
                      {c.prenom} {c.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="typeClient">Type de client</label>
                  <select
                    id="typeClient"
                    name="typeClient"
                    value={formData.typeClient}
                    onChange={handleChange}
                    required
                  >
                    <option value="btoc">BtoC (Particulier)</option>
                    <option value="btob">BtoB (Professionnel)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="typeContrat">Type de contrat</label>
                  <select
                    id="typeContrat"
                    name="typeContrat"
                    value={formData.typeContrat}
                    onChange={handleChange}
                    required
                    disabled={formData.typeClient === 'btob'}
                  >
                    <option value="comptant">Comptant</option>
                    <option value="abonnement">Abonnement</option>
                  </select>
                  {formData.typeClient === 'btob' && (
                    <span className="form-hint">BtoB utilise un onglet dédié</span>
                  )}
                </div>
              </div>

              <div className="form-section-title">Projet</div>

              <div className="form-group">
                <label htmlFor="puissance">Puissance envisagée (kWc)</label>
                <input
                  type="text"
                  id="puissance"
                  name="puissance"
                  value={formData.puissance}
                  onChange={handleChange}
                  placeholder="Ex: 3, 6, 9..."
                />
              </div>

              <div className="form-group">
                <label htmlFor="adresse">Adresse</label>
                <input
                  type="text"
                  id="adresse"
                  name="adresse"
                  value={formData.adresse}
                  onChange={handleChange}
                  placeholder="Adresse de pose"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="codePostal">Code postal</label>
                  <input
                    type="text"
                    id="codePostal"
                    name="codePostal"
                    value={formData.codePostal}
                    onChange={handleChange}
                    placeholder="Code postal"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="commune">Commune</label>
                  <input
                    type="text"
                    id="commune"
                    name="commune"
                    value={formData.commune}
                    onChange={handleChange}
                    placeholder="Commune"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="email">E-mail</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="E-mail du client"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="tel">Téléphone</label>
                  <input
                    type="tel"
                    id="tel"
                    name="tel"
                    value={formData.tel}
                    onChange={handleChange}
                    placeholder="Téléphone du client"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="reventeSurplus">AC avec revente du surplus</label>
                  <select
                    id="reventeSurplus"
                    name="reventeSurplus"
                    value={formData.reventeSurplus}
                    onChange={handleChange}
                  >
                    <option value="">-</option>
                    <option value="oui">Oui</option>
                    <option value="non">Non</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="contratMaintenance">Contrat de maintenance</label>
                  <select
                    id="contratMaintenance"
                    name="contratMaintenance"
                    value={formData.contratMaintenance}
                    onChange={handleChange}
                  >
                    <option value="">-</option>
                    <option value="oui">Oui</option>
                    <option value="non">Non</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="batterie">Batterie</label>
                  <input
                    type="text"
                    id="batterie"
                    name="batterie"
                    value={formData.batterie}
                    onChange={handleChange}
                    placeholder="Batterie"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="priseSécurisée">Prise sécurisée</label>
                  <input
                    type="text"
                    id="priseSécurisée"
                    name="priseSécurisée"
                    value={formData.priseSécurisée}
                    onChange={handleChange}
                    placeholder="Prise sécurisée"
                  />
                </div>
              </div>

              <div className="form-info">
                <strong>Onglet cible :</strong> {getSheetLabel(getTargetSheet())}
              </div>
            </>
          )}
        </form>

        {!success && (
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={loading || !formData.nom || !formData.prenom || !formData.commercial}
            >
              {loading ? 'Envoi...' : 'Créer la demande VT'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
