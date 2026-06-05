import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  X, Phone, Mail, FileText, FileDown, Download, ChevronLeft, ChevronRight,
  Plus, CalendarDays, Ban, Pencil, Check, Trash2,
} from 'lucide-react'
import { generateBonIntervention } from '../../lib/ilioPdf'
import { uploadFile } from '../../lib/ilioStorage'
import { BonInterventionModal } from './BonInterventionModal'
import { FactureModal } from './FactureModal'
import { PhotosModal } from './PhotosModal'

const INSTALL_LABELS = {
  chauffe_eau_solaire:      'Chauffe-eau solaire',
  borne_recharge:           'Borne de recharge',
  maintenance_pv:           'Maintenance PV',
  maintenance_industrielle: 'Maintenance industrielle',
  autre_installation:       'Autre',
}

const CHANNEL_LABELS = {
  appel: 'Appel tél.', email: 'Email', whatsapp: 'WhatsApp',
  presentiel: 'Présentiel', client_web: 'Demande client (web)',
  runcharge: 'GreenYellow', smartenergy: 'Smart Energies', autre: 'Autre',
}

const STATUS_MAP = {
  nouveau:    { label: 'Nouveau',    color: '#ea580c', bg: '#fff7ed' },
  en_cours:   { label: 'En cours',   color: '#d97706', bg: '#fffbeb' },
  en_attente: { label: 'En attente', color: '#7c3aed', bg: '#f5f3ff' },
  incomplet:  { label: 'Incomplet',  color: '#ca8a04', bg: '#fefce8' },
  termine:    { label: 'Terminé',    color: '#16a34a', bg: '#f0fdf4' },
  ferme:      { label: 'Fermé',      color: '#64748b', bg: '#f1f5f9' },
  annule:     { label: 'Annulé',     color: '#dc2626', bg: '#fef2f2' },
}

function docStatus(bon, photos, factureUrl) {
  const hasBon = !!bon, hasPhotos = !!(photos?.length), hasFacture = !!factureUrl
  if (hasBon && hasPhotos && hasFacture) return 'ferme'
  if (hasBon && hasPhotos)               return 'termine'
  if (hasBon || hasPhotos || hasFacture) return 'incomplet'
  return null
}

async function downloadFile(url, filename) {
  try {
    const resp = await fetch(url)
    const blob = await resp.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
  } catch { window.open(url, '_blank') }
}

function Lightbox({ photos, index, onClose }) {
  const [current, setCurrent] = useState(index)
  const [dir, setDir] = useState(null)
  const photo = photos[current]
  const hasPrev = current > 0
  const hasNext = current < photos.length - 1

  const navigate = (next) => { setDir(next > current ? 'right' : 'left'); setCurrent(next) }

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && hasPrev) navigate(current - 1)
      if (e.key === 'ArrowRight' && hasNext) navigate(current + 1)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [hasPrev, hasNext, current])

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 200 }} onClick={onClose}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px' }} onClick={e => e.stopPropagation()}>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{current + 1} / {photos.length}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => downloadFile(photo.url, photo.filename)} className="tkm-lb-btn">
              <Download size={14} /> Télécharger
            </button>
            <button onClick={onClose} className="tkm-lb-close"><X size={18} /></button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: '16px 64px', overflow: 'hidden' }}>
          {hasPrev && <button onClick={e => { e.stopPropagation(); navigate(current - 1) }} className="tkm-lb-arrow tkm-lb-arrow--left"><ChevronLeft size={24} /></button>}
          <img key={current} src={photo.url} alt={photo.filename} onClick={e => e.stopPropagation()} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
          {hasNext && <button onClick={e => { e.stopPropagation(); navigate(current + 1) }} className="tkm-lb-arrow tkm-lb-arrow--right"><ChevronRight size={24} /></button>}
        </div>

        {photos.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '12px 20px' }} onClick={e => e.stopPropagation()}>
            {photos.map((p, idx) => (
              <button key={idx} onClick={() => navigate(idx)} style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', opacity: idx === current ? 1 : 0.4, outline: idx === current ? '2px solid #f97316' : 'none', border: 'none', cursor: 'pointer' }}>
                <img src={p.url} alt={p.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}

export function TicketModal({ ticket, onClose, onUpdate }) {
  const [lightboxIndex, setLightboxIndex] = useState(null)
  const [bonOpen, setBonOpen]             = useState(false)
  const [factureOpen, setFactureOpen]     = useState(false)
  const [photosOpen, setPhotosOpen]       = useState(false)
  const [descEditing, setDescEditing]     = useState(false)
  const [descValue, setDescValue]         = useState(ticket.description ?? '')
  const [docsAdding, setDocsAdding]       = useState(false)
  const [docName, setDocName]             = useState('')
  const [docFile, setDocFile]             = useState(null)
  const [docSaving, setDocSaving]         = useState(false)

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && lightboxIndex === null && !bonOpen && !factureOpen && !photosOpen) onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose, lightboxIndex, bonOpen, factureOpen, photosOpen])

  const bonData         = ticket.bon_data    ?? null
  const isNonFacturable = ticket.facture_url === 'non_facturable'
  const factureData     = ticket.facture_url && !isNonFacturable ? { url: ticket.facture_url } : null
  const photosData      = ticket.photos?.length ? ticket.photos : []

  const installationLabel = INSTALL_LABELS[ticket.installation_type]
  const channelLabel      = CHANNEL_LABELS[ticket.channel]
  const statusInfo        = STATUS_MAP[ticket.status] || { label: ticket.status, color: '#64748b', bg: '#f1f5f9' }

  const assignees = Array.isArray(ticket.assigned_to)
    ? ticket.assigned_to
    : (ticket.assigned_to ? [ticket.assigned_to] : [])

  const metaParts = []
  if (assignees.length) metaParts.push(`Assigné à ${assignees.join(', ')}`)
  metaParts.push(`Créé le ${new Date(ticket.created_at).toLocaleDateString('fr-FR')}`)
  if (ticket.updated_at !== ticket.created_at) metaParts.push(`mis à jour le ${new Date(ticket.updated_at).toLocaleDateString('fr-FR')}`)

  const saveBon = async (data) => {
    const s = docStatus(data, ticket.photos, ticket.facture_url)
    const statusUpdate = s && ticket.status !== 'ferme' ? { status: s } : {}
    await onUpdate(ticket.id, { bon_data: data, ...statusUpdate })
  }

  const saveFacture = async ({ url, amount }) => {
    const s = docStatus(ticket.bon_data, ticket.photos, url)
    const statusUpdate = s && ticket.status !== 'ferme' ? { status: s } : {}
    await onUpdate(ticket.id, { facture_url: url, facture_amount: amount ?? null, ...statusUpdate })
  }

  const markNonFacturable   = async () => {
    const s = docStatus(ticket.bon_data, ticket.photos, 'non_facturable')
    const statusUpdate = s && ticket.status !== 'ferme' ? { status: s } : {}
    await onUpdate(ticket.id, { facture_url: 'non_facturable', ...statusUpdate })
  }
  const clearNonFacturable  = async () => { await onUpdate(ticket.id, { facture_url: null }) }

  const openDocPicker = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.style.display = 'none'
    input.onchange = (e) => { const f = e.target.files?.[0]; if (f) setDocFile(f); input.remove() }
    document.body.appendChild(input); input.click()
  }

  const addDocument = async () => {
    if (!docFile || !docName.trim()) return
    setDocSaving(true)
    try {
      const url = await uploadFile(ticket.id, `documents/${Date.now()}_${docFile.name}`, docFile, docFile.type)
      const updated = [...(ticket.documents ?? []), { name: docName.trim(), url, filename: docFile.name, size: docFile.size }]
      await onUpdate(ticket.id, { documents: updated })
      setDocsAdding(false); setDocName(''); setDocFile(null)
    } catch { alert("Erreur lors de l'upload du document.") }
    finally { setDocSaving(false) }
  }

  const removeDocument = async (idx) => {
    const updated = (ticket.documents ?? []).filter((_, i) => i !== idx)
    await onUpdate(ticket.id, { documents: updated })
  }

  const savePhotos = async (arr) => {
    const photos = arr.length ? arr : null
    const s = docStatus(ticket.bon_data, photos, ticket.facture_url)
    const statusUpdate = s && ticket.status !== 'ferme' ? { status: s } : {}
    await onUpdate(ticket.id, { photos, ...statusUpdate })
  }

  const downloadAllPhotos = async () => {
    for (const p of photosData) { await downloadFile(p.url, p.filename); await new Promise(r => setTimeout(r, 300)) }
  }

  return (
    <>
      {lightboxIndex !== null && <Lightbox photos={photosData} index={lightboxIndex} onClose={() => setLightboxIndex(null)} />}
      {bonOpen     && <BonInterventionModal ticket={ticket} initialData={bonData} onConfirm={saveBon} onClose={() => setBonOpen(false)} />}
      {factureOpen && <FactureModal ticket={ticket} onConfirm={saveFacture} onClose={() => setFactureOpen(false)} />}
      {photosOpen  && <PhotosModal ticket={ticket} initialPhotos={photosData} onConfirm={savePhotos} onClose={() => setPhotosOpen(false)} />}

      <div className="tkm-overlay" onClick={onClose} />

      <div className="tkm-wrap">
        <div className="tkm-modal tkm-modal--detail">

          {/* En-tête */}
          <div className="tkm-detail-header">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span className="tkm-ref" style={{ fontSize: 12, padding: '3px 8px', background: '#fff7ed', borderRadius: 6 }}>{ticket.reference ?? '—'}</span>
                <span style={{ background: statusInfo.bg, color: statusInfo.color, fontSize: 11.5, fontWeight: 600, padding: '3px 9px', borderRadius: 99 }}>{statusInfo.label}</span>
              </div>
              <button onClick={onClose} className="tkm-close"><X size={18} /></button>
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div className="tkm-detail-avatar">
                {(ticket.client_name || ticket.client_firstname)?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>
                    {[ticket.client_name, ticket.client_firstname].filter(Boolean).join(' ')}
                  </span>
                  {ticket.phone && <span style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, color: '#64748b' }}><Phone size={13} />{ticket.phone}</span>}
                  {ticket.email && <span style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 12, color: '#64748b' }}><Mail size={13} />{ticket.email}</span>}
                </div>
                <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                  {new Date(ticket.created_at).toLocaleDateString('fr-FR')}
                  {channelLabel && <span> · via {channelLabel}</span>}
                  {installationLabel && <span> · {installationLabel}</span>}
                </p>
                {(ticket.address || ticket.postal_code || ticket.commune) && (
                  <p style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                    {[ticket.address, [ticket.postal_code, ticket.commune].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Corps */}
          <div className="tkm-detail-body">

            {ticket.b2b_entity && (
              <p style={{ fontSize: 12, color: '#64748b' }}>Entité : <strong style={{ color: '#1e293b' }}>{ticket.b2b_entity}</strong></p>
            )}

            {ticket.maintenance_contract && (
              <p style={{ fontSize: 12, color: '#64748b' }}>
                Contrat de maintenance :{' '}
                <strong style={{ color: ticket.maintenance_contract === 'oui' ? '#16a34a' : '#ef4444' }}>
                  {ticket.maintenance_contract.charAt(0).toUpperCase() + ticket.maintenance_contract.slice(1)}
                </strong>
              </p>
            )}

            {/* Description */}
            <div style={{ position: 'relative' }} className="tkm-desc-group">
              {descEditing ? (
                <div>
                  <textarea
                    autoFocus value={descValue} onChange={e => setDescValue(e.target.value)}
                    rows={5} className="tkm-desc-textarea"
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                    <button onClick={async () => { await onUpdate(ticket.id, { description: descValue }); setDescEditing(false) }} className="tkm-desc-save">
                      <Check size={13} /> Enregistrer
                    </button>
                    <button onClick={() => { setDescValue(ticket.description ?? ''); setDescEditing(false) }} className="tkm-desc-cancel">Annuler</button>
                  </div>
                </div>
              ) : (
                <>
                  {descValue
                    ? <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{descValue}</p>
                    : <p style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Aucune description fournie.</p>
                  }
                  <button onClick={() => setDescEditing(true)} className="tkm-desc-edit-btn" title="Modifier la description"><Pencil size={12} /></button>
                </>
              )}
            </div>

            {/* Éléments à facturer */}
            {bonData?.items_facturation?.length > 0 && (
              <div>
                <p className="tkm-section-label">Éléments à facturer</p>
                <ul style={{ paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {bonData.items_facturation.map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Dates */}
            {(ticket.intervention_date || bonData?.date) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ticket.intervention_date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarDays size={15} color="#f97316" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#c2410c' }}>
                      Intervention prévue le {new Date(ticket.intervention_date + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                )}
                {bonData?.date && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CalendarDays size={15} color="#16a34a" />
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#15803d' }}>Intervention réalisée le {bonData.date}</span>
                  </div>
                )}
              </div>
            )}

            {/* Photos */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p className="tkm-section-label">Photos {photosData.length > 0 && `(${photosData.length})`}</p>
                {photosData.length > 1 && (
                  <button onClick={downloadAllPhotos} className="tkm-link-btn"><Download size={13} /> Tout télécharger</button>
                )}
              </div>
              <div className="tkm-photos-mini-grid">
                {photosData.map((p, idx) => (
                  <button key={idx} onClick={() => setLightboxIndex(idx)} className="tkm-photo-mini">
                    <img src={p.url} alt={p.filename} />
                  </button>
                ))}
                <button onClick={() => setPhotosOpen(true)} className="tkm-photo-add">
                  <Plus size={18} color="#94a3b8" />
                </button>
              </div>
            </div>

            {/* Voir les documents */}
            {(bonData || factureData || isNonFacturable) && (
              <div>
                <p className="tkm-section-label">Voir les documents</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {bonData && (
                    <button onClick={() => generateBonIntervention(ticket, bonData).catch(() => {})} className="tkm-doc-btn">
                      <div className="tkm-doc-btn-icon"><Download size={15} color="#ea580c" /></div>
                      <div><p className="tkm-doc-btn-name">Bon d'intervention</p><p className="tkm-doc-btn-sub">Ouvrir le PDF</p></div>
                    </button>
                  )}
                  {factureData && (
                    <button onClick={() => window.open(ticket.facture_url, '_blank')} className="tkm-doc-btn">
                      <div className="tkm-doc-btn-icon"><Download size={15} color="#ea580c" /></div>
                      <div><p className="tkm-doc-btn-name">Facture</p><p className="tkm-doc-btn-sub">Ouvrir le PDF</p></div>
                    </button>
                  )}
                  {isNonFacturable && (
                    <div className="tkm-doc-btn tkm-doc-btn--na">
                      <div className="tkm-doc-btn-icon"><Ban size={15} color="#94a3b8" /></div>
                      <div><p className="tkm-doc-btn-name" style={{ color: '#64748b' }}>Dossier non facturable</p></div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Modification des documents */}
            <div>
              <p className="tkm-section-label">Modification des documents</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => setBonOpen(true)} className="tkm-doc-btn">
                  <div className="tkm-doc-btn-icon"><FileText size={15} color="#ea580c" /></div>
                  <div><p className="tkm-doc-btn-name">Bon d'intervention</p><p className="tkm-doc-btn-sub">{bonData ? 'Modifier' : 'Remplir'}</p></div>
                </button>
                <button onClick={() => setFactureOpen(true)} className="tkm-doc-btn">
                  <div className="tkm-doc-btn-icon"><FileDown size={15} color="#ea580c" /></div>
                  <div><p className="tkm-doc-btn-name">Facture</p><p className="tkm-doc-btn-sub">{factureData ? 'Modifier' : 'Ajouter'}</p></div>
                </button>
                {!factureData && !bonData?.items_facturation?.length && (
                  <button onClick={isNonFacturable ? clearNonFacturable : markNonFacturable} className={`tkm-doc-btn${isNonFacturable ? ' tkm-doc-btn--nf-active' : ''}`}>
                    <div className="tkm-doc-btn-icon"><Ban size={15} color="#64748b" /></div>
                    <div><p className="tkm-doc-btn-name" style={{ color: '#475569' }}>Non facturable</p><p className="tkm-doc-btn-sub">{isNonFacturable ? 'Annuler' : 'Marquer'}</p></div>
                  </button>
                )}
              </div>
            </div>

            {/* Autres documents */}
            <div>
              <p className="tkm-section-label">Autres documents</p>
              {(ticket.documents ?? []).map((doc, idx) => (
                <div key={idx} className="tkm-other-doc">
                  <div style={{ width: 28, height: 28, background: '#f1f5f9', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={14} color="#94a3b8" />
                  </div>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</span>
                  <button onClick={() => downloadFile(doc.url, doc.filename)} className="tkm-other-doc-btn" title="Télécharger"><Download size={13} /></button>
                  <button onClick={() => removeDocument(idx)} className="tkm-other-doc-btn tkm-other-doc-btn--del" title="Supprimer"><Trash2 size={13} /></button>
                </div>
              ))}
              {docsAdding ? (
                <div className="tkm-doc-add-form">
                  <input autoFocus type="text" placeholder="Nom du document (ex : Devis, Attestation…)" value={docName}
                    onChange={e => setDocName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') openDocPicker() }}
                    className="tkm-input" />
                  {docFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8 }}>
                      <Check size={14} color="#16a34a" />
                      <span style={{ flex: 1, fontSize: 12, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis' }}>{docFile.name}</span>
                      <button onClick={() => setDocFile(null)} style={{ fontSize: 12, color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer' }}>Changer</button>
                    </div>
                  ) : (
                    <button onClick={openDocPicker} className="tkm-doc-pick-btn">Choisir un fichier…</button>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={addDocument} disabled={!docFile || !docName.trim() || docSaving} className="tkm-btn-primary" style={{ flex: 1 }}>
                      {docSaving ? 'Upload…' : 'Ajouter'}
                    </button>
                    <button onClick={() => { setDocsAdding(false); setDocName(''); setDocFile(null) }} className="tkm-btn-cancel">Annuler</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setDocsAdding(true)} className="tkm-doc-add-btn">
                  <Plus size={15} /> Ajouter un document
                </button>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="tkm-detail-footer">
            <p style={{ fontSize: 12, color: '#94a3b8' }}>{metaParts.join(' · ')}</p>
            <button onClick={onClose} className="tkm-btn-cancel">Fermer</button>
          </div>

        </div>
      </div>
    </>
  )
}
