import { PDFDocument } from 'pdf-lib'
import templateUrl from '../assets/formulaire_vt.pdf'
import { formatDateFR, isoToDMY } from './dateUtils'

// ── Shared filling logic ────────────────────────────────────────
async function _fillVtForm(data) {
  const templateBytes = await fetch(templateUrl).then(res => res.arrayBuffer())
  const pdf  = await PDFDocument.load(templateBytes)
  const form = pdf.getForm()

  const setField = (name, value) => {
    if (!value) return
    try { form.getTextField(name).setText(String(value)) } catch {}
  }
  const checkBox = (name) => {
    try { form.getCheckBox(name).check() } catch {}
  }

  setField('commercial_vt', data.commercial)
  setField('date_de_la_demande', data.date || formatDateFR())
  setField('technicien_vt', data.chargesAffaires)

  if (data.typeContrat === 'comptant')    checkBox('type_comptant')
  if (data.typeContrat === 'abonnement')  checkBox('type_abonnement')

  if (data.contratMaintenance === 'oui') checkBox('oui_maintenance')
  if (data.contratMaintenance === 'non') checkBox('non_maintenance')

  setField('puissance_souhaitée', data.puissance)
  setField('stockage_text', data.batterie)
  setField('adresse_pose', data.adresse)
  setField('code_postal', data.codePostal)
  setField('Commune', data.commune)

  setField('nom_interlocuteur', data.clientName)
  setField('mail_interlocuteur', data.email)
  setField('tel_interlocuteur', data.tel)

  if (data.reventeSurplus === 'oui') checkBox('oui_revente')
  if (data.reventeSurplus === 'non') checkBox('non_revente')

  setField('prise_securisee_text', data.prise_securisee_text)

  ;(data.plans || []).forEach(p => checkBox(`plan_${p}`))

  ;(data.type_toiture || []).forEach(t => {
    if (t === 'mono_pente') checkBox('mono_pente')
    if (t === 'bi_pente')   checkBox('bi_pente')
    if (t === 'autre')      checkBox('autre_toiture')
  })
  setField('autre_toiture_texte', data.autre_toiture_texte)
  if (data.accessibilite === 'oui') checkBox('oui_accessible')
  if (data.accessibilite === 'non') checkBox('non_accessible')

  ;(data.type_couverture || []).forEach(t => {
    if (t === 'tole_ondulee') checkBox('tole_ondulee')
    if (t === 'nervuree')     checkBox('couverture_nervuree')
    if (t === 'autre')        checkBox('autre_couverture')
  })
  setField('autre_couverture_texte', data.autre_couverture_texte)
  if (data.etat_couverture === 'bon')   checkBox('bon_etat_couverture')
  if (data.etat_couverture === 'moyen') checkBox('moyen_etat_couverture')
  if (data.etat_couverture === 'age')   checkBox('age_etat_couverture')
  setField('age_couverture_texte', data.age_couverture_texte)

  if (data.etat_vis === 'bon')   checkBox('bon_etat_vis')
  if (data.etat_vis === 'moyen') checkBox('moyen_etat_vis')
  if (data.etat_vis === 'age')   checkBox('age_etat_vis')
  setField('age_vis_texte', data.age_vis_texte)
  setField('type_de_vis', data.type_de_vis)

  ;(data.type_charpente || []).forEach(t => {
    if (t === 'metallique') checkBox('charpente_metallique')
    if (t === 'bois')       checkBox('charpente_bois')
    if (t === 'autre')      checkBox('autre_charpente')
  })
  setField('autre_charpente_texte', data.autre_charpente_texte)
  if (data.etat_charpente === 'bon')   checkBox('bon_etat_charpente')
  if (data.etat_charpente === 'moyen') checkBox('moyen_etat_charpente')
  if (data.etat_charpente === 'age')   checkBox('age_etat_charpente')
  setField('age_etat_charpente_texte', data.age_etat_charpente_texte)
  setField('entraxe_de_pannes', data.entraxe_de_pannes)

  if (data.zone_ombre === 'oui') checkBox('oui_ombre')
  if (data.zone_ombre === 'non') checkBox('non_ombre')

  if (data.compteur === 'limite_propriete')   checkBox('compteur_limite_propriete')
  if (data.compteur === 'interieur_batiment') checkBox('compteur_interieur_batiment')
  if (data.disjoncteur === 'limite_propriete')   checkBox('disjoncteur_limite_propriete')
  if (data.disjoncteur === 'interieur_batiment') checkBox('disjoncteur_interieur_batiment')
  if (data.arrivee_edf === 'aerienne')        checkBox('edf_aerienne')
  if (data.arrivee_edf === 'souterrain')      checkBox('edf_souterrain')
  if (data.arrivee_edf === 'aero_souterrain') checkBox('edf_aero_souterrain')
  if (data.cheminement_retenu)                checkBox('cheminement_retenu')

  ;(data.photos || []).forEach(p => checkBox(p))

  setField('commentaires_inclinaison',      data.commentaires_inclinaison)
  setField('commentaires_orientation',      data.commentaires_orientation)
  setField('commentaires_latitude',         data.commentaires_latitude)
  setField('commentaires_longitude',        data.commentaires_longitude)
  setField('commentaires_connexion_internet', data.commentaires_connexion_internet)
  setField('commentaires_technique',        data.commentaires_technique)
  setField('Productible',                   data.productible)
  setField('Production avec centrale à lannée', data.production_annuelle)

  if (data.dateRetour) setField('Date_2', isoToDMY(data.dateRetour))

  return { pdf, form }
}

/**
 * Generate a filled, flattened VT PDF (for download).
 */
export async function generateVTPdf(data) {
  const { pdf, form } = await _fillVtForm(data)
  form.flatten()
  return await pdf.save()
}

/**
 * Generate a filled, flattened PDF from a raw flat field map.
 * The map keys are the exact PDF field names (as returned by pdfjs-dist ann.fieldName).
 * Text fields: any non-empty, non-'Off' string value.
 * Checkboxes: 'Yes' = checked, anything else = unchecked.
 */
export async function generateVTPdfFromFlatFields(fields) {
  const templateBytes = await fetch(templateUrl).then(res => res.arrayBuffer())
  const pdf  = await PDFDocument.load(templateBytes)
  const form = pdf.getForm()
  for (const [name, value] of Object.entries(fields || {})) {
    if (!name || value === undefined || value === null) continue
    try {
      if (value === 'Yes') {
        form.getCheckBox(name).check()
      } else if (value && value !== 'Off') {
        form.getTextField(name).setText(String(value))
      }
    } catch {
      // field doesn't exist or wrong type — ignore
    }
  }
  form.flatten()
  return await pdf.save()
}

/**
 * Download a VT PDF. Accepts either:
 *   - a flat PDF field map  (keys like 'commercial_vt', saved by the new viewer)
 *   - a structured vtFormData (keys like 'commercial', backward compat)
 */
export async function downloadVTPdfAuto(data, filename = 'formulaire_vt.pdf') {
  const isFlat = data && (
    'commercial_vt'    in data ||
    'nom_interlocuteur' in data ||
    'type_comptant'    in data
  )
  const pdfBytes = isFlat
    ? await generateVTPdfFromFlatFields(data)
    : await generateVTPdf(data)
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const url  = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href     = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Generate and trigger download of the VT PDF (structured vtFormData format).
 * @deprecated Use downloadVTPdfAuto for new code.
 */
export async function downloadVTPdf(data, filename = 'formulaire_vt.pdf') {
  const pdfBytes = await generateVTPdf(data)
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
