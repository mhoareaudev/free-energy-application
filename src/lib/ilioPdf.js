import { PDFDocument } from 'pdf-lib'

const INSTALL_LABELS = {
  chauffe_eau_solaire:      'Chauffe-eau solaire',
  borne_recharge:           'Borne de recharge',
  maintenance_pv:           'Maintenance Panneaux Photovoltaïques',
  maintenance_industrielle: 'Maintenance Industrielle',
  autre_installation:       'Autres',
}

async function buildPdf(ticket, formData = {}) {
  const response = await fetch('/bon_intervention.pdf')
  const templateBytes = await response.arrayBuffer()
  const pdfDoc = await PDFDocument.load(templateBytes)
  const form   = pdfDoc.getForm()

  const setText = (name, value) => {
    try { form.getTextField(name).setText(value || '') } catch (_) {}
  }

  const nomClient = [ticket.client_name?.toUpperCase(), ticket.client_firstname].filter(Boolean).join(' ')
  const installLabel = INSTALL_LABELS[ticket.installation_type] ?? ticket.installation_type ?? ''
  const interventionDate = ticket.intervention_date
    ? new Date(ticket.intervention_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : ''

  setText('date_intervention',          formData.date              ?? interventionDate)
  setText('numero_fiche',               ticket.reference           ?? '')
  setText('nom_client',                 nomClient)
  setText('tel_client',                 ticket.phone               ?? '')
  setText('adresse_client',             ticket.address             ?? '')
  setText('code_postal',                ticket.postal_code         ?? '')
  setText('commune_client',             ticket.commune             ?? '')
  setText('type_installation',          installLabel)
  setText('nom_responsable',            formData.nom_responsable   ?? '')
  setText('marque_materiel',            formData.marque            ?? '')
  setText('caracteristiques_materiel',  formData.caracteristiques  ?? '')
  setText('date_intervention_jour',     formData.date              ?? '')
  setText('objet_intervention',         formData.objet             ?? '')
  setText('type_intervention',          formData.type_intervention ?? '')
  setText('rapport_intervention',       formData.rapport           ?? '')

  const embedSig = async (url, fieldName) => {
    if (!url) return
    try {
      const buf   = await (await fetch(url)).arrayBuffer()
      const field = form.getTextField(fieldName)
      const widgets = field.acroField.getWidgets()
      if (!widgets.length) return
      const rect  = widgets[0].getRectangle()
      const image = await pdfDoc.embedPng(new Uint8Array(buf))
      pdfDoc.getPage(0).drawImage(image, { x: rect.x, y: rect.y, width: rect.width, height: rect.height })
      field.setText('')
    } catch (_) {}
  }

  await embedSig(formData.sig_tech_url,   'signature_technicien')
  await embedSig(formData.sig_client_url, 'signature_client')
  form.flatten()

  return pdfDoc
}

export async function generateBonIntervention(ticket, formData = {}) {
  const pdfDoc = await buildPdf(ticket, formData)
  const pdfBytes = await pdfDoc.save()
  const blob = new Blob([pdfBytes], { type: 'application/pdf' })
  window.open(URL.createObjectURL(blob), '_blank')
}

export async function getBonInterventionBlob(ticket, formData = {}) {
  const pdfDoc = await buildPdf(ticket, formData)
  return new Blob([await pdfDoc.save()], { type: 'application/pdf' })
}
