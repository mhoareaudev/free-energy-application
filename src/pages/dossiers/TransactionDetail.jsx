import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ArrowLeft, ChevronDown, FileText, Paperclip, CheckCircle2,
  Trash2, AlertTriangle, X, Ban,
} from 'lucide-react'
import { useSpreadsheet } from '../../context/SpreadsheetContext'
import { useAuth } from '../../context/AuthContext'
import { getColumnIdToLetterMap } from '../../data/sheetsConfig'
import { supabaseGet, supabasePost, supabaseDelete, supabaseUpsert, supabaseInvoke, storageUpload, storageRemove } from '../../lib/supabase'
import { downloadVTPdfAuto } from '../../utils/generateVTPdf'
import { todayReunion, addDaysToFR } from '../../utils/dateUtils'
import PdfFormViewer from '../../components/PdfFormViewer'
import NomenclatureView from '../../components/NomenclatureView'
import './TransactionDetail.css'
import './ContactDetail.css'

// ── Contact types (shared with ContactDetail) ────────────────────
const CONTACT_TYPES = [
  { value: 'recommendation', label: 'Recommandation'        },
  { value: 'web',            label: 'Web / Réseaux sociaux'  },
  { value: 'foire',          label: 'Foire / Salon'          },
  { value: 'telephone',      label: 'Démarchage tél.'        },
  { value: 'terrain',        label: 'Prospection terrain'    },
]

// ── Dossier stages ──────────────────────────────────────────────
const STAGES = [
  {
    key: 'demande_vt',
    label: 'Demande de VT',
    color: '#f59e0b',
    fields: [
      { id: 'DATE_DDE_VT', label: 'Date demande VT', required: true },
      { id: 'ECHEANCE',    label: 'Échéance', inputType: 'date' },
    ],
  },
  {
    key: 'vt',
    label: 'Visite Technique',
    color: '#d97706',
    fields: [
      { id: 'DATE_PREV_VT',      label: 'Date prévisionnelle VT',        required: true, inputType: 'date' },
      { id: 'DATE_RETOUR_VT',    label: 'Date retour VT',                required: true, inputType: 'date' },
      { id: 'CHARGES_AFFAIRES',  label: "Chargé d'affaires",             required: true },
      { id: 'PUISSANCE_PREVI',   label: 'Puissance prévisionnelle (kWc)', required: true },
      { id: 'PUISSANCE_REALISEE',label: 'Puissance réalisée (kWc)',       required: true },
    ],
  },
  {
    key: 'nomenclature',
    label: 'Nomenclature',
    color: '#06b6d4',
    hideFields: true,
    fields: [],
  },
  {
    key: 'dp',
    label: 'DP',
    color: '#3b82f6',
    hideFields: true,
    fields: [
      { id: 'DEMANDE_DP', label: 'Date demande DP', required: true },
      { id: 'N_DP',       label: 'N° DP',           required: true },
    ],
  },
  {
    key: 'rac',
    label: 'RAC',
    color: '#8b5cf6',
    fields: [
      { id: 'DDE_RACC_EDF', label: 'Date demande raccordement EDF', required: true, inputType: 'date' },
      { id: 'N_SUIVI_EDF',  label: 'N° de suivi EDF',              required: true },
      { id: 'N_CRAE',       label: 'N° Crae' },
    ],
  },
  {
    key: 'vad',
    label: 'VAD',
    color: '#ec4899',
    fields: [
      { id: 'RECEPTION_BDC',        label: 'Réception BDC / dossier',      required: true, inputType: 'date' },
      { id: 'ENREGISTREMENT_ADMIN', label: 'Enregistrement administratif', required: true, inputType: 'date' },
      { id: 'DATE_TRANSMISSION',    label: 'Date de transmission',         required: true, inputType: 'date' },
    ],
  },
  {
    key: 'pose',
    label: 'Pose',
    color: '#f97316',
    fields: [
      { id: 'DATE_PREV_POSE',       label: 'Date prévisionnelle de pose',                              inputType: 'date' },
      { id: 'DATE_REELLE_POSE',     label: 'Date réelle de pose', btobId: 'DATE_POSE', required: true, inputType: 'date' },
      { id: 'POSEUR',               label: 'Poseur',                                   required: true  },
      { id: 'PHOTOS', skip: true },
      { id: 'ATTESTATION_ASSURANCE', skip: true },
    ],
  },
  {
    key: 'consuel',
    label: 'Consuel',
    color: '#22c55e',
    fields: [
      { id: 'DDE_CONSUEL',   label: 'Demande Consuel',                        required: true, inputType: 'date' },
      { id: 'CONSUEL_VISE',  label: 'Consuel visé', btobId: 'CONSUEL_VALIDE', required: true, inputType: 'date' },
    ],
  },
  {
    key: 'edf',
    label: 'EDF',
    color: '#0ea5e9',
    fields: [
      { id: 'T0_REVENTE',    label: 'T0 revente reçu',      inputType: 'select' },
      { id: 'T0_AUTO_CONSO', label: 'T0 auto-consommation', inputType: 'select' },
      { id: 'DDE_MES_EDF',   label: 'Date demande MES EDF', required: true, inputType: 'date' },
      { id: 'MES_EDF',       label: 'MES EDF',              required: true, inputType: 'date' },
    ],
  },
  {
    key: 'termine',
    label: 'Terminé',
    color: '#64748b',
    fields: [
      { id: 'ETAT_DOSSIER', label: 'État du dossier', alwaysReadOnly: true },
    ],
  },
]

function stageCompleted(key, cells, colMap, rowNum, sheetId) {
  const v = id => { const l = colMap[id]; return l ? (cells[`${l}${rowNum}`] || '') : '' }
  switch (key) {
    case 'demande_vt':   return !!v('DATE_DDE_VT')
    case 'vt':           return !!v('DATE_RETOUR_VT')
    case 'nomenclature': return !!(cells[`__nomenclature:${rowNum}`])
    case 'dp':           return !!v('N_DP')
    case 'rac':          return !!v('N_SUIVI_EDF')
    case 'vad':          return !!v('ENREGISTREMENT_ADMIN') || !!v('RECEPTION_BDC')
    case 'pose':         return !!(sheetId === 'btob' ? v('DATE_POSE') : v('DATE_REELLE_POSE'))
    case 'consuel':      return !!(sheetId === 'btob' ? v('CONSUEL_VALIDE') : v('CONSUEL_VISE'))
    case 'edf':          return !!v('MES_EDF')
    case 'termine':      return !!v('MES_EDF')
    default: return false
  }
}

function firstIncompleteStage(cells, colMap, rowNum, sheetId) {
  for (const s of STAGES) {
    if (!stageCompleted(s.key, cells, colMap, rowNum, sheetId)) return s.key
  }
  return STAGES[STAGES.length - 1].key
}

// ── Commercial tracking view ─────────────────────────────────────
const TRACK_STEPS = [
  { key: 'demande_vt',   label: 'Demande de visite technique', dateId: 'DATE_DDE_VT'          },
  { key: 'vt',           label: 'Visite technique',             dateId: 'DATE_RETOUR_VT'       },
  { key: 'nomenclature', label: 'Étude technique',              dateId: null                   },
  { key: 'dp',           label: 'Déclaration préalable',        dateId: 'N_DP'                 },
  { key: 'rac',          label: 'Raccordement EDF',             dateId: 'N_SUIVI_EDF'          },
  { key: 'vad',          label: 'Validation administrative',    dateId: 'ENREGISTREMENT_ADMIN' },
  { key: 'pose',         label: 'Installation de la centrale',  dateId: 'DATE_REELLE_POSE'     },
  { key: 'consuel',      label: 'Consuel',                      dateId: 'CONSUEL_VISE'         },
  { key: 'edf',          label: 'Mise en service EDF',          dateId: 'MES_EDF'              },
  { key: 'termine',      label: 'Projet terminé',               dateId: 'ETAT_DOSSIER'         },
]

function TrackingView({ cells, colMap, rowNum, sheetId }) {
  const get = id => { if (!id) return ''; const l = colMap[id]; return l ? (cells[`${l}${rowNum}`] || '') : '' }
  const doneCount  = TRACK_STEPS.filter(s => stageCompleted(s.key, cells, colMap, rowNum, sheetId)).length
  const currentIdx = TRACK_STEPS.findIndex(s => !stageCompleted(s.key, cells, colMap, rowNum, sheetId))
  const pct        = Math.round((doneCount / TRACK_STEPS.length) * 100)
  const currentLabel = currentIdx >= 0 ? TRACK_STEPS[currentIdx].label : 'Projet terminé'

  return (
    <div className="td-tracking-wrap">
      <div className="td-tracking-status-card">
        <div className="td-tracking-status-left">
          <div className="td-tracking-status-eyebrow">Étape en cours</div>
          <div className="td-tracking-status-value">{currentLabel}</div>
        </div>
        <div className="td-tracking-status-right">
          <div className="td-tracking-pct">{pct}%</div>
          <div className="td-tracking-bar-bg">
            <div className="td-tracking-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="td-tracking-bar-sub">{doneCount} / {TRACK_STEPS.length} étapes</div>
        </div>
      </div>

      <div className="td-tracking-list">
        {TRACK_STEPS.map((step, i) => {
          const done    = stageCompleted(step.key, cells, colMap, rowNum, sheetId)
          const current = i === currentIdx
          const date    = get(step.dateId)
          const status  = done ? 'done' : current ? 'current' : 'pending'
          return (
            <div key={step.key} className={`td-track-item td-track-item--${status}`}>
              <div className="td-track-left">
                <div className="td-track-icon-wrap">
                  {done
                    ? <CheckCircle2 size={20} className="td-track-check" />
                    : <div className="td-track-dot" />
                  }
                </div>
                {i < TRACK_STEPS.length - 1 && <div className="td-track-line" />}
              </div>
              <div className="td-track-right">
                <div className="td-track-step-label">{step.label}</div>
                <div className="td-track-step-sub">
                  {done && date ? date : done ? 'Complété' : current ? 'En cours' : 'En attente'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function fmtMontant(raw) {
  if (!raw) return ''
  const n = parseFloat(String(raw).replace(/[^\d.-]/g, ''))
  if (isNaN(n)) return raw
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

// ── Editable field ──────────────────────────────────────────────
// inputType='date': stores DD/MM/YYYY internally, shows native date picker
function AccordionField({ colId, btobId, label, cells, colMap, rowNum, sheetId, setCellValue, readOnly, inputType, alwaysReadOnly }) {
  const resolvedId = sheetId === 'btob' && btobId ? btobId : colId
  const letter     = colMap[resolvedId]
  const cellKey    = letter ? `${letter}${rowNum}` : null
  const raw        = cellKey ? (cells[cellKey] || '') : ''

  const toDisplay = v => {
    if (inputType !== 'date' || !v) return v
    const p = v.split('/')
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : v
  }
  const toStored = v => {
    if (inputType !== 'date' || !v) return v
    const p = v.split('-')
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v
  }

  const ro = readOnly || alwaysReadOnly
  const [local, setLocal] = useState(toDisplay(raw))
  useEffect(() => setLocal(toDisplay(raw)), [raw])
  if (!letter) return null
  const commit = () => { const s = toStored(local); if (!ro && s !== raw) setCellValue(sheetId, cellKey, s) }
  return (
    <div className="td-acc-field">
      <label className="td-acc-field-label">{label}</label>
      {inputType === 'select' ? (
        <select
          className={`td-acc-field-input${ro ? ' td-acc-field-input--readonly' : ''}`}
          value={local}
          onChange={e => { if (!ro) { setLocal(e.target.value); if (e.target.value !== raw) setCellValue(sheetId, cellKey, e.target.value) } }}
          disabled={ro}
        >
          <option value="">—</option>
          <option value="Oui">Oui</option>
          <option value="Non">Non</option>
        </select>
      ) : (
        <input
          type={inputType || 'text'}
          className={`td-acc-field-input${ro ? ' td-acc-field-input--readonly' : ''}`}
          value={local}
          onChange={e => { if (!ro) setLocal(e.target.value) }}
          onBlur={commit}
          onKeyDown={e => { if (!ro && e.key === 'Enter') { commit(); e.target.blur() } }}
          placeholder="—"
          readOnly={ro}
        />
      )}
    </div>
  )
}

// ── Shared helpers ───────────────────────────────────────────────
const fmtSize = b => b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} Mo` : `${Math.round(b / 1024)} Ko`

function DocSlot({ label, file, uploading, err, dragging, setDragging, fileRef, onUpload, onRemove, validated }) {
  return (
    <div className="doc-slot">
      <div className="td-acc-field-label">{label}</div>
      {file ? (
        <div className="dp-permis-file doc-slot--validated">
          <FileText size={13} color="#3b82f6" style={{ flexShrink: 0 }} />
          <a href={file.url} target="_blank" rel="noreferrer" className="dp-permis-name">{file.name}</a>
          <span className="dp-permis-size">{fmtSize(file.size)}</span>
          {!validated && (
            <button className="dp-permis-del" onClick={onRemove} title="Supprimer">×</button>
          )}
        </div>
      ) : !validated ? (
        <div
          className={`dp-drop-zone${dragging ? ' dp-drop-zone--over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); onUpload(e.dataTransfer.files[0]) }}
          onClick={() => fileRef.current?.click()}
        >
          <input type="file" ref={fileRef} style={{ display: 'none' }}
            onChange={e => onUpload(e.target.files[0])}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          />
          {uploading
            ? <span className="dp-drop-text">Envoi en cours…</span>
            : <><Paperclip size={14} /><span className="dp-drop-text">Glisser-déposer ou cliquer pour joindre</span></>
          }
        </div>
      ) : (
        <span className="dp-no-permis">Aucun fichier joint</span>
      )}
      {err && <div className="dp-upload-err">{err}</div>}
    </div>
  )
}

// ── VAD documents: CNO + T0 ───────────────────────────────────────
function VadDocuments({ cells, colMap, rowNum, sheetId, setCellValue, transactionId, validated, nom, loadActivities }) {
  const { userProfile: vp } = useAuth()
  const uploaderName = [vp?.prenom, vp?.nom].filter(Boolean).join(' ') || 'Inconnu'
  const cnoFile = useMemo(() => { try { return JSON.parse(cells[`__vadCno:${rowNum}`] || 'null') } catch { return null } }, [cells, rowNum])
  const t0File  = useMemo(() => { try { return JSON.parse(cells[`__vadT0:${rowNum}`]  || 'null') } catch { return null } }, [cells, rowNum])

  const [cnoUploading, setCnoUploading] = useState(false)
  const [cnoErr,       setCnoErr]       = useState(null)
  const [t0Uploading,  setT0Uploading]  = useState(false)
  const [t0Err,        setT0Err]        = useState(null)
  const [cnoDragging,  setCnoDragging]  = useState(false)
  const [t0Dragging,   setT0Dragging]   = useState(false)
  const cnoRef = useRef(null)
  const t0Ref  = useRef(null)

  const doUpload = async (file, metaKey, colIds, setUploading, setErr, folder, docLabel) => {
    if (!file) return
    setUploading(true); setErr(null)
    try {
      const path = `vad/${folder}/${transactionId}/${Date.now()}_${file.name}`
      const { publicUrl } = await storageUpload('documents', path, file)
      // Create activity so it appears in the right panel
      let activityId = null
      try {
        const act = await supabasePost('contact_activities', {
          contact_id: transactionId,
          type: 'document',
          title: `${docLabel} ajouté`,
          body: JSON.stringify({ url: publicUrl, filename: file.name }),
          created_by_name: uploaderName,
        })
        activityId = act?.id ?? null
      } catch {}
      setCellValue(sheetId, `${metaKey}:${rowNum}`, JSON.stringify({ name: file.name, path, url: publicUrl, size: file.size, activityId }))
      const today = todayReunion()
      for (const colId of colIds) {
        const letter = colMap[colId]
        if (letter) setCellValue(sheetId, `${letter}${rowNum}`, today)
      }
      loadActivities()
    } catch (e) { setErr(`Échec de l'envoi : ${e?.message || e}`); console.error(e) }
    finally { setUploading(false) }
  }

  const doRemove = async (metaKey, colIds, file) => {
    if (file?.path) await storageRemove('documents', [file.path])
    if (file?.activityId) await supabaseDelete('contact_activities', { id: `eq.${file.activityId}` })
    setCellValue(sheetId, `${metaKey}:${rowNum}`, '')
    for (const colId of colIds) {
      const letter = colMap[colId]
      if (letter) setCellValue(sheetId, `${letter}${rowNum}`, '')
    }
    loadActivities()
  }

  return (
    <div className="vad-docs">
      <div className="vad-docs-label">Documents reçus</div>
      <DocSlot
        label="CNO (Certificat de Non-Opposition)"
        file={cnoFile} uploading={cnoUploading} err={cnoErr}
        dragging={cnoDragging} setDragging={setCnoDragging} fileRef={cnoRef}
        validated={validated}
        onUpload={f => doUpload(f, '__vadCno', ['RECEPTION_CNO'], setCnoUploading, setCnoErr, 'cno', 'CNO')}
        onRemove={() => doRemove('__vadCno', ['RECEPTION_CNO'], cnoFile)}
      />
      <DocSlot
        label="T0"
        file={t0File} uploading={t0Uploading} err={t0Err}
        dragging={t0Dragging} setDragging={setT0Dragging} fileRef={t0Ref}
        validated={validated}
        onUpload={f => doUpload(f, '__vadT0', ['T0_REVENTE', 'T0_AUTO_CONSO'], setT0Uploading, setT0Err, 't0', 'T0')}
        onRemove={() => doRemove('__vadT0', ['T0_REVENTE', 'T0_AUTO_CONSO'], t0File)}
      />
    </div>
  )
}

// ── DP custom content: multi-attempt + file attachment ──────────
function DpAccordionContent({ cells, colMap, rowNum, sheetId, setCellValue, transactionId, validated, nom, loadActivities }) {
  const { userProfile: dpUp } = useAuth()
  const uploaderName = [dpUp?.prenom, dpUp?.nom].filter(Boolean).join(' ') || 'Inconnu'
  const dpDateLetter = colMap['DEMANDE_DP']
  const dpNLetter    = colMap['N_DP']
  const dpDate   = dpDateLetter ? (cells[`${dpDateLetter}${rowNum}`] || '') : ''
  const dpN      = dpNLetter    ? (cells[`${dpNLetter}${rowNum}`]    || '') : ''
  const dpStatut = cells[`__dpStatut:${rowNum}`] || ''

  const dpAttempts = useMemo(() => {
    try { return JSON.parse(cells[`__dpAttempts:${rowNum}`] || '[]') } catch { return [] }
  }, [cells, rowNum])

  const dpPermis = useMemo(() => {
    try { return JSON.parse(cells[`__dpPermis:${rowNum}`] || 'null') } catch { return null }
  }, [cells, rowNum])

  const dpRecepisse = useMemo(() => {
    try { return JSON.parse(cells[`__dpRecepisse:${rowNum}`] || 'null') } catch { return null }
  }, [cells, rowNum])

  const dmyToIso = v => { const p = v.split('/'); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : v }
  const isoToDmy = v => { const p = v.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : v }

  const [localDate,    setLocalDate]    = useState(dmyToIso(dpDate))
  const [localN,       setLocalN]       = useState(dpN)
  const [isDragging,   setIsDragging]   = useState(false)
  const [uploading,    setUploading]    = useState(false)
  const [uploadErr,    setUploadErr]    = useState(null)
  const [isDraggingR,  setIsDraggingR]  = useState(false)
  const [uploadingR,   setUploadingR]   = useState(false)
  const [uploadErrR,   setUploadErrR]   = useState(null)
  const fileRef  = useRef(null)
  const fileRefR = useRef(null)

  useEffect(() => setLocalDate(dmyToIso(dpDate)), [dpDate])
  useEffect(() => setLocalN(dpN), [dpN])

  const commitDate = () => { const s = isoToDmy(localDate); if (s !== dpDate && dpDateLetter) setCellValue(sheetId, `${dpDateLetter}${rowNum}`, s) }
  const commitN    = () => { if (localN !== dpN && dpNLetter)          setCellValue(sheetId, `${dpNLetter}${rowNum}`, localN) }
  const setStatut  = v  => setCellValue(sheetId, `__dpStatut:${rowNum}`, v)

  const handleRefuse = () => {
    const archived = { demande_dp: dpDate, n_dp: dpN }
    setCellValue(sheetId, `__dpAttempts:${rowNum}`, JSON.stringify([...dpAttempts, archived]))
    if (dpDateLetter) setCellValue(sheetId, `${dpDateLetter}${rowNum}`, '')
    if (dpNLetter)    setCellValue(sheetId, `${dpNLetter}${rowNum}`, '')
    setStatut('')
  }

  const uploadFile = async file => {
    if (!file) return
    setUploading(true); setUploadErr(null)
    try {
      const path = `dp/${transactionId}/${Date.now()}_${file.name}`
      const { publicUrl } = await storageUpload('documents', path, file)
      let activityId = null
      try {
        const act = await supabasePost('contact_activities', {
          contact_id: transactionId,
          type: 'document',
          title: 'Permis de construire ajouté',
          body: JSON.stringify({ url: publicUrl, filename: file.name }),
          created_by_name: uploaderName,
        })
        activityId = act?.id ?? null
      } catch {}
      setCellValue(sheetId, `__dpPermis:${rowNum}`, JSON.stringify({ name: file.name, path, url: publicUrl, size: file.size, activityId }))
      loadActivities()
    } catch (e) {
      setUploadErr(`Échec de l'envoi : ${e?.message || e}`)
      console.error(e)
    } finally {
      setUploading(false)
    }
  }

  const removeFile = async () => {
    if (dpPermis?.path) await storageRemove('documents', [dpPermis.path])
    if (dpPermis?.activityId) await supabaseDelete('contact_activities', { id: `eq.${dpPermis.activityId}` })
    setCellValue(sheetId, `__dpPermis:${rowNum}`, '')
    loadActivities()
  }

  const uploadRecepisse = async file => {
    if (!file) return
    setUploadingR(true); setUploadErrR(null)
    try {
      const path = `dp/${transactionId}/${Date.now()}_recepisse_${file.name}`
      const { publicUrl } = await storageUpload('documents', path, file)
      let activityId = null
      try {
        const act = await supabasePost('contact_activities', {
          contact_id: transactionId,
          type: 'document',
          title: 'Récépissé DP ajouté',
          body: JSON.stringify({ url: publicUrl, filename: file.name }),
          created_by_name: uploaderName,
        })
        activityId = act?.id ?? null
      } catch {}
      setCellValue(sheetId, `__dpRecepisse:${rowNum}`, JSON.stringify({ name: file.name, path, url: publicUrl, size: file.size, activityId }))
      loadActivities()
    } catch (e) {
      setUploadErrR(`Échec de l'envoi : ${e?.message || e}`)
    } finally {
      setUploadingR(false)
    }
  }

  const removeRecepisse = async () => {
    if (dpRecepisse?.path) await storageRemove('documents', [dpRecepisse.path])
    if (dpRecepisse?.activityId) await supabaseDelete('contact_activities', { id: `eq.${dpRecepisse.activityId}` })
    setCellValue(sheetId, `__dpRecepisse:${rowNum}`, '')
    loadActivities()
  }

  const tentativeNum   = dpAttempts.length + 1
  const showStatutPills = !validated && dpN.trim()
  const isAccordee     = dpStatut === 'accordee'

  return (
    <div className="dp-content">
      {/* ── Past refused attempts ── */}
      {dpAttempts.length > 0 && (
        <div className="dp-attempts">
          {dpAttempts.map((a, i) => (
            <div key={i} className="dp-attempt">
              <span className="dp-attempt-num">Tentative {i + 1}</span>
              <span className="dp-attempt-refused">Refusée</span>
              <span className="dp-attempt-info">
                {a.demande_dp && a.demande_dp}
                {a.demande_dp && a.n_dp ? ' · ' : ''}
                {a.n_dp && `N° ${a.n_dp}`}
              </span>
            </div>
          ))}
          <div className="dp-attempt-divider">
            <span>Tentative {tentativeNum}</span>
          </div>
        </div>
      )}

      {/* ── Current DP fields ── */}
      <div className="td-acc-field">
        <label className="td-acc-field-label">Date demande DP</label>
        <input
          type="date"
          className={`td-acc-field-input${validated ? ' td-acc-field-input--readonly' : ''}`}
          value={localDate}
          onChange={e => !validated && setLocalDate(e.target.value)}
          onBlur={commitDate}
          readOnly={validated}
        />
      </div>
      <div className="td-acc-field">
        <label className="td-acc-field-label">N° DP</label>
        <input
          className={`td-acc-field-input${validated ? ' td-acc-field-input--readonly' : ''}`}
          value={localN}
          onChange={e => !validated && setLocalN(e.target.value)}
          onBlur={commitN}
          onKeyDown={e => e.key === 'Enter' && (commitN(), e.target.blur())}
          placeholder="—"
          readOnly={validated}
        />
      </div>

      {/* ── Status pills (shown once N° DP is set) ── */}
      {showStatutPills && (
        <div className="td-acc-field">
          <label className="td-acc-field-label">Statut de la DP</label>
          <div className="dp-statut-pills">
            <button
              className={`dp-statut-pill dp-statut-pill--ok${isAccordee ? ' dp-statut-pill--ok-active' : ''}`}
              onClick={() => setStatut(isAccordee ? '' : 'accordee')}
            >
              ✓ Accordée
            </button>
            <button
              className="dp-statut-pill dp-statut-pill--ko"
              onClick={handleRefuse}
            >
              ✗ Refusée — relancer
            </button>
          </div>
        </div>
      )}

      {validated && isAccordee && (
        <div className="dp-accordee-tag">✓ DP accordée</div>
      )}

      {/* ── Permis de construire + Récépissé DP ── */}
      <div className="dp-permis-section">
        <DocSlot
          label="Permis de construire"
          file={dpPermis} uploading={uploading} err={uploadErr}
          dragging={isDragging} setDragging={setIsDragging} fileRef={fileRef}
          validated={validated}
          onUpload={uploadFile}
          onRemove={removeFile}
        />
        <DocSlot
          label="Récépissé DP"
          file={dpRecepisse} uploading={uploadingR} err={uploadErrR}
          dragging={isDraggingR} setDragging={setIsDraggingR} fileRef={fileRefR}
          validated={validated}
          onUpload={uploadRecepisse}
          onRemove={removeRecepisse}
        />
      </div>
    </div>
  )
}

// ── Pose photos: multi-upload ────────────────────────────────────
function PosePhotos({ cells, colMap, rowNum, sheetId, setCellValue, transactionId, validated, loadActivities, nom }) {
  const { userProfile: poseUp } = useAuth()
  const uploaderName = [poseUp?.prenom, poseUp?.nom].filter(Boolean).join(' ') || 'Inconnu'
  const photos = useMemo(() => {
    try { return JSON.parse(cells[`__posePhotos:${rowNum}`] || '[]') } catch { return [] }
  }, [cells, rowNum])

  const attestFile = useMemo(() => {
    try { return JSON.parse(cells[`__poseAttestation:${rowNum}`] || 'null') } catch { return null }
  }, [cells, rowNum])

  const [uploading,     setUploading]     = useState(false)
  const [err,           setErr]           = useState(null)
  const [dragging,      setDragging]      = useState(false)
  const [attestUpl,     setAttestUpl]     = useState(false)
  const [attestErr,     setAttestErr]     = useState(null)
  const [attestDrag,    setAttestDrag]    = useState(false)
  const fileRef   = useRef(null)
  const attestRef = useRef(null)

  const uploadFiles = async fileList => {
    if (!fileList?.length) return
    setUploading(true); setErr(null)
    const next = [...photos]
    try {
      for (const file of Array.from(fileList)) {
        const path = `pose/photos/${transactionId}/${Date.now()}_${file.name}`
        const { publicUrl } = await storageUpload('documents', path, file)
        let activityId = null
        try {
          const act = await supabasePost('contact_activities', {
            contact_id: transactionId,
            type: 'photo',
            title: 'Photo de pose ajoutée',
            body: file.name,
            created_by_name: uploaderName,
          })
          activityId = act?.id ?? null
        } catch {}
        next.push({ name: file.name, path, url: publicUrl, size: file.size, activityId })
      }
      setCellValue(sheetId, `__posePhotos:${rowNum}`, JSON.stringify(next))
      const photosLetter = colMap['PHOTOS']
      if (photosLetter) setCellValue(sheetId, `${photosLetter}${rowNum}`, '✓')
      loadActivities()
    } catch (e) { setErr(`Échec de l'envoi : ${e?.message || e}`); console.error(e) }
    finally { setUploading(false) }
  }

  const removePhoto = async idx => {
    const p = photos[idx]
    if (p?.path) await storageRemove('documents', [p.path])
    if (p?.activityId) await supabaseDelete('contact_activities', { id: `eq.${p.activityId}` })
    const next = photos.filter((_, i) => i !== idx)
    setCellValue(sheetId, `__posePhotos:${rowNum}`, next.length ? JSON.stringify(next) : '')
    const photosLetter = colMap['PHOTOS']
    if (photosLetter) setCellValue(sheetId, `${photosLetter}${rowNum}`, next.length ? '✓' : '')
    loadActivities()
  }

  const uploadAttestation = async file => {
    if (!file) return
    setAttestUpl(true); setAttestErr(null)
    try {
      const path = `pose/attestation/${transactionId}/${Date.now()}_${file.name}`
      const { publicUrl } = await storageUpload('documents', path, file)
      let activityId = null
      try {
        const act = await supabasePost('contact_activities', {
          contact_id: transactionId,
          type: 'document',
          title: 'Attestation assurance ajoutée',
          body: JSON.stringify({ url: publicUrl, filename: file.name }),
          created_by_name: uploaderName,
        })
        activityId = act?.id ?? null
      } catch {}
      setCellValue(sheetId, `__poseAttestation:${rowNum}`, JSON.stringify({ name: file.name, path, url: publicUrl, size: file.size, activityId }))
      const assuranceLetter = colMap['ATTESTATION_ASSURANCE']
      if (assuranceLetter) setCellValue(sheetId, `${assuranceLetter}${rowNum}`, '✓')
      loadActivities()
    } catch (e) { setAttestErr(`Échec de l'envoi : ${e?.message || e}`); console.error(e) }
    finally { setAttestUpl(false) }
  }

  const removeAttestation = async () => {
    if (attestFile?.path) await storageRemove('documents', [attestFile.path])
    if (attestFile?.activityId) await supabaseDelete('contact_activities', { id: `eq.${attestFile.activityId}` })
    setCellValue(sheetId, `__poseAttestation:${rowNum}`, '')
    const assuranceLetter = colMap['ATTESTATION_ASSURANCE']
    if (assuranceLetter) setCellValue(sheetId, `${assuranceLetter}${rowNum}`, '')
    loadActivities()
  }

  const isImage = name => /\.(jpe?g|png|gif|webp|heic)$/i.test(name)

  return (
    <div className="pose-photos">
      <div className="td-acc-field-label">Photos</div>
      {photos.length > 0 && (
        <div className="pose-photos-grid">
          {photos.map((p, i) => (
            <div key={i} className="pose-photo-item">
              {isImage(p.name)
                ? <img src={p.url} alt={p.name} className="pose-photo-thumb" />
                : <FileText size={28} color="#3b82f6" />
              }
              <span className="pose-photo-name">{p.name}</span>
              {!validated && (
                <button className="pose-photo-del" onClick={() => removePhoto(i)} title="Supprimer">×</button>
              )}
            </div>
          ))}
        </div>
      )}
      {!validated && (
        <div
          className={`dp-drop-zone${dragging ? ' dp-drop-zone--over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); uploadFiles(e.dataTransfer.files) }}
          onClick={() => fileRef.current?.click()}
        >
          <input type="file" ref={fileRef} style={{ display: 'none' }}
            onChange={e => uploadFiles(e.target.files)}
            accept="image/*,.pdf"
            multiple
          />
          {uploading
            ? <span className="dp-drop-text">Envoi en cours…</span>
            : <><Paperclip size={14} /><span className="dp-drop-text">Glisser-déposer ou cliquer — plusieurs fichiers acceptés</span></>
          }
        </div>
      )}
      {err && <div className="dp-upload-err">{err}</div>}

      <DocSlot
        label="Attestation assurance"
        file={attestFile} uploading={attestUpl} err={attestErr}
        dragging={attestDrag} setDragging={setAttestDrag} fileRef={attestRef}
        validated={validated}
        onUpload={uploadAttestation}
        onRemove={removeAttestation}
      />
    </div>
  )
}

// ── Nomenclature inside accordion ───────────────────────────────
function NomenclatureAccordionContent({ cells, rowNum, sheetId, setCellValue, nom, validated, onValidateStage }) {
  const nomData = useMemo(() => {
    try { return JSON.parse(cells[`__nomenclature:${rowNum}`] || 'null') } catch { return null }
  }, [cells, rowNum])

  const persist = data => setCellValue(sheetId, `__nomenclature:${rowNum}`, JSON.stringify(data))

  return (
    <NomenclatureView
      key={rowNum}
      initialData={nomData}
      onSave={persist}
      onSubmit={data => { persist(data); if (!validated) onValidateStage() }}
      onCancel={() => {}}
      clientData={{ nom }}
    />
  )
}

// ── Accordion stage (always rendered, animated via CSS grid) ────
function AccordionStage({ stage, isOpen, onToggle, done, cells, colMap, rowNum, sheetId, setCellValue, validated, onValidate, onUnvalidate, extraContent = null, canValidateExtra = true, cancelled = false }) {
  const requiredFields = stage.fields.filter(f => f.required)
  const canValidate = (requiredFields.length === 0 || requiredFields.every(f => {
    const resolvedId = sheetId === 'btob' && f.btobId ? f.btobId : f.id
    const letter = colMap[resolvedId]
    if (!letter) return true
    return !!(cells[`${letter}${rowNum}`] || '').trim()
  })) && canValidateExtra

  return (
    <div className={`td-stage${isOpen ? ' td-stage--open' : ''}${validated ? ' td-stage--validated' : ''}${cancelled ? ' td-stage--cancelled' : ''}`}>
      <button className="td-stage-header" onClick={onToggle}>
        <div className="td-stage-left">
          <span className="td-stage-dot" style={{ background: cancelled ? '#ef4444' : validated ? '#22c55e' : done ? stage.color : '#e2e8f0' }} />
          <span className="td-stage-label" style={{ color: cancelled ? '#ef4444' : validated ? '#15803d' : done ? '#0f172a' : '#64748b' }}>
            {stage.label}
          </span>
          {cancelled ? (
            <span className="td-stage-tag td-stage-tag--cancelled">
              <Ban size={10} />
              Annulé
            </span>
          ) : validated && (
            <span className="td-stage-tag td-stage-tag--validated">
              <CheckCircle2 size={10} />
              Validé
            </span>
          )}
        </div>
        <ChevronDown size={14} className="td-stage-chevron" />
      </button>

      <div className="td-stage-anim">
        <div className="td-stage-body">
          {!stage.hideFields && stage.fields.filter(f => !f.skip).map(field => (
            <AccordionField
              key={field.id}
              colId={field.id}
              btobId={field.btobId}
              label={field.label}
              cells={cells}
              colMap={colMap}
              rowNum={rowNum}
              sheetId={sheetId}
              setCellValue={setCellValue}
              readOnly={validated || cancelled}
              inputType={field.inputType}
              alwaysReadOnly={field.alwaysReadOnly}
            />
          ))}
          {!cancelled && extraContent}
          {!cancelled && (
            <div className="td-stage-actions">
              {validated ? (
                <button className="td-stage-modify-btn" onClick={e => { e.stopPropagation(); onUnvalidate() }}>
                  Modifier
                </button>
              ) : (
                <button
                  className="td-stage-validate-btn"
                  onClick={e => { e.stopPropagation(); onValidate() }}
                  disabled={!canValidate}
                  title={!canValidate ? 'Remplissez tous les champs obligatoires pour valider' : undefined}
                >
                  <CheckCircle2 size={12} />
                  Valider
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Delete modal ─────────────────────────────────────────────────
function DeleteModal({ nom, onConfirm, onCancel, loading }) {
  return (
    <div className="cd-modal-backdrop" onClick={onCancel}>
      <div className="cd-modal" onClick={e => e.stopPropagation()}>
        <div className="cd-modal-header">
          <div className="cd-modal-icon"><AlertTriangle size={20} /></div>
          <div className="cd-modal-head-text">
            <h3 className="cd-modal-title">Supprimer la transaction</h3>
            <p className="cd-modal-subtitle">Cette action est irréversible.</p>
          </div>
          <button className="cd-modal-x" onClick={onCancel}><X size={16} /></button>
        </div>
        <div className="cd-modal-body">
          <p>Vous êtes sur le point de supprimer la transaction de <strong>{nom}</strong> ainsi que toutes les données associées.</p>
        </div>
        <div className="cd-modal-footer">
          <button className="cd-modal-cancel" onClick={onCancel} disabled={loading}>Annuler</button>
          <button className="cd-modal-delete" onClick={onConfirm} disabled={loading}>
            <Trash2 size={13} />
            {loading ? 'Suppression...' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Cancel modal ─────────────────────────────────────────────────
function CancelModal({ nom, onConfirm, onCancel, loading }) {
  return (
    <div className="cd-modal-backdrop" onClick={onCancel}>
      <div className="cd-modal" onClick={e => e.stopPropagation()}>
        <div className="cd-modal-header">
          <div className="cd-modal-icon" style={{ background: '#fef2f2' }}><Ban size={20} color="#ef4444" /></div>
          <div className="cd-modal-head-text">
            <h3 className="cd-modal-title">Annuler le projet</h3>
            <p className="cd-modal-subtitle">Le dossier sera marqué comme annulé.</p>
          </div>
          <button className="cd-modal-x" onClick={onCancel}><X size={16} /></button>
        </div>
        <div className="cd-modal-body">
          <p>Le projet de <strong>{nom}</strong> sera marqué comme annulé. Tous les accordéons passeront en rouge. Cette action peut être réactivée depuis les paramètres si nécessaire.</p>
        </div>
        <div className="cd-modal-footer">
          <button className="cd-modal-cancel" onClick={onCancel} disabled={loading}>Retour</button>
          <button className="cd-modal-delete" style={{ background: '#ef4444' }} onClick={onConfirm} disabled={loading}>
            <Ban size={13} />
            {loading ? 'Annulation...' : 'Confirmer l\'annulation'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Free attachment button (right panel) ─────────────────────────
function FreeAttachmentBtn({ transactionId, onDone, uploaderName }) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  const upload = async file => {
    if (!file) return
    setUploading(true)
    try {
      const path = `attachments/${transactionId}/${Date.now()}_${file.name}`
      const { publicUrl } = await storageUpload('documents', path, file)
      await supabasePost('contact_activities', {
        contact_id: transactionId,
        type: 'document',
        title: file.name,
        body: JSON.stringify({ url: publicUrl, filename: file.name }),
        created_by_name: uploaderName,
      })
      onDone()
    } catch (e) { console.error(e) }
    finally { setUploading(false) }
  }

  const onDrop = e => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  return (
    <>
      <button
        className="td-rp-add-btn"
        title="Ajouter un fichier"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={dragging ? { background: '#eff6ff', borderColor: '#3b82f6', color: '#3b82f6' } : undefined}
      >
        {uploading ? '…' : '+ Ajouter'}
      </button>
      <input ref={fileRef} type="file" style={{ display: 'none' }}
        onChange={e => { upload(e.target.files[0]); e.target.value = '' }} />
    </>
  )
}

// ── Main ────────────────────────────────────────────────────────
export default function TransactionDetail({ transactionId, onBack, backLabel = 'Transactions' }) {
  const [prefix, rowStr] = transactionId.split(':')
  const rowNum  = parseInt(rowStr)
  const sheetId = prefix === 'c' ? 'btoc-comptant' : prefix === 'a' ? 'btoc-abonnement' : 'btob'

  const { sheets, setCellValue, clearContactRow } = useSpreadsheet()
  const { userProfile } = useAuth()
  const isCommercial = userProfile?.role === 'commercial'
  const loggedInName = [userProfile?.prenom, userProfile?.nom].filter(Boolean).join(' ')
  const colMap = useMemo(() => getColumnIdToLetterMap(sheetId), [sheetId])
  const cells  = sheets[sheetId]?.cells || {}
  const get    = id => { const l = colMap[id]; return l ? (cells[`${l}${rowNum}`] || '') : '' }

  const clientColId = sheetId === 'btoc-comptant' ? 'Colonne1' : 'NOM_PRENOM'
  const nom         = get(clientColId)
  const commercial  = get('COMMERCIAL')
  const email       = get('EMAIL')
  const tel         = get('TELEPHONE')
  const ville       = get('VILLE')
  const adresse     = get('ADRESSE_INSTALLATION')
  const codePostal  = get('CODE_POSTAL')
  const signeLE     = get('SIGNE_LE')
  const montantRaw  = sheetId === 'btoc-abonnement' ? get('MONTANT_TTC_VENTE') : get('TOTAL_TTC')
  const montant     = fmtMontant(montantRaw)
  const typeLabel   = sheetId === 'btob' ? 'BtoB' : sheetId === 'btoc-comptant' ? 'Comptant' : 'Abonnement'
  const typeKey     = sheetId === 'btob' ? 'btob' : sheetId === 'btoc-comptant' ? 'comptant' : 'abonnement'
  const TYPE_COLORS = { comptant: '#22c55e', abonnement: '#3b82f6', btob: '#8b5cf6' }
  const typeColor   = TYPE_COLORS[typeKey] || '#64748b'

  const [vtFormData, setVtFormData] = useState(() => {
    try { const r = cells[`__vtFormData:${rowNum}`]; return r ? JSON.parse(r) : null } catch { return null }
  })

  const [technicians, setTechnicians] = useState([])
  useEffect(() => {
    supabaseGet('profiles', { role: 'eq.technique', select: 'id,prenom,nom,identifiant' })
      .then(data => setTechnicians(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const [contactType, setContactType] = useState('')
  useEffect(() => {
    supabaseGet('contact_metadata', { contact_id: `eq.${transactionId}`, select: 'contact_type' })
      .then(data => setContactType(data?.[0]?.contact_type || ''))
      .catch(() => {})
  }, [transactionId])

  const handleContactTypeChange = async value => {
    setContactType(value)
    await supabaseUpsert('contact_metadata', { contact_id: transactionId, contact_type: value, updated_at: new Date().toISOString() }, 'contact_id')
  }

  const validatedMap = useMemo(() => {
    try { return JSON.parse(cells[`__validated:${rowNum}`] || '{}') } catch { return {} }
  }, [cells, rowNum])

  const handleValidate = stageKey => {
    const next = { ...validatedMap, [stageKey]: true }
    setCellValue(sheetId, `__validated:${rowNum}`, JSON.stringify(next))

    if (stageKey === 'vt') {
      const chargesAffaires = [userProfile?.prenom, userProfile?.nom].filter(Boolean).join(' ')
      if (chargesAffaires) {
        const caLetter = colMap['CHARGES_AFFAIRES']
        const caCellKey = caLetter ? `${caLetter}${rowNum}` : null
        if (caCellKey) setCellValue(sheetId, caCellKey, chargesAffaires)
        if (vtFormData) {
          const updated = { ...vtFormData, technicien_vt: chargesAffaires }
          setCellValue(sheetId, `__vtFormData:${rowNum}`, JSON.stringify(updated))
          setVtFormData(updated)
        }
      }
      // Email aux administratifs pour lancer la DP
      sendVTValidatedEmail()
    }
  }

  const sendVTValidatedEmail = async () => {
    const appUrl = import.meta.env.VITE_APP_URL || 'https://app.free-energy.re'
    const clientName = nom || '—'
    const techName   = [userProfile?.prenom, userProfile?.nom].filter(Boolean).join(' ') || '—'
    const adresseComplete = [adresse, codePostal, ville].filter(Boolean).join(', ') || '—'

    // Récupérer tous les profils administratifs
    let adminEmails = []
    try {
      const admins = await supabaseGet('profiles', {
        role: 'in.(administratif,administrateur)',
        select: 'identifiant',
      })
      adminEmails = (admins || []).map(a => a.identifiant).filter(Boolean)
    } catch {}
    if (!adminEmails.length) return

    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0f172a;padding:24px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Free Energy</p>
            <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Visite technique validée</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#1e293b;">Bonjour,</p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
              La visite technique du dossier de <strong style="color:#0f172a;">${clientName}</strong> a été réalisée
              par <strong>${techName}</strong>. Les informations ont été renseignées sur la plateforme.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:6px;padding:14px 16px;">
                  <p style="margin:0;font-size:14px;font-weight:700;color:#1d4ed8;">📋 Action requise — Lancer la DP</p>
                  <p style="margin:8px 0 0;font-size:13.5px;color:#1e3a8a;line-height:1.7;">
                    Merci de lancer la déclaration préalable pour ce dossier et de renseigner dans l'application :<br>
                    &bull; <strong>La date de demande de DP</strong><br>
                    &bull; <strong>Le numéro de DP</strong><br>
                    &bull; <strong>Le permis de construire</strong> (si applicable)
                  </p>
                </td>
              </tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#f97316;border-radius:8px;">
                  <a href="${appUrl}" target="_blank" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;">
                    Accéder au dossier →
                  </a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;overflow:hidden;">
              <tr><td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Informations du dossier</p>
              </td></tr>
              <tr><td style="padding:14px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding:3px 0;font-size:13px;color:#64748b;width:160px;">Client</td><td style="padding:3px 0;font-size:13px;color:#1e293b;font-weight:600;">${clientName}</td></tr>
                  <tr><td style="padding:3px 0;font-size:13px;color:#64748b;">Commercial</td><td style="padding:3px 0;font-size:13px;color:#1e293b;">${commercial || '—'}</td></tr>
                  <tr><td style="padding:3px 0;font-size:13px;color:#64748b;">Adresse</td><td style="padding:3px 0;font-size:13px;color:#1e293b;">${adresseComplete}</td></tr>
                  <tr><td style="padding:3px 0;font-size:13px;color:#64748b;">Technicien VT</td><td style="padding:3px 0;font-size:13px;color:#1e293b;">${techName}</td></tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Notification automatique — Application Free Energy. Ne pas répondre.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    try {
      await supabaseInvoke('send-email', {
        to: adminEmails,
        subject: `VT validée — Lancer la DP pour ${clientName}`,
        html,
      })
    } catch (e) {
      console.warn('VT validated email failed:', e)
    }
  }

  const handleUnvalidate = stageKey => {
    const next = { ...validatedMap, [stageKey]: false }
    setCellValue(sheetId, `__validated:${rowNum}`, JSON.stringify(next))
  }

  const initials = nom ? nom.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'

  const cancelled = useMemo(() => {
    try { return JSON.parse(cells[`__cancelled:${rowNum}`] || 'null') } catch { return null }
  }, [cells, rowNum])

  const [openStage,        setOpenStage]        = useState(() => firstIncompleteStage(cells, colMap, rowNum, sheetId))
  const [showVtModal,      setShowVtModal]      = useState(false)
  const [activities,       setActivities]       = useState([])
  const [actMenuOpen,      setActMenuOpen]      = useState(false)
  const [showDeleteModal,  setShowDeleteModal]  = useState(false)
  const [showCancelModal,  setShowCancelModal]  = useState(false)
  const [deleting,         setDeleting]         = useState(false)
  const [cancelling,       setCancelling]       = useState(false)
  const [deleted,          setDeleted]          = useState(false)
  const actMenuRef = useRef(null)

  const loadActivities = () =>
    supabaseGet('contact_activities', {
      contact_id: `eq.${transactionId}`, order: 'created_at.desc', select: '*',
    }).then(data => setActivities(Array.isArray(data) ? data : []))

  useEffect(() => { loadActivities() }, [transactionId])

  // Auto-validate 'termine' when every other stage is validated
  useEffect(() => {
    if (validatedMap['termine']) return
    const allOthersDone = STAGES.filter(s => s.key !== 'termine').every(s => !!validatedMap[s.key])
    if (allOthersDone) handleValidate('termine')
  }, [validatedMap])

  // Auto-set ECHEANCE = DATE_DDE_VT + 7 whenever DATE_DDE_VT changes
  const vtDateLetter = colMap['DATE_DDE_VT']
  const vtDateVal = vtDateLetter ? (cells[`${vtDateLetter}${rowNum}`] || '') : ''
  const prevVtDate = useRef(null)
  useEffect(() => {
    if (vtDateVal === prevVtDate.current) return
    prevVtDate.current = vtDateVal
    if (!vtDateVal) return
    const echeanceLetter = colMap['ECHEANCE']
    if (!echeanceLetter) return
    setCellValue(sheetId, `${echeanceLetter}${rowNum}`, addDaysToFR(vtDateVal, 7))
  }, [vtDateVal])

  // Sync DATE_PREV_VT + DATE_RETOUR_VT vers vt_requests pour le rappel retour VT
  const prevVtLetter    = colMap['DATE_PREV_VT']
  const retourVtLetter  = colMap['DATE_RETOUR_VT']
  const prevVtVal   = prevVtLetter   ? (cells[`${prevVtLetter}${rowNum}`]   || '') : ''
  const retourVtVal = retourVtLetter ? (cells[`${retourVtLetter}${rowNum}`] || '') : ''

  const frToISO = str => {
    const p = str.split('/'); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : null
  }

  const prevPrevVt   = useRef(null)
  const prevRetourVt = useRef(null)

  useEffect(() => {
    if (prevVtVal === prevPrevVt.current) return
    prevPrevVt.current = prevVtVal
    supabaseGet('vt_requests', { contact_id: `eq.${transactionId}`, select: 'id' })
      .then(rows => {
        if (!rows?.[0]?.id) return
        supabaseUpsert('vt_requests', {
          id: rows[0].id,
          date_prev_vt: prevVtVal ? frToISO(prevVtVal) : null,
        }, 'id').catch(() => {})
      }).catch(() => {})
  }, [prevVtVal])

  useEffect(() => {
    if (retourVtVal === prevRetourVt.current) return
    prevRetourVt.current = retourVtVal
    supabaseGet('vt_requests', { contact_id: `eq.${transactionId}`, select: 'id' })
      .then(rows => {
        if (!rows?.[0]?.id) return
        supabaseUpsert('vt_requests', {
          id: rows[0].id,
          date_retour_vt: retourVtVal ? frToISO(retourVtVal) : null,
        }, 'id').catch(() => {})
      }).catch(() => {})
  }, [retourVtVal])

  // Auto-validate 'demande_vt' when DATE_DDE_VT is set
  useEffect(() => {
    if (validatedMap['demande_vt']) return
    if (stageCompleted('demande_vt', cells, colMap, rowNum, sheetId)) {
      handleValidate('demande_vt')
    }
  }, [cells, validatedMap])

  // Auto-write ETAT_DOSSIER = current stage label (or "Annulé")
  // Ne pas écrire si la ligne est vide (contact supprimé)
  const computedEtat = cancelled ? 'Annulé' : (STAGES.find(s => s.key === firstIncompleteStage(cells, colMap, rowNum, sheetId))?.label ?? '')
  useEffect(() => {
    const letter = colMap['ETAT_DOSSIER']
    if (!letter) return
    // Vérifier que la ligne a encore des données (commercial présent)
    const commercialLetter = colMap['COMMERCIAL']
    if (commercialLetter && !cells[`${commercialLetter}${rowNum}`]) return
    const key = `${letter}${rowNum}`
    if ((cells[key] || '') !== computedEtat) setCellValue(sheetId, key, computedEtat)
  }, [computedEtat])


  const pdfActivities = activities.filter(a => a.type === 'pdf' || a.type === 'fiche-vt' || a.type === 'document')

  const [toast, setToast] = useState(null)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    const h = e => { if (actMenuRef.current && !actMenuRef.current.contains(e.target)) setActMenuOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleDelete = async () => {
    setDeleting(true)
    clearContactRow(sheetId, rowNum)
    await Promise.allSettled([
      supabaseDelete('contact_activities', { contact_id: `eq.${transactionId}` }),
      supabaseDelete('contact_task_lists',  { contact_id: `eq.${transactionId}` }),
      supabaseDelete('contact_metadata',    { contact_id: `eq.${transactionId}` }),
    ])
    setDeleting(false)
    setDeleted(true)
    setTimeout(() => onBack(), 2000)
  }

  const handleCancelProject = async () => {
    setCancelling(true)
    const today = todayReunion()
    const loggedInName = [userProfile?.prenom, userProfile?.nom].filter(Boolean).join(' ') || 'Inconnu'
    const cancelData = { date: today, by: loggedInName }
    setCellValue(sheetId, `__cancelled:${rowNum}`, JSON.stringify(cancelData))
    try {
      await supabasePost('contact_activities', {
        contact_id: transactionId,
        type: 'cancelled',
        title: `Projet annulé — ${nom}`,
        body: `Annulé le ${today} par ${loggedInName}`,
        created_by_name: loggedInName,
      })
      loadActivities()
    } catch {}
    setCancelling(false)
    setShowCancelModal(false)
  }

  const sendCAAssignmentEmail = async (caFullName, caEmail) => {
    if (!caEmail) return
    const appUrl = import.meta.env.VITE_APP_URL || 'https://app.free-energy.re'
    const clientName = nom || '—'
    const adresseComplete = [adresse, codePostal, ville].filter(Boolean).join(', ') || '—'
    const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#0f172a;padding:24px 32px;">
            <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;">Free Energy</p>
            <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">Attribution de dossier</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:15px;color:#1e293b;">Bonjour ${caFullName},</p>
            <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
              Le dossier de <strong style="color:#0f172a;">${clientName}</strong> vous a été attribué en tant que chargé d'affaires.
              Merci de prendre contact avec ce client rapidement pour planifier la visite technique.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td style="background:#eff6ff;border-left:4px solid #3b82f6;border-radius:6px;padding:14px 16px;">
                  <p style="margin:0;font-size:14px;font-weight:700;color:#1d4ed8;">📅 Action requise</p>
                  <p style="margin:6px 0 0;font-size:13.5px;color:#1e3a8a;line-height:1.6;">
                    Prenez rendez-vous avec le client et renseignez la <strong>date prévisionnelle de la visite technique</strong>
                    dans l'application pour assurer le bon déroulement du dossier.
                  </p>
                </td>
              </tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
              <tr>
                <td style="background:#f97316;border-radius:8px;">
                  <a href="${appUrl}" target="_blank" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;">
                    Accéder au dossier →
                  </a>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;overflow:hidden;">
              <tr><td style="padding:12px 20px;border-bottom:1px solid #e2e8f0;">
                <p style="margin:0;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;">Informations du dossier</p>
              </td></tr>
              <tr><td style="padding:14px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="padding:3px 0;font-size:13px;color:#64748b;width:140px;">Client</td><td style="padding:3px 0;font-size:13px;color:#1e293b;font-weight:600;">${clientName}</td></tr>
                  <tr><td style="padding:3px 0;font-size:13px;color:#64748b;">Commercial</td><td style="padding:3px 0;font-size:13px;color:#1e293b;">${commercial || '—'}</td></tr>
                  <tr><td style="padding:3px 0;font-size:13px;color:#64748b;">Adresse</td><td style="padding:3px 0;font-size:13px;color:#1e293b;">${adresseComplete}</td></tr>
                  <tr><td style="padding:3px 0;font-size:13px;color:#64748b;">Téléphone</td><td style="padding:3px 0;font-size:13px;color:#1e293b;">${tel || '—'}</td></tr>
                </table>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
            <p style="margin:0;font-size:12px;color:#94a3b8;">Email automatique — Application Free Energy. Ne pas répondre.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    try {
      await supabaseInvoke('send-email', {
        to: [caEmail],
        subject: `Dossier attribué — ${clientName}`,
        html,
      })
    } catch (e) {
      console.warn('CA assignment email failed:', e)
    }
  }

  const handleVtSave = async data => {
    const saveDate = todayReunion()
    const full     = { ...data, clientName: nom }
    const filename   = `Fiche_VT_${(nom || 'client').replace(/\s+/g, '_')}.pdf`
    const actTitle   = `Fiche VT — ${nom}`

    // Persist form data in the sheet cell (auto-saved to Supabase via SpreadsheetContext)
    setCellValue(sheetId, `__vtFormData:${rowNum}`, JSON.stringify(full))
    setVtFormData(full)

    // Auto-set DATE_RETOUR_VT to today (Réunion time)
    const drLetter = colMap['DATE_RETOUR_VT']
    if (drLetter) setCellValue(sheetId, `${drLetter}${rowNum}`, saveDate)

    setShowVtModal(false)
    setToast('Fiche VT sauvegardée')

    // Upsert the pièce jointe: delete any existing VT activity (both types) then re-insert
    try {
      await supabaseDelete('contact_activities', {
        contact_id: `eq.${transactionId}`,
        type:       'eq.fiche-vt',
      })
      await supabaseDelete('contact_activities', {
        contact_id: `eq.${transactionId}`,
        type:       'eq.pdf',
      })
      await supabasePost('contact_activities', {
        contact_id: transactionId,
        type:       'fiche-vt',
        title:      'Fiche VT remplie',
        body:       `PDF généré pour ${nom}`,
      })
      loadActivities()
    } catch (e) {
      console.error('handleVtSave activity error', e)
    }
  }

  return (
    <div className="td-root">
      {showVtModal && (
        <PdfFormViewer
          initialData={(() => {
            const today = todayReunion()
            const base  = vtFormData ?? { adresse, codePostal, commune: ville, email, tel, commercial, clientName: nom }
            // Flat map (after PDF save)
            if ('type_comptant' in base || 'technicien_vt' in base || 'nom_interlocuteur' in base) {
              return {
                ...base,
                ...(loggedInName && !(base.technicien_vt || '').trim() ? { technicien_vt: loggedInName } : {}),
                ...(!( base.Date_2 || '').trim() ? { Date_2: today } : {}),
              }
            }
            // Structured map (from VTRequestModal or null fallback)
            return {
              ...base,
              ...(loggedInName && !(base.chargesAffaires || '').trim() ? { chargesAffaires: loggedInName } : {}),
              ...(!( base.dateRetour || '').trim() ? { dateRetour: today } : {}),
            }
          })()}
          nom={nom}
          onClose={() => setShowVtModal(false)}
          onSave={handleVtSave}
        />
      )}

      {showDeleteModal && (
        <DeleteModal
          nom={nom}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          loading={deleting}
        />
      )}

      {showCancelModal && (
        <CancelModal
          nom={nom}
          onConfirm={handleCancelProject}
          onCancel={() => setShowCancelModal(false)}
          loading={cancelling}
        />
      )}

      {deleted && (
        <div className="cd-toast cd-toast--success">
          <CheckCircle2 size={15} />
          Transaction supprimée avec succès
        </div>
      )}

      {toast && <div className="td-toast">{toast}</div>}

      <div className="td-breadcrumb">
        <button className="td-back-btn" onClick={onBack}>
          <ArrowLeft size={13} />
          {backLabel}
        </button>
        <div className="cd-actions-wrap" ref={actMenuRef}>
          <button className="cd-actions-btn" onClick={() => setActMenuOpen(p => !p)}>
            Actions <ChevronDown size={11} />
          </button>
          {actMenuOpen && (
            <div className="cd-actions-menu">
              {!cancelled && (
                <button
                  className="cd-actions-menu-item cd-actions-menu-item--cancel"
                  onClick={() => { setActMenuOpen(false); setShowCancelModal(true) }}
                >
                  <Ban size={13} />
                  Annuler le projet
                </button>
              )}
              <button
                className="cd-actions-menu-item cd-actions-menu-item--danger"
                onClick={() => { setActMenuOpen(false); setShowDeleteModal(true) }}
              >
                <Trash2 size={13} />
                Supprimer la transaction
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="td-body">
        {/* ── Left ── */}
        <aside className="td-left">
          <div className="td-tx-card">
            <div className="td-avatar">{initials}</div>
            <div className="td-tx-info">
              <div className="td-tx-name">{nom || '—'}</div>
              <div className="td-tx-badges">
                <span className="td-badge" style={{ background: typeColor + '22', color: typeColor }}>
                  {typeLabel}
                </span>
              </div>
              {montant && <div className="td-tx-amount">{montant}</div>}
              {commercial && <div className="td-tx-commercial">Suivi par {commercial}</div>}
              <div className="td-ca-row">
                <span className="td-ca-label">Chargé d'affaires</span>
                <select
                  className="td-ca-select"
                  value={get('CHARGES_AFFAIRES')}
                  onChange={e => {
                    const caLetter = colMap['CHARGES_AFFAIRES']
                    if (caLetter) setCellValue(sheetId, `${caLetter}${rowNum}`, e.target.value)
                    // Sync vers vt_requests + envoi email au CA
                    if (e.target.value) {
                      const selected = technicians.find(t => [t.prenom, t.nom].filter(Boolean).join(' ') === e.target.value)
                      // Email au chargé d'affaires
                      if (selected?.identifiant) {
                        sendCAAssignmentEmail(e.target.value, selected.identifiant)
                      }
                      // Mise à jour vt_requests
                      supabaseGet('vt_requests', { contact_id: `eq.${transactionId}`, select: 'id' })
                        .then(rows => {
                          if (rows?.[0]?.id) {
                            supabaseUpsert('vt_requests', {
                              id: rows[0].id,
                              charges_affaires: e.target.value,
                              ca_email: selected?.identifiant || null,
                              status: 'assigned',
                            }, 'id').catch(() => {})
                          }
                        }).catch(() => {})
                    }
                  }}
                >
                  <option value="">— Sélectionner —</option>
                  {technicians.map(t => {
                    const fullName = [t.prenom, t.nom].filter(Boolean).join(' ')
                    return <option key={t.id} value={fullName}>{fullName}</option>
                  })}
                </select>
              </div>
              <div className="td-ca-row">
                <span className="td-ca-label">Type de contact</span>
                <select
                  className="td-ca-select"
                  value={contactType}
                  onChange={e => handleContactTypeChange(e.target.value)}
                >
                  <option value="">— Sélectionner —</option>
                  {CONTACT_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="td-info-section">
            <div className="td-info-header">Informations clés</div>
            {[
              { label: 'Commercial',  value: commercial },
              { label: 'Adresse',     value: adresse    },
              { label: 'Code postal', value: codePostal },
              { label: 'Ville',       value: ville      },
              { label: 'Téléphone',   value: tel        },
              { label: 'E-mail',      value: email      },
              { label: 'Signé le',    value: signeLE    },
            ].map(({ label, value }) => (
              <div key={label} className="td-info-row">
                <div className="td-info-label">{label}</div>
                <div className={`td-info-value${!value ? ' td-info-empty' : ''}`}>{value || '—'}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Middle ── */}
        <main className="td-middle">
          <div className="td-middle-header">
            <span className="td-middle-title">Suivi de dossier</span>
            <span className="td-middle-hint">Sauvegardé automatiquement</span>
          </div>

          {/* VT PDF banner — technical view only */}
          {!isCommercial && (
            <div className="td-vt-banner">
              <div className="td-vt-banner-left">
                <div className="td-vt-banner-icon">
                  <FileText size={15} color="#f59e0b" />
                </div>
                <div>
                  <div className="td-vt-banner-title">Fiche VT</div>
                  <div className="td-vt-banner-sub">
                    {vtFormData ? 'Formulaire rempli · cliquer pour modifier' : 'Formulaire non rempli'}
                  </div>
                </div>
              </div>
              <button className="td-vt-banner-btn" onClick={() => setShowVtModal(true)}>
                {vtFormData ? 'Modifier' : 'Remplir le PDF'}
              </button>
            </div>
          )}

          {/* View: commercial → tracking timeline, technical → accordion */}
          {isCommercial ? (
            <TrackingView cells={cells} colMap={colMap} rowNum={rowNum} sheetId={sheetId} />
          ) : (
            <div className="td-accordion">
              {STAGES.map(stage => (
                <AccordionStage
                  key={stage.key}
                  stage={stage}
                  isOpen={openStage === stage.key}
                  onToggle={() => setOpenStage(prev => prev === stage.key ? null : stage.key)}
                  done={stageCompleted(stage.key, cells, colMap, rowNum, sheetId)}
                  cells={cells}
                  colMap={colMap}
                  rowNum={rowNum}
                  sheetId={sheetId}
                  setCellValue={setCellValue}
                  validated={!!validatedMap[stage.key]}
                  onValidate={() => handleValidate(stage.key)}
                  onUnvalidate={() => handleUnvalidate(stage.key)}
                  cancelled={!!cancelled}
                  extraContent={
                    stage.key === 'nomenclature' ? (
                      <NomenclatureAccordionContent
                        cells={cells} rowNum={rowNum}
                        sheetId={sheetId} setCellValue={setCellValue}
                        nom={nom} validated={!!validatedMap['nomenclature']}
                        onValidateStage={() => handleValidate('nomenclature')}
                      />
                    ) : stage.key === 'dp' ? (
                      <DpAccordionContent
                        cells={cells} colMap={colMap} rowNum={rowNum}
                        sheetId={sheetId} setCellValue={setCellValue}
                        transactionId={transactionId} validated={!!validatedMap['dp']}
                        nom={nom} loadActivities={loadActivities}
                      />
                    ) : stage.key === 'pose' ? (
                      <PosePhotos
                        cells={cells} colMap={colMap} rowNum={rowNum}
                        sheetId={sheetId} setCellValue={setCellValue}
                        transactionId={transactionId} validated={!!validatedMap['pose']}
                        loadActivities={loadActivities} nom={nom}
                      />
                    ) : stage.key === 'vad' ? (
                      <VadDocuments
                        cells={cells} colMap={colMap} rowNum={rowNum}
                        sheetId={sheetId} setCellValue={setCellValue}
                        transactionId={transactionId} validated={!!validatedMap['vad']}
                        nom={nom} loadActivities={loadActivities}
                      />
                    ) : null
                  }
                  canValidateExtra={
                    stage.key === 'nomenclature'
                      ? !!(cells[`__nomenclature:${rowNum}`])
                      : stage.key === 'dp'
                      ? cells[`__dpStatut:${rowNum}`] === 'accordee'
                      : true
                  }
                />
              ))}
            </div>
          )}
        </main>

        {/* ── Right ── */}
        <aside className="td-right">
          <div className="td-rp-section">
            <div className="td-rp-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span className="td-rp-title">
                <Paperclip size={13} />
                Pièces jointes
                {pdfActivities.length > 0 && <span className="td-rp-count">({pdfActivities.length})</span>}
              </span>
              <FreeAttachmentBtn transactionId={transactionId} onDone={loadActivities} uploaderName={loggedInName} />
            </div>
            {pdfActivities.length === 0 ? (
              <div className="td-rp-empty">
                <Paperclip size={18} color="#cbd5e1" />
                <p>Aucun fichier joint.</p>
              </div>
            ) : (
              <div className="td-rp-body">
                {pdfActivities.map(act => {
                  const parseBody = b => typeof b === 'object' && b !== null ? b : (() => { try { return JSON.parse(b) } catch { return null } })()
                  const deleteAct = async id => {
                    await supabaseDelete('contact_activities', { id: `eq.${id}` })
                    loadActivities()
                  }

                  if (act.type === 'document') {
                    const body = parseBody(act.body)
                    const url  = body?.url || null
                    const name = body?.filename || act.title
                    const Tag  = url ? 'a' : 'div'
                    const linkProps = url ? { href: url, target: '_blank', rel: 'noreferrer' } : {}
                    return (
                      <Tag key={act.id} className={`td-rp-attachment${url ? ' td-rp-attachment--link' : ''}`} {...linkProps}>
                        <FileText size={13} color="#3b82f6" style={{ flexShrink: 0 }} />
                        <span className="td-rp-attachment-name">{name}</span>
                        <button
                          className="td-rp-delete-btn"
                          title="Supprimer"
                          onClick={e => { e.preventDefault(); e.stopPropagation(); deleteAct(act.id) }}
                        >
                          <X size={11} />
                        </button>
                      </Tag>
                    )
                  }
                  // fiche-vt / pdf
                  const bodyParsed = parseBody(act.body)
                  let filename = bodyParsed?.filename || act.title
                  const d = vtFormData
                  const client     = d?.clientName || d?.nom_interlocuteur || nom || ''
                  const date       = d?.date_de_la_demande || ''
                  const technicien = d?.technicien_vt || ''
                  const sentence   = client
                    ? `Fiche VT de ${client}${date ? ` le ${date}` : ''}${technicien ? ` par ${technicien}` : ''}`
                    : filename
                  return (
                    <div key={act.id} className="td-rp-attachment td-rp-attachment--link"
                      style={{ cursor: vtFormData ? 'pointer' : 'default' }}
                      onClick={() => vtFormData && downloadVTPdfAuto(vtFormData, filename)}
                    >
                      <FileText size={13} color="#f59e0b" style={{ flexShrink: 0 }} />
                      <span className="td-rp-attachment-name">{sentence}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* ── Photos ── */}
          {(() => {
            const photoActs = activities.filter(a => a.type === 'photo')
            if (photoActs.length === 0) return null
            return (
              <div className="td-rp-section">
                <div className="td-rp-header">
                  <span className="td-rp-title">Photos ({photoActs.length})</span>
                </div>
                <div className="td-rp-photos-grid">
                  {photoActs.map(act => {
                    let body = null
                    try { body = JSON.parse(act.body) } catch {}
                    const isImg = /\.(jpe?g|png|gif|webp|heic)$/i.test(act.title)
                    return (
                      <a key={act.id} href={body?.url} target="_blank" rel="noreferrer"
                        className="td-rp-photo-thumb" title={act.title}>
                        {isImg
                          ? <img src={body?.url} alt={act.title} />
                          : <FileText size={20} color="#3b82f6" />
                        }
                      </a>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </aside>
      </div>
    </div>
  )
}
