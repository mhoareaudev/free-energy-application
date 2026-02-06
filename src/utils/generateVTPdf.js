import { PDFDocument } from 'pdf-lib'
import templateUrl from '../assets/formulaire_vt.pdf'

/**
 * Generate a filled VT PDF from the template.
 * @param {Object} data - Form data to fill in
 * @param {string} data.commercial - Commercial name
 * @returns {Promise<Uint8Array>} The filled PDF bytes
 */
export async function generateVTPdf(data) {
  // Load the template PDF
  const templateBytes = await fetch(templateUrl).then(res => res.arrayBuffer())
  const pdf = await PDFDocument.load(templateBytes)
  const form = pdf.getForm()

  // Helper to safely set a text field
  const setField = (name, value) => {
    if (!value) return
    try {
      form.getTextField(name).setText(value)
    } catch (e) {
      // Field may not exist in template
    }
  }

  // Helper to safely check a checkbox
  const checkBox = (name) => {
    try {
      form.getCheckBox(name).check()
    } catch (e) {
      // Field may not exist in template
    }
  }

  // En-tête
  setField('commercial_vt', data.commercial)
  setField('date_de_la_demande', data.date || new Date().toLocaleDateString('fr-FR'))

  // Type de contrat
  if (data.typeContrat === 'comptant') checkBox('type_comptant')
  if (data.typeContrat === 'abonnement') checkBox('type_abonnement')

  // Contrat de maintenance
  if (data.contratMaintenance === 'oui') checkBox('oui_maintenance')
  if (data.contratMaintenance === 'non') checkBox('non_maintenance')

  // Batterie / Prise sécurisée
  setField('stockage_text', data.batterie)
  setField('prise_securisee_text', data.priseSécurisée)

  // Projet
  setField('puissance_souhaitée', data.puissance)
  setField('adresse_pose', data.adresse)
  setField('code_postal', data.codePostal)
  setField('Commune', data.commune)

  // Client (interlocuteur)
  setField('nom_interlocuteur', data.clientName)
  setField('mail_interlocuteur', data.email)
  setField('tel_interlocuteur', data.tel)

  // Chargé d'affaires
  setField('technicien_vt', data.chargesAffaires)

  // AC avec revente du surplus
  if (data.reventeSurplus === 'oui') checkBox('oui_revente')
  if (data.reventeSurplus === 'non') checkBox('non_revente')

  // Flatten the form so fields become static text
  form.flatten()

  return await pdf.save()
}

/**
 * Generate and download the VT PDF.
 * @param {Object} data - Form data to fill in
 * @param {string} filename - Download filename
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
