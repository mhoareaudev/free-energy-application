import { useEffect, useMemo, useState } from 'react'
import { isoToDMY, formatDateFR } from '../utils/dateUtils'
import { X, User, MapPin, Phone, Mail, Zap, Tag, Briefcase, Target, Check, Clock, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import { getColumnIdToLetterMap } from '../data/sheetsConfig'
import VTFormTech from './VTFormTech'
import VTWaiting from './VTWaiting'
import NomenclatureView from './NomenclatureView'
import NomenclatureGlobal from './NomenclatureGlobal'
import DPForm from './DPForm'
import './CRMModal.css'

// ── Stepper steps ────────────────────────────────────────────
// field: clé dans data. null = "Terminé" (déduit des autres).
const STEPS = [
  { id: 1,  label: 'Demande de VT',    field: 'dateDemandeVT' },
  { id: 2,  label: 'Visite Technique', field: 'dateRetourVT'  },
  { id: 3,  label: 'Nomenclature',     field: 'nomenclature'  },
  { id: 4,  label: 'DP',               field: 'nDP'           },
  { id: 5,  label: 'RAC',              field: 'raccordement'  },
  { id: 6,  label: 'VAD',              field: 'vad'           },
  { id: 7,  label: 'Pose',             field: 'datePose'      },
  { id: 8,  label: 'Consuel',          field: 'consuelVise'   },
  { id: 9,  label: 'EDF',              field: 'mesEDF'        },
  { id: 10, label: 'Terminé',          field: null            },
]

function computeStepStatuses(data) {
  // done[i] = true si l'étape i (0-indexed) est validée
  const done = STEPS.map(({ field }, i) => {
    if (field === null) {
      // "Terminé" = toutes les étapes précédentes validées
      return STEPS.slice(0, i).every((s) => !!data[s.field])
    }
    return !!data[field]
  })

  // Première étape non faite = étape courante
  const currentIdx = done.findIndex((d) => !d)

  return STEPS.map((step, i) => ({
    ...step,
    isDone:    done[i],
    isCurrent: currentIdx === i,
  }))
}

// ── Client fields ─────────────────────────────────────────────
const FIELD_ICONS = {
  commercial:    Briefcase,
  objectif:      Target,
  typeContact:   Tag,
  adresse:       MapPin,
  ville:         MapPin,
  codePostal:    MapPin,
  telephone:     Phone,
  email:         Mail,
  typeProduit:   Zap,
  interlocuteur: User,
}

const CLIENT_FIELDS = [
  { key: 'commercial',    label: 'Commercial' },
  { key: 'objectif',      label: 'Objectif' },
  { key: 'typeContact',   label: 'Type de contact' },
  { key: 'typeProduit',   label: 'Type de produit' },
  { key: 'adresse',       label: "Adresse d'installation" },
  { key: 'ville',         label: 'Ville' },
  { key: 'codePostal',    label: 'Code postal' },
  { key: 'telephone',     label: 'Téléphone' },
  { key: 'email',         label: 'Email' },
  { key: 'interlocuteur', label: 'Interlocuteur' },
]

// ── Step info cards (for steps without a dedicated form) ──────
const STEP_HINTS = {
  1:  'Demande de visite technique envoyée au bureau d\'études.',
  4:  'Dépôt de la déclaration préalable (DP) en mairie.',
  5:  'Demande de raccordement transmise à ENEDIS.',
  6:  'Validation administrative et enregistrement du dossier.',
  7:  'Installation photovoltaïque posée sur site.',
  8:  'Visa Consuel obtenu — installation conforme.',
  9:  'Mise en service EDF (MES) effectuée.',
}

function StepCard({ step, data }) {
  const value = step.field ? data[step.field] : null
  const statusClass = step.isDone ? 'done' : step.isCurrent ? 'current' : 'pending'
  const statusLabel = step.isDone ? 'Complété' : step.isCurrent ? 'En cours' : 'En attente'
  return (
    <div className="crm-step-card">
      <div className={`crm-step-card-badge crm-step-card-badge--${statusClass}`}>
        {step.isDone ? <Check size={12} strokeWidth={3} /> : step.isCurrent ? <Clock size={12} /> : <Clock size={12} />}
        {statusLabel}
      </div>
      {value && <div className="crm-step-card-value">{value}</div>}
      {STEP_HINTS[step.id] && (
        <div className="crm-step-card-hint">{STEP_HINTS[step.id]}</div>
      )}
    </div>
  )
}

function StepDoneCard() {
  return (
    <div className="crm-step-card crm-step-done-card">
      <div className="crm-step-card-badge crm-step-card-badge--done">
        <Check size={12} strokeWidth={3} /> Toutes les étapes complétées
      </div>
      <div className="crm-step-card-hint">
        Le dossier est entièrement traité. Toutes les étapes ont été validées avec succès.
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────
export default function CRMModal({ isOpen, onClose, data }) {
  const { userProfile } = useAuth()
  const { setCellValue, saveData, deleteRow, sheets } = useSpreadsheet()
  const [toast, setToast] = useState(null) // { msg, type }
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [rightTab, setRightTab] = useState('suivi') // 'suivi' | 'nomenclatures'
  const [nomenclatureEditMode, setNomenclatureEditMode] = useState(false)
  const [selectedStepId, setSelectedStepId] = useState(null) // null = follow currentStep

  // Derived directly from sheets state — updates automatically after any setCellValue
  const freshNomData = useMemo(() => {
    if (!data?.activeSheet || !data?.rowNumber) return null
    try {
      const json = sheets[data.activeSheet]?.cells?.[`__nomenclature:${data.rowNumber}`]
      return json ? JSON.parse(json) : null
    } catch { return null }
  }, [sheets, data?.activeSheet, data?.rowNumber])

  const freshDPData = useMemo(() => {
    if (!data?.activeSheet || !data?.rowNumber) return null
    try {
      const json = sheets[data.activeSheet]?.cells?.[`__dpForm:${data.rowNumber}`]
      return json ? JSON.parse(json) : null
    } catch { return null }
  }, [sheets, data?.activeSheet, data?.rowNumber])

  useEffect(() => {
    if (!isOpen) return
    setNomenclatureEditMode(false)
    setSelectedStepId(null)
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || !data) return null

  const steps = computeStepStatuses(data)
  const currentStep = steps.find((s) => s.isCurrent)
  const isTechRole = userProfile?.role === 'technique'

  // Step 10 (Terminé) is only reachable when all other steps are done
  const allStepsDone = steps.slice(0, -1).every(s => s.isDone)

  // Which step to display content for (selected by click, or auto-follow current)
  const displayStep = selectedStepId
    ? (steps.find(s => s.id === selectedStepId) ?? currentStep)
    : currentStep

  const handleStepClick = (step) => {
    if (step.id === 10 && !allStepsDone) return
    setSelectedStepId(step.id)
  }

  const handleNomenclatureSave = async (nomenclatureData) => {
    setCellValue(data.activeSheet, `__nomenclature:${data.rowNumber}`, JSON.stringify(nomenclatureData))

    await saveData()
    setToast({ msg: 'Nomenclature sauvegardée !', type: 'success' })
    setTimeout(() => setToast(null), 1500)
  }

  const handleNomenclatureSubmit = async (nomenclatureData) => {
    setCellValue(data.activeSheet, `__nomenclature:${data.rowNumber}`, JSON.stringify(nomenclatureData))

    const colMap = getColumnIdToLetterMap(data.activeSheet)
    const letter = colMap['RECEPTION_BDC']
    if (letter) {
      setCellValue(data.activeSheet, `${letter}${data.rowNumber}`, formatDateFR())
    }
    await saveData()
    setToast({ msg: 'Nomenclature validée !', type: 'success' })
    setTimeout(() => {
      setToast(null)
      onClose()
    }, 1500)
  }

  // Handlers for editing nomenclature from the Nomenclatures tab (modal stays open)
  const handleNomenclatureEditSave = async (nomenclatureData) => {
    setCellValue(data.activeSheet, `__nomenclature:${data.rowNumber}`, JSON.stringify(nomenclatureData))

    await saveData()
    setNomenclatureEditMode(false)
    setToast({ msg: 'Nomenclature sauvegardée !', type: 'success' })
    setTimeout(() => setToast(null), 1500)
  }

  const handleNomenclatureEditSubmit = async (nomenclatureData) => {
    setCellValue(data.activeSheet, `__nomenclature:${data.rowNumber}`, JSON.stringify(nomenclatureData))

    const colMap = getColumnIdToLetterMap(data.activeSheet)
    const letter = colMap['RECEPTION_BDC']
    if (letter) setCellValue(data.activeSheet, `${letter}${data.rowNumber}`, formatDateFR())
    await saveData()
    setNomenclatureEditMode(false)
    setToast({ msg: 'Nomenclature validée !', type: 'success' })
    setTimeout(() => setToast(null), 1500)
  }

  const handleDPSave = async (dpData) => {
    setCellValue(data.activeSheet, `__dpForm:${data.rowNumber}`, JSON.stringify(dpData))
    if (dpData.isComplete && dpData.numeroDP) {
      const colMap = getColumnIdToLetterMap(data.activeSheet)
      const letter = colMap['N_DP'] || colMap['DEMANDE_DP']
      if (letter) setCellValue(data.activeSheet, `${letter}${data.rowNumber}`, dpData.numeroDP)
    }
    await saveData()
    if (dpData.isComplete) {
      setToast({ msg: 'DP validée — étape RAC débloquée !', type: 'success' })
      setTimeout(() => setToast(null), 2500)
    }
  }

  const handleVTSave = async (formState) => {
    setCellValue(data.activeSheet, `__vtTechForm:${data.rowNumber}`, JSON.stringify(formState))
    await saveData()
    setToast({ msg: 'Données sauvegardées !', type: 'success' })
    setTimeout(() => setToast(null), 1500)
  }

  const handleVTSubmit = async (formState) => {
    // Save form data
    setCellValue(data.activeSheet, `__vtTechForm:${data.rowNumber}`, JSON.stringify(formState))

    // Set DATE_RETOUR_VT to today
    const colMap = getColumnIdToLetterMap(data.activeSheet)
    const vtLetter = colMap['DATE_RETOUR_VT']
    if (vtLetter) {
      setCellValue(data.activeSheet, `${vtLetter}${data.rowNumber}`, isoToDMY(formState.dateRetour))
    }

    await saveData()
    setToast({ msg: 'Visite technique envoyée !', type: 'success' })
    setTimeout(() => {
      setToast(null)
      onClose()
    }, 1500)
  }

  const visibleFields = CLIENT_FIELDS.filter(({ key }) => {
    if (key === 'interlocuteur' && !data.interlocuteur) return false
    if (key === 'email' && data.interlocuteur !== undefined && !data.email) return false
    return true
  })

  const handleDeleteDossier = async () => {
    deleteRow(data.rowNumber, data.activeSheet)
    await saveData()
    onClose()
  }

  return (
    <div className="crm-backdrop" onClick={onClose}>
      <div className="crm-modal" onClick={(e) => e.stopPropagation()}>
        {toast && (
          <div className={`crm-toast crm-toast--${toast.type}`}>{toast.msg}</div>
        )}

        {/* ── Header ── */}
        <div className="crm-header">
          <div className="crm-header-left">
            <div className="crm-client-avatar">
              {data.clientName ? data.clientName.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <h2 className="crm-client-name">{data.clientName || 'Client sans nom'}</h2>
              <span className="crm-sheet-badge">{data.sheetLabel}</span>
            </div>
          </div>
          <button className="crm-close-btn" onClick={onClose} title="Fermer">
            <X size={20} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="crm-body">

          {/* Left — Client info */}
          <div className="crm-panel crm-panel-client">
            <div className="crm-panel-title">
              <User size={16} />
              Informations client
            </div>
            <div className="crm-fields">
              {visibleFields.map(({ key, label }) => {
                const value = data[key]
                const Icon = FIELD_ICONS[key] || User
                return (
                  <div key={key} className="crm-field">
                    <div className="crm-field-icon">
                      <Icon size={14} />
                    </div>
                    <div className="crm-field-content">
                      <span className="crm-field-label">{label}</span>
                      <span className={`crm-field-value ${!value ? 'crm-field-empty' : ''}`}>
                        {value || '—'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* ── Bouton suppression ── */}
            <div className="crm-delete-zone">
              {confirmDelete ? (
                <div className="crm-delete-confirm">
                  <span>Supprimer définitivement ce dossier ?</span>
                  <div className="crm-delete-confirm-btns">
                    <button className="crm-delete-cancel-btn" onClick={() => setConfirmDelete(false)}>
                      Annuler
                    </button>
                    <button className="crm-delete-confirm-btn" onClick={handleDeleteDossier}>
                      Confirmer
                    </button>
                  </div>
                </div>
              ) : (
                <button className="crm-delete-btn" onClick={() => setConfirmDelete(true)}>
                  Supprimer le dossier
                </button>
              )}
            </div>
          </div>

          {/* Right — Suivi de dossier / Nomenclatures */}
          <div className="crm-panel crm-panel-suivi">
            <div className="crm-right-tabs">
              <button
                className={`crm-right-tab ${rightTab === 'suivi' ? 'crm-right-tab--active' : ''}`}
                onClick={() => setRightTab('suivi')}
              >
                <Briefcase size={14} />
                Suivi de dossier
              </button>
              <button
                className={`crm-right-tab ${rightTab === 'nomenclatures' ? 'crm-right-tab--active' : ''}`}
                onClick={() => setRightTab('nomenclatures')}
              >
                Nomenclatures
              </button>
            </div>

            {rightTab === 'nomenclatures' ? (
              nomenclatureEditMode ? (
                <NomenclatureView
                  initialData={{ ...freshNomData, validated: false }}
                  onSave={handleNomenclatureEditSave}
                  onSubmit={handleNomenclatureEditSubmit}
                  onCancel={() => setNomenclatureEditMode(false)}
                  clientData={data}
                />
              ) : (
                <NomenclatureGlobal
                  clientData={data}
                  nomenclatureData={freshNomData}
                  onEdit={() => setNomenclatureEditMode(true)}
                />
              )
            ) : (<>

            {/* Stepper */}
            <div className="crm-stepper">
              {steps.map((step, i) => {
                const stateClass = step.isDone
                  ? 'crm-step--done'
                  : step.isCurrent
                    ? 'crm-step--current'
                    : 'crm-step--pending'
                const isSelected = displayStep?.id === step.id
                const isLocked = step.id === 10 && !allStepsDone

                return (
                  <div
                    key={step.id}
                    className={`crm-step ${stateClass} ${isSelected ? 'crm-step--selected' : ''} ${isLocked ? 'crm-step--locked' : 'crm-step--clickable'}`}
                    onClick={() => handleStepClick(step)}
                    title={isLocked ? 'Complétez toutes les étapes pour accéder à Terminé' : step.label}
                  >
                    {i > 0 && (
                      <div className={`crm-step-line crm-step-line--left ${steps[i - 1].isDone ? 'crm-step-line--done' : ''}`} />
                    )}

                    <div className="crm-step-circle">
                      {isLocked
                        ? <Lock size={11} />
                        : step.isDone
                          ? <Check size={14} strokeWidth={3} />
                          : <span className="crm-step-number">{step.id}</span>
                      }
                    </div>

                    {i < steps.length - 1 && (
                      <div className={`crm-step-line crm-step-line--right ${step.isDone ? 'crm-step-line--done' : ''}`} />
                    )}

                    <span className="crm-step-label">{step.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Step-specific content */}
            {displayStep?.id === 2 ? (
              isTechRole ? (
                <VTFormTech
                  initialData={data.vtTechFormData}
                  clientName={data.clientName}
                  onSave={handleVTSave}
                  onSubmit={handleVTSubmit}
                  onCancel={onClose}
                />
              ) : displayStep.isDone ? (
                <StepCard step={displayStep} data={data} />
              ) : (
                <VTWaiting
                  dateDemandeVT={data.dateDemandeVT}
                  chargesAffaires={data.chargesAffaires}
                  clientName={data.clientName}
                />
              )
            ) : displayStep?.id === 3 ? (
              isTechRole ? (
                <NomenclatureView
                  initialData={freshNomData}
                  onSave={handleNomenclatureSave}
                  onSubmit={handleNomenclatureSubmit}
                  onCancel={onClose}
                  clientData={data}
                />
              ) : displayStep.isDone ? (
                <StepCard step={displayStep} data={data} />
              ) : (
                <VTWaiting
                  dateDemandeVT={data.dateDemandeVT}
                  chargesAffaires={data.chargesAffaires}
                  clientName={data.clientName}
                  title="En attente de la nomenclature"
                />
              )
            ) : displayStep?.id === 4 ? (
              <DPForm
                initialData={freshDPData}
                onSave={handleDPSave}
              />
            ) : displayStep?.id === 10 ? (
              <StepDoneCard />
            ) : displayStep ? (
              <StepCard step={displayStep} data={data} />
            ) : (
              <div className="crm-suivi-placeholder">
                <p>Sélectionnez une étape pour voir les détails.</p>
              </div>
            )}

            </>)}
          </div>

        </div>
      </div>
    </div>
  )
}
