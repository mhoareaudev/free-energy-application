import { useState, useEffect, useRef } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { X, Save, FileText } from 'lucide-react'
import templateUrl from '../assets/formulaire_vt.pdf'
import { PVLEASE_OFFER_KWC } from '../data/sheetsConfig'
import './PdfFormViewer.css'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

const DESKTOP_SCALE = 1.5
// Native A4 PDF width in points — used to compute mobile scale
const PDF_NATIVE_WIDTH = 595

const normName = name => (name || '').split('.').pop() || name
const isOn = v => !!v && v !== 'Off' && v !== '/Off' && v !== false

// ── Convert vtFormData / basic contact info → flat PDF field map ─
// Also accepts a flat map directly (no-op conversion).
function toFlatFields(data) {
  if (!data || !Object.keys(data).some(k => data[k])) return {}
  // Detect: already a flat PDF field map (keys are PDF field names)
  if ('commercial_vt' in data || 'nom_interlocuteur' in data || 'type_comptant' in data) {
    return data
  }
  // Convert structured vtFormData or basic contact info → flat map
  return vtToPdfFields(data)
}

// ── Convert structured vtFormData → flat PDF field map ──────────
function vtToPdfFields(data) {
  if (!data) return {}
  const txt = v => String(v || '')
  const chk = cond => (cond ? 'Yes' : 'Off')
  const toiture    = data.type_toiture    || []
  const couverture = data.type_couverture || []
  const charpente  = data.type_charpente  || []
  return {
    commercial_vt:       txt(data.commercial),
    date_de_la_demande:  txt(data.date),
    technicien_vt:       txt(data.chargesAffaires),
    type_comptant:       chk(data.typeContrat === 'comptant'),
    type_abonnement:     chk(data.typeContrat === 'abonnement'),
    oui_maintenance:     chk(data.contratMaintenance === 'oui'),
    non_maintenance:     chk(data.contratMaintenance === 'non'),
    'puissance_souhaitée': txt(data.typeContrat === 'abonnement' ? (PVLEASE_OFFER_KWC[data.puissance] || data.puissance) : data.puissance),
    stockage_text:       txt(data.batterie),
    adresse_pose:        txt(data.adresse),
    code_postal:         txt(data.codePostal),
    Commune:             txt(data.commune),
    nom_interlocuteur:   txt(data.clientName),
    mail_interlocuteur:  txt(data.email),
    tel_interlocuteur:   txt(data.tel),
    oui_revente:         chk(data.reventeSurplus === 'oui'),
    non_revente:         chk(data.reventeSurplus === 'non'),
    prise_securisee_text: txt(data.prise_securisee_text),
    mono_pente:          chk(toiture.includes('mono_pente')),
    bi_pente:            chk(toiture.includes('bi_pente')),
    autre_toiture:       chk(toiture.includes('autre')),
    autre_toiture_texte: txt(data.autre_toiture_texte),
    oui_accessible:      chk(data.accessibilite === 'oui'),
    non_accessible:      chk(data.accessibilite === 'non'),
    tole_ondulee:        chk(couverture.includes('tole_ondulee')),
    couverture_nervuree: chk(couverture.includes('nervuree')),
    autre_couverture:    chk(couverture.includes('autre')),
    autre_couverture_texte: txt(data.autre_couverture_texte),
    bon_etat_couverture:   chk(data.etat_couverture === 'bon'),
    moyen_etat_couverture: chk(data.etat_couverture === 'moyen'),
    age_etat_couverture:   chk(data.etat_couverture === 'age'),
    age_couverture_texte:  txt(data.age_couverture_texte),
    bon_etat_vis:    chk(data.etat_vis === 'bon'),
    moyen_etat_vis:  chk(data.etat_vis === 'moyen'),
    age_etat_vis:    chk(data.etat_vis === 'age'),
    age_vis_texte:   txt(data.age_vis_texte),
    type_de_vis:     txt(data.type_de_vis),
    charpente_metallique:  chk(charpente.includes('metallique')),
    charpente_bois:        chk(charpente.includes('bois')),
    autre_charpente:       chk(charpente.includes('autre')),
    autre_charpente_texte: txt(data.autre_charpente_texte),
    bon_etat_charpente:   chk(data.etat_charpente === 'bon'),
    moyen_etat_charpente: chk(data.etat_charpente === 'moyen'),
    age_etat_charpente:   chk(data.etat_charpente === 'age'),
    age_etat_charpente_texte: txt(data.age_etat_charpente_texte),
    entraxe_de_pannes:    txt(data.entraxe_de_pannes),
    oui_ombre:  chk(data.zone_ombre === 'oui'),
    non_ombre:  chk(data.zone_ombre === 'non'),
    compteur_limite_propriete:      chk(data.compteur === 'limite_propriete'),
    compteur_interieur_batiment:    chk(data.compteur === 'interieur_batiment'),
    disjoncteur_limite_propriete:   chk(data.disjoncteur === 'limite_propriete'),
    disjoncteur_interieur_batiment: chk(data.disjoncteur === 'interieur_batiment'),
    edf_aerienne:        chk(data.arrivee_edf === 'aerienne'),
    edf_souterrain:      chk(data.arrivee_edf === 'souterrain'),
    edf_aero_souterrain: chk(data.arrivee_edf === 'aero_souterrain'),
    cheminement_retenu:  chk(!!data.cheminement_retenu),
    commentaires_inclinaison:        txt(data.commentaires_inclinaison),
    commentaires_orientation:        txt(data.commentaires_orientation),
    commentaires_latitude:           txt(data.commentaires_latitude),
    commentaires_longitude:          txt(data.commentaires_longitude),
    commentaires_connexion_internet: txt(data.commentaires_connexion_internet),
    commentaires_technique:          txt(data.commentaires_technique),
    Productible:                     txt(data.productible),
    'Production avec centrale à lannée': txt(data.production_annuelle),
    Date_2: txt(data.dateRetour),
  }
}

// ── Single page: canvas + uncontrolled HTML overlay ─────────────
function PdfPage({ page, scale, initFieldValues, refsMap }) {
  const canvasRef = useRef(null)
  const [anns,  setAnns]  = useState([])
  const [ready, setReady] = useState(false)

  const viewport = page.getViewport({ scale })

  useEffect(() => {
    const vp  = page.getViewport({ scale })
    const cvs = canvasRef.current
    if (!cvs) return
    cvs.width  = vp.width
    cvs.height = vp.height
    const task = page.render({ canvasContext: cvs.getContext('2d'), viewport: vp })
    task.promise.then(() => setReady(true)).catch(() => setReady(true))
    page.getAnnotations().then(list => setAnns(list.filter(a => a.subtype === 'Widget')))
    return () => task.cancel?.()
  }, [page])

  return (
    <div className="pdfv-page" style={{ width: viewport.width, height: viewport.height }}>
      <canvas ref={canvasRef} className="pdfv-canvas" />

      {ready && anns.map(ann => {
        const vr   = viewport.convertToViewportRectangle(ann.rect)
        const left = Math.min(vr[0], vr[2])
        const top  = Math.min(vr[1], vr[3])
        const w    = Math.abs(vr[2] - vr[0])
        const h    = Math.abs(vr[3] - vr[1])
        const name = normName(ann.fieldName)
        const init = initFieldValues[name]

        const refCb = el => {
          if (el) refsMap.current.set(name, el)
          else    refsMap.current.delete(name)
        }

        if (ann.fieldType === 'Tx') {
          return ann.multiLine ? (
            <textarea
              key={ann.id}
              className="pdfv-overlay-input pdfv-overlay-textarea"
              style={{ position: 'absolute', left, top, width: w, height: h }}
              defaultValue={typeof init === 'string' ? init : ''}
              ref={refCb}
            />
          ) : (
            <input
              key={ann.id}
              className="pdfv-overlay-input"
              style={{ position: 'absolute', left, top, width: w, height: h }}
              defaultValue={typeof init === 'string' ? init : ''}
              ref={refCb}
            />
          )
        }

        if (ann.fieldType === 'Btn') {
          return (
            <div
              key={ann.id}
              className="pdfv-overlay-check-wrap"
              style={{ position: 'absolute', left, top, width: w, height: h }}
            >
              <input
                type="checkbox"
                className="pdfv-overlay-checkbox"
                defaultChecked={isOn(init)}
                ref={refCb}
              />
            </div>
          )
        }

        return null
      })}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────
export default function PdfFormViewer({ initialData, nom, onSave, onClose }) {
  const [pages,           setPages]           = useState([])
  const [loading,         setLoading]         = useState(true)
  const [loadError,       setLoadError]       = useState(null)
  const [initFieldValues, setInitFieldValues] = useState({})

  // On mobile, fit the PDF to the viewport width with a small margin
  const scale = window.innerWidth <= 768
    ? Math.max((window.innerWidth - 8) / PDF_NATIVE_WIDTH, 0.45)
    : DESKTOP_SCALE

  // DOM refs for every visible input — populated by PdfPage's ref callbacks
  const refsMap = useRef(new Map())

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const doc = await pdfjsLib.getDocument(templateUrl).promise
        if (cancelled) return

        const pageArr    = []
        const initFields = {}

        for (let i = 1; i <= doc.numPages; i++) {
          const pg   = await doc.getPage(i)
          const anns = await pg.getAnnotations()
          for (const ann of anns) {
            if (ann.subtype !== 'Widget' || !ann.fieldName) continue
            const name = normName(ann.fieldName)
            // Initialise to blank/unchecked — gets overridden below if initialData provided
            initFields[name] = ann.fieldType === 'Btn' ? 'Off' : ''
          }
          pageArr.push(pg)
        }

        // Apply pre-filled values: accepts flat map, structured vtFormData, or basic contact info
        if (initialData) {
          Object.assign(initFields, toFlatFields(initialData))
        }

        if (!cancelled) {
          setPages(pageArr)
          setInitFieldValues(initFields)
          setLoading(false)
        }
      } catch (err) {
        console.error('PdfFormViewer load error', err)
        if (!cancelled) { setLoadError('Impossible de charger le PDF.'); setLoading(false) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Collect ALL current DOM values and pass the complete flat map to onSave.
  // This captures every field in the PDF — nothing is filtered out.
  const handleSave = () => {
    const current = { ...initFieldValues }
    for (const [name, el] of refsMap.current) {
      current[name] = el.type === 'checkbox' ? (el.checked ? 'Yes' : 'Off') : el.value
    }
    onSave(current)
  }

  return (
    <>
      <div className="pdfv-backdrop" onClick={onClose} />
      <div className="pdfv-modal" onClick={e => e.stopPropagation()}>

        <div className="pdfv-header">
          <div className="pdfv-header-left">
            <FileText size={15} color="#f59e0b" />
            <span>Fiche VT{nom ? ` — ${nom}` : ''}</span>
          </div>
          <button className="pdfv-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="pdfv-body">
          {loading    && <div className="pdfv-status">Chargement du PDF…</div>}
          {loadError  && <div className="pdfv-status pdfv-error">{loadError}</div>}
          {!loading && !loadError && (
            <div className="pdfv-pages">
              {pages.map((page, i) => (
                <PdfPage
                  key={i}
                  page={page}
                  scale={scale}
                  initFieldValues={initFieldValues}
                  refsMap={refsMap}
                />
              ))}
            </div>
          )}
        </div>

        <div className="pdfv-footer">
          <button className="pdfv-btn-cancel" onClick={onClose}>Annuler</button>
          <button className="pdfv-btn-save" onClick={handleSave} disabled={loading}>
            <Save size={13} />
            Sauvegarder
          </button>
        </div>

      </div>
    </>
  )
}
