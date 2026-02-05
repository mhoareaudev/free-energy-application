import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import './Modal.css'

export default function VTRequestModal({ isOpen, onClose }) {
  const { userProfile } = useAuth()
  const { addVTRequest } = useSpreadsheet()
  const [commerciaux, setCommerciaux] = useState([])
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    commercial: '',
    typeClient: 'btoc',
    typeContrat: 'comptant',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  // Fetch commerciaux on mount
  useEffect(() => {
    const fetchCommerciaux = async () => {
      try {
        const { data, error } = await supabase
          .from('commerciaux')
          .select('id, nom, prenom')
          .order('nom')

        if (error) throw error
        setCommerciaux(data || [])
      } catch (err) {
        console.error('Error fetching commerciaux:', err)
      }
    }

    if (isOpen) {
      fetchCommerciaux()
    }
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
      const today = new Date().toLocaleDateString('fr-FR')

      // Add to spreadsheet
      addVTRequest(targetSheet, {
        commercial: commercialName,
        clientName: clientName,
        dateDemandeVT: today,
      })

      // Also save to Supabase for tracking
      const { error: insertError } = await supabase
        .from('vt_requests')
        .insert({
          nom: formData.nom,
          prenom: formData.prenom,
          commercial: commercialName,
          type_client: formData.typeClient,
          type_contrat: formData.typeContrat,
          target_sheet: targetSheet,
          requested_by: userProfile?.id,
          status: 'pending',
        })

      if (insertError) {
        console.warn('Could not save to vt_requests:', insertError)
      }

      setSuccess(true)
      setFormData({
        nom: '',
        prenom: '',
        commercial: '',
        typeClient: 'btoc',
        typeContrat: 'comptant',
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
