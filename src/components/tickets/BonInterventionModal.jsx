import { useState, useRef, useEffect } from 'react'
import { X, CheckCircle, Plus, Trash2 } from 'lucide-react'
import { uploadDataUrl } from '../../lib/ilioStorage'

export function BonInterventionModal({ ticket, onClose, onConfirm, initialData = null }) {
  const clientName = [ticket.client_name, ticket.client_firstname].filter(Boolean).join(' ')

  const defaultDate = initialData?.date
    ?? new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const [form, setForm] = useState({
    nom_responsable:   initialData?.nom_responsable   ?? '',
    marque:            initialData?.marque            ?? '',
    caracteristiques:  initialData?.caracteristiques  ?? '',
    objet:             initialData?.objet             ?? '',
    type_intervention: initialData?.type_intervention ?? '',
    rapport:           initialData?.rapport           ?? '',
    date:              defaultDate,
  })
  const [items, setItems]           = useState(initialData?.items_facturation ?? [])
  const [newItem, setNewItem]       = useState('')
  const [confirming, setConfirming] = useState(false)
  const [done, setDone]             = useState(false)

  const techSigRef   = useRef(null)
  const clientSigRef = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const set = (field) => (e) => setForm(prev => ({ ...prev, [field]: e.target.value }))

  const addItem = () => {
    const v = newItem.trim()
    if (!v) return
    setItems(prev => [...prev, v])
    setNewItem('')
  }

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  const handleConfirm = async () => {
    setConfirming(true)
    try {
      let sig_tech_url   = initialData?.sig_tech_url   ?? null
      let sig_client_url = initialData?.sig_client_url ?? null

      if (canvasHasContent(techSigRef.current))
        sig_tech_url = await uploadDataUrl(ticket.id, 'sig_tech.png', techSigRef.current.toDataURL('image/png'))
      if (canvasHasContent(clientSigRef.current))
        sig_client_url = await uploadDataUrl(ticket.id, 'sig_client.png', clientSigRef.current.toDataURL('image/png'))

      onConfirm({ ...form, sig_tech_url, sig_client_url, items_facturation: items })
      setDone(true)
      setTimeout(onClose, 1400)
    } catch {
      alert("Erreur lors de l'enregistrement du bon d'intervention.")
    } finally {
      setConfirming(false)
    }
  }

  if (done) return (
    <>
      <div className="tkm-overlay" />
      <div className="tkm-wrap">
        <div className="tkm-success-card">
          <div className="tkm-success-icon"><CheckCircle size={32} color="#16a34a" /></div>
          <p className="tkm-success-title">Bon d'intervention enregistré</p>
          <p className="tkm-success-sub">Les informations seront incluses lors de la génération du PDF.</p>
        </div>
      </div>
    </>
  )

  return (
    <>
      <div className="tkm-overlay" onClick={onClose} />
      <div className="tkm-wrap">
        <div className="tkm-modal tkm-modal--lg">

          <div className="tkm-header">
            <div>
              <h2 className="tkm-header-title">
                {initialData ? "Modifier le bon d'intervention" : "Remplir le bon d'intervention"}
              </h2>
              <p className="tkm-header-sub">
                <span className="tkm-ref">{ticket.reference}</span> · {clientName}
              </p>
            </div>
            <button className="tkm-close" onClick={onClose}><X size={18} /></button>
          </div>

          <div className="tkm-body">

            <div className="tkm-field">
              <label className="tkm-field-label">Nom du responsable</label>
              <input type="text" value={form.nom_responsable} onChange={set('nom_responsable')} placeholder="Ex : Jean DUPONT" className="tkm-input" />
            </div>

            <BonSection title="Matériel">
              <div className="tkm-field">
                <label className="tkm-field-label-sm">Marque</label>
                <input type="text" value={form.marque} onChange={set('marque')} placeholder="Ex : Atlantic, Daikin…" className="tkm-input" />
              </div>
              <div className="tkm-field">
                <label className="tkm-field-label-sm">Caractéristiques</label>
                <input type="text" value={form.caracteristiques} onChange={set('caracteristiques')} placeholder="Modèle, puissance, référence…" className="tkm-input" />
              </div>
            </BonSection>

            <BonSection title="Intervention">
              <div className="tkm-grid-2">
                <div className="tkm-field">
                  <label className="tkm-field-label-sm">Date</label>
                  <input type="text" value={form.date} onChange={set('date')} placeholder="JJ/MM/AAAA" className="tkm-input" />
                </div>
                <div className="tkm-field">
                  <label className="tkm-field-label-sm">Type</label>
                  <input type="text" value={form.type_intervention} onChange={set('type_intervention')} placeholder="Dépannage, maintenance…" className="tkm-input" />
                </div>
              </div>
              <div className="tkm-field">
                <label className="tkm-field-label-sm">Objet</label>
                <textarea value={form.objet} onChange={set('objet')} rows={3} placeholder="Décrire l'objet de l'intervention…" className="tkm-textarea" />
              </div>
            </BonSection>

            <BonSection title="Rapport">
              <textarea value={form.rapport} onChange={set('rapport')} rows={4} placeholder="Compte-rendu de l'intervention…" className="tkm-textarea" />
            </BonSection>

            <BonSection title="Éléments à facturer">
              <div className="tkm-items-list">
                {items.map((item, idx) => (
                  <div key={idx} className="tkm-item-row">
                    <span className="tkm-item-text">{item}</span>
                    <button type="button" onClick={() => removeItem(idx)} className="tkm-item-del"><Trash2 size={14} /></button>
                  </div>
                ))}
                <div className="tkm-item-add-row">
                  <input
                    type="text" value={newItem} onChange={e => setNewItem(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem() } }}
                    placeholder="Ex : Main d'œuvre, Déplacement…" className="tkm-input"
                  />
                  <button type="button" onClick={addItem} className="tkm-btn-icon-orange"><Plus size={16} /></button>
                </div>
                {items.length === 0 && <p className="tkm-empty-text">Aucun élément — ajoutez ce qui est à facturer.</p>}
              </div>
            </BonSection>

            <div className="tkm-sig-grid">
              <BonSection title="Technicien">
                <div className="tkm-field">
                  <label className="tkm-field-label-sm">Nom</label>
                  <input type="text" value={form.nom_responsable || '—'} readOnly className="tkm-input tkm-input--readonly" />
                </div>
                <div className="tkm-field">
                  <label className="tkm-field-label-sm">Date</label>
                  <input type="text" value={form.date} readOnly className="tkm-input tkm-input--readonly" />
                </div>
                <div className="tkm-field">
                  <label className="tkm-field-label-sm">Signature</label>
                  <SignatureCanvas canvasRef={techSigRef} initialImage={initialData?.sig_tech_url} />
                </div>
              </BonSection>

              <BonSection title="Client">
                <div className="tkm-field">
                  <label className="tkm-field-label-sm">Nom</label>
                  <input type="text" value={clientName || '—'} readOnly className="tkm-input tkm-input--readonly" />
                </div>
                <div className="tkm-field">
                  <label className="tkm-field-label-sm">Date</label>
                  <input type="text" value={form.date} readOnly className="tkm-input tkm-input--readonly" />
                </div>
                <div className="tkm-field">
                  <label className="tkm-field-label-sm">Signature</label>
                  <SignatureCanvas canvasRef={clientSigRef} initialImage={initialData?.sig_client_url} />
                </div>
              </BonSection>
            </div>

          </div>

          <div className="tkm-footer">
            <button onClick={onClose} className="tkm-btn-cancel">Annuler</button>
            <button onClick={handleConfirm} disabled={confirming} className="tkm-btn-primary">
              {confirming ? 'Enregistrement…' : 'Confirmer'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}

function BonSection({ title, children }) {
  return (
    <div className="tkm-bon-section">
      <div className="tkm-bon-section-header"><span>{title}</span></div>
      <div className="tkm-bon-section-body">{children}</div>
    </div>
  )
}

function SignatureCanvas({ canvasRef, initialImage }) {
  const drawing = useRef(false)

  useEffect(() => {
    if (!initialImage || !canvasRef.current) return
    const canvas = canvasRef.current
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    img.src = initialImage
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'

    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect()
      const src  = e.touches ? e.touches[0] : e
      return { x: (src.clientX - rect.left) * (canvas.width / rect.width), y: (src.clientY - rect.top) * (canvas.height / rect.height) }
    }
    const start = (e) => { e.preventDefault(); drawing.current = true; const p = getPos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y) }
    const move  = (e) => { e.preventDefault(); if (!drawing.current) return; const p = getPos(e); ctx.lineTo(p.x, p.y); ctx.stroke() }
    const stop  = () => { drawing.current = false }

    canvas.addEventListener('mousedown', start)
    canvas.addEventListener('mousemove', move)
    canvas.addEventListener('mouseup', stop)
    canvas.addEventListener('mouseleave', stop)
    canvas.addEventListener('touchstart', start, { passive: false })
    canvas.addEventListener('touchmove', move, { passive: false })
    canvas.addEventListener('touchend', stop)
    return () => {
      canvas.removeEventListener('mousedown', start)
      canvas.removeEventListener('mousemove', move)
      canvas.removeEventListener('mouseup', stop)
      canvas.removeEventListener('mouseleave', stop)
      canvas.removeEventListener('touchstart', start)
      canvas.removeEventListener('touchmove', move)
      canvas.removeEventListener('touchend', stop)
    }
  }, [canvasRef])

  const clear = () => canvasRef.current?.getContext('2d').clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

  return (
    <div>
      <canvas ref={canvasRef} width={300} height={140} className="tkm-sig-canvas" />
      <button type="button" onClick={clear} className="tkm-sig-clear">Effacer</button>
    </div>
  )
}

function canvasHasContent(canvas) {
  if (!canvas) return false
  return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some(v => v !== 0)
}
