import { useState, useCallback } from 'react'
import { X, Upload, CheckCircle } from 'lucide-react'
import { uploadFile } from '../../lib/ilioStorage'

export function FactureModal({ ticket, onClose, onConfirm }) {
  const [file, setFile]         = useState(null)
  const [amount, setAmount]     = useState('')
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving]     = useState(false)

  const clientName = [ticket.client_name, ticket.client_firstname].filter(Boolean).join(' ')

  const handleFile = (f) => {
    if (!f || f.type !== 'application/pdf') { alert('Veuillez sélectionner un fichier PDF.'); return }
    setFile(f)
  }

  const openFilePicker = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/pdf'
    input.style.display = 'none'
    input.onchange = (e) => { const f = e.target.files?.[0]; if (f) handleFile(f); input.remove() }
    document.body.appendChild(input)
    input.click()
  }

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0])
  }, [])

  const handleConfirm = async () => {
    if (!file) return
    setSaving(true)
    try {
      const url = await uploadFile(ticket.id, 'facture.pdf', file, file.type)
      await onConfirm({ url, filename: file.name, size: file.size, amount: amount ? parseFloat(amount) : null })
      onClose()
    } catch {
      alert("Erreur lors de l'upload de la facture.")
      setSaving(false)
    }
  }

  return (
    <>
      <div className="tkm-overlay" onClick={onClose} />
      <div className="tkm-wrap">
        <div className="tkm-modal tkm-modal--sm">

          <div className="tkm-header">
            <div>
              <h2 className="tkm-header-title">Ajouter la facture</h2>
              <p className="tkm-header-sub"><span className="tkm-ref">{ticket.reference}</span> · {clientName}</p>
            </div>
            <button className="tkm-close" onClick={onClose}><X size={18} /></button>
          </div>

          <div className="tkm-body">
            <div
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onClick={() => !file && openFilePicker()}
              className={`tkm-dropzone${dragging ? ' tkm-dropzone--drag' : file ? ' tkm-dropzone--done' : ''}`}
            >
              {file ? (
                <>
                  <div className="tkm-dropzone-icon tkm-dropzone-icon--green"><CheckCircle size={28} /></div>
                  <p className="tkm-dropzone-name">{file.name}</p>
                  <p className="tkm-dropzone-size">{formatSize(file.size)}</p>
                  <button onClick={(e) => { e.stopPropagation(); setFile(null); openFilePicker() }} className="tkm-link-btn">Changer de fichier</button>
                </>
              ) : (
                <>
                  <div className="tkm-dropzone-icon"><Upload size={28} /></div>
                  <p className="tkm-dropzone-title">{dragging ? 'Déposez le fichier ici' : 'Glissez-déposez votre facture'}</p>
                  <p className="tkm-dropzone-hint">ou <span className="tkm-orange">parcourir</span> · PDF uniquement</p>
                </>
              )}
            </div>

            <div className="tkm-field" style={{ marginTop: 16 }}>
              <label className="tkm-field-label">Montant</label>
              <div className="tkm-amount-wrap">
                <input
                  type="number" min="0" step="0.01" placeholder="0.00" value={amount}
                  onChange={e => setAmount(e.target.value)} className="tkm-input"
                />
                <span className="tkm-amount-symbol">€</span>
              </div>
            </div>
          </div>

          <div className="tkm-footer">
            <button onClick={onClose} className="tkm-btn-cancel">Annuler</button>
            <button onClick={handleConfirm} disabled={!file || saving} className="tkm-btn-primary">
              {saving ? 'Upload…' : 'Confirmer'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}

function formatSize(bytes) {
  if (bytes < 1024)         return bytes + ' o'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko'
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo'
}
