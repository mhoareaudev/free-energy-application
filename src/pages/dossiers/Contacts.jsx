import { useMemo, useState, useEffect } from 'react'
import { Users, X, CheckCircle2 } from 'lucide-react'
import { useSpreadsheet } from '../../context/SpreadsheetContext'
import { getColumnIdToLetterMap } from '../../data/sheetsConfig'
import DossierListPage from './DossierListPage'
import ContactDetail from './ContactDetail'
import TransactionDetail from './TransactionDetail'
import { formatDateFR } from '../../utils/dateUtils'
import { supabaseGet, supabasePost, supabaseUpsert } from '../../lib/supabase'
import { sendVTRequestEmail } from '../../utils/sendVTEmail'
import { ilioSupabase } from '../../lib/ilioSupabase'
import { useAuth } from '../../context/AuthContext'
import { useNotifications } from '../../context/NotificationContext'
import './Contacts.css'

function extractRows(cells, commercialLetter) {
  const rowSet = new Set()
  Object.keys(cells).forEach(key => {
    if (key.startsWith('__')) return
    const m = key.match(/^[A-Z]+(\d+)$/)
    if (m && parseInt(m[1]) >= 2) rowSet.add(parseInt(m[1]))
  })
  return Array.from(rowSet).filter(r => cells[`${commercialLetter}${r}`])
}

function useContacts() {
  const { sheets } = useSpreadsheet()
  return useMemo(() => {
    const rows = []

    const colC = getColumnIdToLetterMap('btoc-comptant')
    const cellsC = sheets['btoc-comptant']?.cells || {}
    const pushRows = (cells, colMap, nameColId, prefix) => {
      const nameLetter = colMap[nameColId]
      if (!nameLetter) return
      const rowSet = new Set()
      Object.keys(cells).forEach(k => {
        if (k.startsWith('__')) return
        const m = k.match(/^[A-Z]+(\d+)$/)
        if (m && parseInt(m[1]) >= 2) rowSet.add(parseInt(m[1]))
      })
      rowSet.forEach(r => {
        const nom = cells[`${nameLetter}${r}`]
        if (!nom) return
        rows.push({
          id: `${prefix}:${r}`, nom,
          email:      cells[`${colMap['EMAIL']}${r}`]               || '',
          adresse:    cells[`${colMap['ADRESSE_INSTALLATION']}${r}`] || '',
          codePostal: cells[`${colMap['CODE_POSTAL']}${r}`]         || '',
          ville:      cells[`${colMap['VILLE']}${r}`]               || '',
        })
      })
    }

    pushRows(cellsC, colC, 'Colonne1', 'c')

    const colA = getColumnIdToLetterMap('btoc-abonnement')
    const cellsA = sheets['btoc-abonnement']?.cells || {}
    pushRows(cellsA, colA, 'NOM_PRENOM', 'a')

    const colB = getColumnIdToLetterMap('btob')
    const cellsB = sheets['btob']?.cells || {}
    pushRows(cellsB, colB, 'NOM_PRENOM', 'b')

    // Sort then deduplicate by e-mail — same client can have multiple transaction rows.
    // Two different clients can share the same name, so the e-mail is the reliable key
    // (rows without e-mail can't be compared reliably and are kept as-is).
    rows.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
    const seen = new Set()
    return rows.filter(r => {
      const key = r.email.toLowerCase().trim()
      if (!key) return true
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [sheets])
}

const CONTACT_TYPES = [
  { value: 'recommendation', label: 'Recommandation',        color: '#22c55e' },
  { value: 'web',            label: 'Web / Réseaux sociaux',  color: '#3b82f6' },
  { value: 'foire',          label: 'Foire / Salon',          color: '#8b5cf6' },
  { value: 'telephone',      label: 'Démarchage tél.',         color: '#f97316' },
  { value: 'terrain',        label: 'Prospection terrain',    color: '#f59e0b' },
  { value: 'partenaire',     label: 'Partenaire',             color: '#06b6d4' },
  { value: 'publicite',      label: 'Publicité',              color: '#ec4899' },
  { value: 'autre',          label: 'Autre',                  color: '#64748b' },
  { value: 'ilio_ticket',    label: 'Tickets Ilio Systems',   color: '#6366f1' },
]

function ContactTypeBadge({ value }) {
  if (!value) return <span style={{ color: '#94a3b8' }}>—</span>
  const type = CONTACT_TYPES.find(t => t.value === value)
  if (!type) return value
  return (
    <span style={{
      background: type.color + '22', color: type.color,
      fontSize: '11.5px', fontWeight: 600, padding: '3px 10px',
      borderRadius: '99px', whiteSpace: 'nowrap',
    }}>
      {type.label}
    </span>
  )
}

function useAllContactMetadata() {
  const [map, setMap] = useState({})
  useEffect(() => {
    supabaseGet('contact_metadata', { select: 'contact_id,contact_type' })
      .then(data => {
        if (!Array.isArray(data)) return
        const m = {}
        data.forEach(r => { if (r.contact_id) m[r.contact_id] = r.contact_type || '' })
        setMap(m)
      })
  }, [])
  const updateType = (contactId, type) =>
    setMap(prev => ({ ...prev, [contactId]: type }))
  return { map, updateType }
}

function useTicketClients() {
  const [clients, setClients] = useState([])
  useEffect(() => {
    ilioSupabase
      .from('ticket_clients')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!Array.isArray(data)) return
        setClients(data.map(c => ({
          id:           `ilio:${c.id}`,
          nom:          c.full_name,
          email:        c.email || '',
          adresse:      c.address || '',
          codePostal:   c.postal_code || '',
          ville:        c.commune || '',
          contactType:  'ilio_ticket',
          source:       'ilio',
          ticketRef:    c.ticket_reference,
          installType:  c.installation_type,
        })))
      })
  }, [])
  return clients
}

const COLUMNS = [
  {
    key: 'nom', label: 'Nom', width: 220,
    render: v => <span className="dossier-td--name">{v}</span>,
  },
  { key: 'email',      label: 'E-mail',          width: 210, hideOnMobile: true },
  { key: 'adresse',    label: 'Adresse postale',  width: 240, hideOnMobile: true },
  { key: 'codePostal', label: 'Code postal',      width: 120, hideOnMobile: true },
  { key: 'ville',      label: 'Ville',            width: 150, hideOnMobile: true },
  {
    key: 'contactType', label: 'Type de contact', width: 180,
    render: v => <ContactTypeBadge value={v} />,
  },
]


const EMPTY_FORM = {
  nom: '', prenom: '', commercial: '',
  typeClient: 'btoc', typeContrat: 'comptant',
  puissance: '', adresse: '', codePostal: '', commune: '',
  email: '', tel: '',
  reventeSurplus: '', contratMaintenance: '', batterie: '',
  ond3kva: 0, ond5kva: 0, ond6kva: 0, ond8kva: 0, ond9kva: 0,
}

function getTargetSheet(formData) {
  if (formData.typeClient === 'btob') return 'btob'
  return formData.typeContrat === 'comptant' ? 'btoc-comptant' : 'btoc-abonnement'
}

function getSheetLabel(sheetId) {
  switch (sheetId) {
    case 'btoc-comptant':   return 'Suivi activités BtoC – Comptant'
    case 'btoc-abonnement': return 'Suivi activités BtoC – Abonnement'
    case 'btob':            return 'Suivi activités BtoB'
    default: return sheetId
  }
}

function PageToast({ message }) {
  return (
    <div className="page-toast page-toast--success">
      <CheckCircle2 size={15} />
      {message}
    </div>
  )
}

function AddContactPanel({ onClose, onCreated }) {
  const { userProfile } = useAuth()
  const { addVTRequest, addContactRow } = useSpreadsheet()
  const { notifyAllExcept } = useNotifications()
  const [commerciaux, setCommerciaux] = useState([])
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    supabaseGet('commerciaux', { select: 'id,nom,prenom', order: 'nom.asc' })
      .then(data => setCommerciaux(data))
  }, [])

  const handleChange = e => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const hasProject = !!(formData.commercial)
      const targetSheet = hasProject
        ? getTargetSheet(formData)
        : (formData.typeClient === 'btob' ? 'btob' : 'btoc-comptant')
      const clientName = `${formData.prenom} ${formData.nom}`
      const today = formatDateFR()
      const requesterName = `${userProfile?.prenom || ''} ${userProfile?.nom || ''}`.trim() || 'Inconnu'
      const sheetLabel = getSheetLabel(targetSheet)

      if (hasProject) {
        const commercialName = formData.commercial
        const vtFormData = {
          commercial: commercialName, clientName, date: today,
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
          ond3kva: formData.ond3kva || 0,
          ond5kva: formData.ond5kva || 0,
          ond6kva: formData.ond6kva || 0,
          ond8kva: formData.ond8kva || 0,
          ond9kva: formData.ond9kva || 0,
        }

        const nextRow = addVTRequest(targetSheet, {
          commercial: commercialName, clientName, dateDemandeVT: today, vtFormData,
        })

        const vtPrefix = formData.typeClient === 'btob' ? 'b' : formData.typeContrat === 'comptant' ? 'c' : 'a'
        const vtContactId = `${vtPrefix}:${nextRow}`
        supabasePost('vt_requests', {
          nom: formData.nom, prenom: formData.prenom,
          commercial: commercialName,
          type_client: formData.typeClient,
          type_contrat: formData.typeContrat,
          target_sheet: targetSheet,
          contact_id: vtContactId,
          requested_by: userProfile?.id,
          status: 'pending',
        }).catch(err => console.warn('Could not save to vt_requests:', err))

        // Send email to technicians (only for non-old sheets)
        if (!targetSheet.endsWith('-old')) {
          sendVTRequestEmail({
            nom_client:     clientName,
            commercial:     commercialName,
            adresse:        formData.adresse || '',
            ville:          formData.commune || '',
            code_postal:    formData.codePostal || '',
            total_ttc:      '',
            date_signature: '',
            telephone:      formData.tel || '',
            email_client:   formData.email || '',
            type_contrat:   formData.typeContrat || '',
            puissance:      formData.puissance || '',
          }).then(() => console.log('✅ VT email envoyé'))
            .catch(err => console.error('❌ VT email failed:', err))
        }

        notifyAllExcept(
          userProfile?.id, 'vt_request',
          'Nouvelle demande de VT',
          `Faite par ${requesterName} pour ${clientName}`,
          { target_sheet: targetSheet }
        )

        const prefix = formData.typeClient === 'btob' ? 'b' : formData.typeContrat === 'comptant' ? 'c' : 'a'
        const contactId = `${prefix}:${nextRow}`
        const actBase = { contact_id: contactId, created_by: userProfile?.id || null, created_by_name: requesterName }

        await Promise.allSettled([
          supabasePost('contact_activities', {
            ...actBase, type: 'creation', title: 'Contact créé',
            body: `${clientName} a été ajouté dans : ${sheetLabel}.`,
          }),
          supabasePost('contact_activities', {
            ...actBase, type: 'transaction', title: 'Transaction créée',
            body: 'Projet solaire créé — phase "VT en cours".',
          }),
          supabasePost('contact_activities', {
            ...actBase, type: 'pdf', title: 'Formulaire de demande VT généré',
            body: `Formulaire_VT_${clientName.replace(/\s+/g, '_')}.pdf`,
          }),
        ])

        setFormData(EMPTY_FORM)
        onCreated?.(contactId, `Contact et transaction créés pour ${clientName}`)
      } else {
        // Contact only — no project, no transaction, no PDF
        const nextRow = addContactRow(targetSheet, {
          clientName,
          email: formData.email,
          adresse: formData.adresse,
          codePostal: formData.codePostal,
          commune: formData.commune,
          tel: formData.tel,
        })

        const prefix = formData.typeClient === 'btob' ? 'b' : 'c'
        const contactId = `${prefix}:${nextRow}`
        const actBase = { contact_id: contactId, created_by: userProfile?.id || null, created_by_name: requesterName }

        await supabasePost('contact_activities', {
          ...actBase, type: 'creation', title: 'Contact créé',
          body: `${clientName} a été ajouté. Aucun projet assigné pour le moment.`,
        })

        setFormData(EMPTY_FORM)
        onCreated?.(contactId, `Contact créé : ${clientName}`)
      }
    } catch (err) {
      console.error(err)
      setError("Erreur lors de l'envoi de la demande. Veuillez réessayer.")
    } finally {
      setLoading(false)
    }
  }

  const canSubmit = !!(formData.nom && formData.prenom)

  return (
    <>
      <div className="ct-panel-backdrop" onClick={onClose} />
      <aside className="ct-add-panel">
        <div className="ct-panel-header">
          <span className="ct-panel-title">Ajouter un contact</span>
          <button className="ct-panel-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="ct-panel-body">
            <form onSubmit={handleSubmit} id="ct-add-form">
              {error && <div className="error-message">{error}</div>}

              <div className="form-section-title">Informations du client</div>

              <div className="form-row">
                <div className="form-group">
                  <label>Nom du client</label>
                  <input type="text" name="nom" value={formData.nom} onChange={handleChange} required placeholder="Nom" />
                </div>
                <div className="form-group">
                  <label>Prénom du client</label>
                  <input type="text" name="prenom" value={formData.prenom} onChange={handleChange} required placeholder="Prénom" />
                </div>
              </div>

              <div className="form-group">
                <label>Type de client</label>
                <select name="typeClient" value={formData.typeClient} onChange={handleChange} required>
                  <option value="btoc">BtoC (Particulier)</option>
                  <option value="btob">BtoB (Professionnel)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Adresse</label>
                <input type="text" name="adresse" value={formData.adresse} onChange={handleChange} placeholder="Adresse de pose" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Code postal</label>
                  <input type="text" name="codePostal" value={formData.codePostal} onChange={handleChange} placeholder="Code postal" />
                </div>
                <div className="form-group">
                  <label>Commune</label>
                  <input type="text" name="commune" value={formData.commune} onChange={handleChange} placeholder="Commune" />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>E-mail</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="E-mail du client" />
                </div>
                <div className="form-group">
                  <label>Téléphone</label>
                  <input type="tel" name="tel" value={formData.tel} onChange={handleChange} placeholder="Téléphone du client" />
                </div>
              </div>

              <div className="form-section-title">Projet <span className="form-section-hint">(optionnel)</span></div>

              <div className="form-group">
                <label>Commercial</label>
                <select name="commercial" value={formData.commercial} onChange={handleChange}>
                  <option value="">Sélectionnez un commercial</option>
                  {commerciaux.map(c => (
                    <option key={c.id} value={`${c.prenom} ${c.nom}`}>{c.prenom} {c.nom}</option>
                  ))}
                </select>
                <span className="form-hint">Requis pour créer une transaction et un PDF.</span>
              </div>

              <div className="form-group">
                <label>Type de contrat</label>
                <select name="typeContrat" value={formData.typeContrat} onChange={handleChange} disabled={!formData.commercial || formData.typeClient === 'btob'}>
                  <option value="comptant">Comptant</option>
                  <option value="abonnement">Abonnement</option>
                </select>
                {formData.typeClient === 'btob' && <span className="form-hint">BtoB utilise un onglet dédié</span>}
              </div>

              <div className="form-group">
                <label>Puissance envisagée (kWc)</label>
                <input type="text" name="puissance" value={formData.puissance} onChange={handleChange} placeholder="Ex: 3, 6, 9..." disabled={!formData.commercial} />
              </div>

              <div className="form-group">
                <label>Onduleurs</label>
                <div className="form-onduleurs">
                  {[['ond3kva','3 kVa'],['ond5kva','5 kVa'],['ond6kva','6 kVa'],['ond8kva','8 kVa'],['ond9kva','9 kVa']].map(([name, label]) => (
                    <div key={name} className="form-ond-item">
                      <span className="form-ond-label">{label}</span>
                      <input type="number" min="0" name={name} value={formData[name]} onChange={handleChange} disabled={!formData.commercial} className="form-ond-input" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>AC avec revente du surplus</label>
                  <select name="reventeSurplus" value={formData.reventeSurplus} onChange={handleChange} disabled={!formData.commercial}>
                    <option value="">-</option>
                    <option value="oui">Oui</option>
                    <option value="non">Non</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Contrat de maintenance</label>
                  <select name="contratMaintenance" value={formData.contratMaintenance} onChange={handleChange} disabled={!formData.commercial}>
                    <option value="">-</option>
                    <option value="oui">Oui</option>
                    <option value="non">Non</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Batterie</label>
                  <select name="batterie" value={formData.batterie} onChange={handleChange} disabled={!formData.commercial}>
                    <option value="">-</option>
                    <option value="oui">Oui</option>
                    <option value="non">Non</option>
                  </select>
                </div>
              </div>

            </form>
        </div>

          <div className="ct-panel-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Annuler
            </button>
            <button type="submit" form="ct-add-form" className="btn btn-primary" disabled={loading || !canSubmit}>
              {loading ? 'Envoi...' : formData.commercial ? 'Créer le contact et la transaction' : 'Créer le contact'}
            </button>
          </div>
      </aside>
    </>
  )
}

export default function Contacts() {
  const rawRows    = useContacts()
  const { map: metadata, updateType } = useAllContactMetadata()
  const ilioRows   = useTicketClients()

  // Dédoublonnage : on exclut les contacts ilio dont le nom existe déjà dans les feuilles
  const sheetNames = useMemo(
    () => new Set(rawRows.map(r => r.nom.toLowerCase().trim())),
    [rawRows]
  )
  const newIlioRows = useMemo(
    () => ilioRows.filter(r => !sheetNames.has(r.nom.toLowerCase().trim())),
    [ilioRows, sheetNames]
  )

  const rows = useMemo(
    () => [
      ...rawRows.map(r => ({ ...r, contactType: metadata[r.id] || '' })),
      ...newIlioRows,
    ].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [rawRows, metadata, newIlioRows]
  )
  const [showAdd,             setShowAdd]             = useState(false)
  const [activeContactId,     setActiveContactId]     = useState(null)
  const [activeTransactionId, setActiveTransactionId] = useState(null)
  const [activeIlioContact,   setActiveIlioContact]   = useState(null)
  const [toast,               setToast]               = useState(null)

  const showToast = msg => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleRowClick = row => {
    if (row.source === 'ilio') setActiveIlioContact(row)
    else setActiveContactId(row.id)
  }

  if (activeTransactionId) {
    return (
      <TransactionDetail
        transactionId={activeTransactionId}
        onBack={() => setActiveTransactionId(null)}
        backLabel="Contacts"
      />
    )
  }

  if (activeIlioContact) {
    return (
      <ContactDetail
        contactId={activeIlioContact.id}
        ilioContact={activeIlioContact}
        onBack={() => setActiveIlioContact(null)}
      />
    )
  }

  return (
    <>
      {toast && <PageToast message={toast} />}

      {activeContactId ? (
        <ContactDetail
          contactId={activeContactId}
          onBack={() => setActiveContactId(null)}
          onTransactionClick={id => setActiveTransactionId(id)}
          onTypeChange={updateType}
        />
      ) : (
        <>
          <DossierListPage
            title="Contacts"
            addLabel="Ajouter des contacts"
            tabs={['Tous les contacts', 'Mes contacts', 'Contacts non attribués']}
            columns={COLUMNS}
            rows={rows}
            onAdd={() => setShowAdd(true)}
            onRowClick={handleRowClick}
            alwaysShowTable
            emptyIcon={<Users size={34} strokeWidth={1.5} />}
            emptyTitle="Aucun contact enregistré"
            emptyDesc="Les contacts BtoC comptant et abonnement apparaîtront ici dès qu'ils auront été saisis dans le CRM."
          />
          {showAdd && (
            <AddContactPanel
              onClose={() => setShowAdd(false)}
              onCreated={(id, msg) => {
                setShowAdd(false)
                if (msg) showToast(msg)
                if (id) setActiveContactId(id)
              }}
            />
          )}
        </>
      )}
    </>
  )
}
