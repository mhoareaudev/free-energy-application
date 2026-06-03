import { useState, useEffect } from 'react'
import {
  ArrowLeft, Mail, PhoneCall, StickyNote, MoreHorizontal, Ticket,
} from 'lucide-react'
import { ilioSupabase } from '../../lib/ilioSupabase'
import './ContactDetail.css'

const STATUS_MAP = {
  nouveau:    { label: 'Nouveau',    color: '#ea580c', bg: '#fff7ed' },
  en_cours:   { label: 'En cours',   color: '#d97706', bg: '#fffbeb' },
  en_attente: { label: 'En attente', color: '#7c3aed', bg: '#f5f3ff' },
  incomplet:  { label: 'Incomplet',  color: '#ca8a04', bg: '#fefce8' },
  termine:    { label: 'Terminé',    color: '#16a34a', bg: '#f0fdf4' },
  ferme:      { label: 'Fermé',      color: '#64748b', bg: '#f1f5f9' },
  annule:     { label: 'Annulé',     color: '#dc2626', bg: '#fef2f2' },
}

const INSTALL_LABELS = {
  chauffe_eau_solaire:      'Chauffe-eau solaire',
  borne_recharge:           'Borne de recharge',
  maintenance_pv:           'Maintenance PV',
  maintenance_industrielle: 'Maintenance industrielle',
  autre_installation:       'Autre',
}

const CHANNEL_LABELS = {
  appel:       'Appel téléphonique',
  email:       'Email',
  whatsapp:    'WhatsApp',
  presentiel:  'Présentiel',
  client_web:  'Demande client (web)',
  runcharge:   'GreenYellow',
  smartenergy: 'Smart Energies',
  autre:       'Autre',
}

function fmtDate(str) {
  if (!str) return ''
  return new Date(str).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

export default function IlioContactDetail({ contact, onBack }) {
  const [fullData, setFullData]   = useState(null)
  const [tickets, setTickets]     = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    if (!contact) return
    const ilioId = contact.id.replace('ilio:', '')

    Promise.all([
      ilioSupabase.from('ticket_clients').select('*').eq('id', ilioId).single(),
      contact.email
        ? ilioSupabase
            .from('tickets')
            .select('id,reference,subject,description,status,priority,installation_type,intervention_date,created_at,assigned_to,channel')
            .eq('email', contact.email)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]).then(([{ data: c }, { data: t }]) => {
      setFullData(c)
      setTickets(t || [])
      setLoading(false)
    })
  }, [contact])

  if (!contact) return null

  const nom      = contact.nom
  const initials = nom.split(' ').map(w => w[0]?.toUpperCase() || '').slice(0, 2).join('')
  const phone    = fullData?.phone   || contact.phone    || ''
  const email    = contact.email     || ''
  const adresse  = contact.adresse   || fullData?.address || ''
  const cp       = contact.codePostal || fullData?.postal_code || ''
  const ville    = contact.ville     || fullData?.commune || ''
  const install  = INSTALL_LABELS[contact.installType || fullData?.installation_type] || ''
  const channel  = CHANNEL_LABELS[fullData?.channel] || ''

  const infoRows = [
    { label: 'Type de contact',        value: 'Tickets Ilio Systems' },
    { label: 'Téléphone',              value: phone   },
    { label: 'E-mail',                 value: email   },
    { label: 'Adresse',                value: adresse },
    { label: 'Code postal',            value: cp      },
    { label: 'Ville',                  value: ville   },
    { label: "Type d'installation",    value: install },
    { label: 'Canal de contact',       value: channel },
  ].filter(r => r.value)

  const openCount   = tickets.filter(t => ['nouveau', 'en_cours', 'en_attente', 'incomplet'].includes(t.status)).length
  const closedCount = tickets.filter(t => ['termine', 'ferme', 'annule'].includes(t.status)).length

  return (
    <div className="cd-root">

      {/* Breadcrumb */}
      <div className="cd-breadcrumb">
        <button className="cd-back-btn" onClick={onBack}>
          <ArrowLeft size={13} />
          Contacts
        </button>
      </div>

      {/* Body */}
      <div className="cd-body">

        {/* ── Left ── */}
        <aside className="cd-left">

          {/* Contact card */}
          <div className="cd-contact-card">
            <div className="cd-avatar">{initials}</div>
            <div className="cd-contact-name">{nom}</div>
            <div className="cd-contact-sub">Ilio Systems</div>
            {email && (
              <a className="cd-contact-email" href={`mailto:${email}`}>{email}</a>
            )}
            <div className="cd-action-btns">
              <button className="cd-action-btn" title="Note">
                <StickyNote size={14} /><span>Note</span>
              </button>
              <button className="cd-action-btn" title="E-mail">
                <Mail size={14} /><span>E-mail</span>
              </button>
              <button className="cd-action-btn" title="Appel">
                <PhoneCall size={14} /><span>Appel</span>
              </button>
              <button className="cd-action-btn" title="Plus">
                <MoreHorizontal size={14} /><span>Plus</span>
              </button>
            </div>
          </div>

          {/* Info section */}
          <div className="cd-info-section">
            <div className="cd-info-header">
              <span className="cd-info-title">Informations clés</span>
            </div>
            {infoRows.map(({ label, value }) => (
              <div key={label} className="cd-info-row">
                <div className="cd-info-label">{label}</div>
                <div className="cd-info-value">{value}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* ── Middle : tickets ── */}
        <main className="cd-middle">
          <div className="cd-act-tabs">
            <button className="cd-act-tab active">
              Tickets ({tickets.length})
            </button>
          </div>

          <div className="cd-act-timeline">
            {loading ? (
              <div className="cd-act-empty"><span>Chargement...</span></div>
            ) : tickets.length === 0 ? (
              <div className="cd-act-empty"><span>Aucun ticket associé à ce contact.</span></div>
            ) : tickets.map(t => {
              const s = STATUS_MAP[t.status] || { label: t.status, color: '#64748b', bg: '#f8fafc' }
              return (
                <div key={t.id} className="cd-act-item">
                  <div className="cd-act-icon" style={{ background: s.bg }}>
                    <Ticket size={14} color={s.color} />
                  </div>
                  <div className="cd-act-content">
                    <div className="cd-act-title-row">
                      <span className="cd-act-title">
                        <span style={{ fontFamily: 'monospace', color: '#3b82f6', fontWeight: 700, fontSize: 12 }}>
                          {t.reference}
                        </span>
                        {(t.subject || t.description) && (
                          <> — {t.subject || t.description.slice(0, 70)}</>
                        )}
                      </span>
                      <span className="cd-act-date">{fmtDate(t.created_at)}</span>
                    </div>
                    <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{
                        background: s.bg, color: s.color,
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                      }}>
                        {s.label}
                      </span>
                      {t.installation_type && INSTALL_LABELS[t.installation_type] && (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {INSTALL_LABELS[t.installation_type]}
                        </span>
                      )}
                      {t.intervention_date && (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          Intervention : {fmtDate(t.intervention_date)}
                        </span>
                      )}
                    </div>
                    {t.description && t.subject && (
                      <div className="cd-act-body">{t.description.slice(0, 120)}{t.description.length > 120 ? '…' : ''}</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </main>

        {/* ── Right ── */}
        <aside className="cd-right">
          <div className="cd-rp-section">
            <div className="cd-rp-header">
              <span className="cd-rp-title">
                <Ticket size={13} />
                Tickets Ilio
                {tickets.length > 0 && <span className="cd-rp-count">({tickets.length})</span>}
              </span>
            </div>

            {tickets.length === 0 ? (
              <div className="cd-rp-empty">
                <div className="cd-rp-empty-icon"><Ticket size={18} /></div>
                <p className="cd-rp-empty-text">Aucun ticket associé.</p>
              </div>
            ) : (
              <div className="cd-rp-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {openCount > 0 && (
                  <div className="cd-rp-tx-card">
                    <div className="cd-rp-tx-name">{openCount} ticket{openCount > 1 ? 's' : ''} en cours</div>
                    <div className="cd-rp-tx-meta">
                      <span style={{ background: '#fff7ed', color: '#ea580c', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99 }}>
                        Actifs
                      </span>
                    </div>
                  </div>
                )}
                {closedCount > 0 && (
                  <div className="cd-rp-tx-card">
                    <div className="cd-rp-tx-name">{closedCount} ticket{closedCount > 1 ? 's' : ''} terminé{closedCount > 1 ? 's' : ''}</div>
                    <div className="cd-rp-tx-meta">
                      <span style={{ background: '#f0fdf4', color: '#16a34a', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99 }}>
                        Clôturés
                      </span>
                    </div>
                  </div>
                )}
                <div className="cd-rp-tx-card" style={{ borderStyle: 'dashed' }}>
                  <div className="cd-rp-tx-name" style={{ color: '#94a3b8', fontSize: 12 }}>
                    Dernier ticket : {fmtDate(tickets[0]?.created_at)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

      </div>
    </div>
  )
}
