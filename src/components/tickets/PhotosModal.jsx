import { useState, useRef, useCallback } from 'react'
import { X, Image, Camera, Trash2 } from 'lucide-react'
import { uploadFile } from '../../lib/ilioStorage'

export function PhotosModal({ ticket, onClose, onConfirm, initialPhotos = [] }) {
  const [photos, setPhotos] = useState(
    initialPhotos.map(p => ({ url: p.url, filename: p.filename }))
  )
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving]     = useState(false)
  const inputRef  = useRef(null)
  const cameraRef = useRef(null)

  const clientName = [ticket.client_name, ticket.client_firstname].filter(Boolean).join(' ')

  const addFiles = useCallback((files) => {
    const newPhotos = Array.from(files)
      .filter(f => f.type.startsWith('image/'))
      .map(f => ({ file: f, filename: f.name, preview: URL.createObjectURL(f) }))
    setPhotos(prev => [...prev, ...newPhotos])
  }, [])

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files)
  }, [addFiles])

  const remove = (idx) => {
    setPhotos(prev => {
      const p = prev[idx]
      if (p.preview) URL.revokeObjectURL(p.preview)
      return prev.filter((_, i) => i !== idx)
    })
  }

  const handleConfirm = async () => {
    setSaving(true)
    try {
      const result = []
      for (const p of photos) {
        if (p.url) {
          result.push({ url: p.url, filename: p.filename })
        } else {
          const url = await uploadFile(ticket.id, `photos/${Date.now()}_${p.filename}`, p.file, p.file.type)
          result.push({ url, filename: p.filename })
        }
      }
      onConfirm(result)
      onClose()
    } catch {
      alert("Erreur lors de l'upload des photos.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="tkm-overlay" onClick={onClose} />
      <div className="tkm-wrap">
        <div className="tkm-modal tkm-modal--md">

          <div className="tkm-header">
            <div>
              <h2 className="tkm-header-title">
                {initialPhotos.length ? 'Modifier les photos' : 'Ajouter des photos'}
              </h2>
              <p className="tkm-header-sub"><span className="tkm-ref">{ticket.reference}</span> · {clientName}</p>
            </div>
            <button className="tkm-close" onClick={onClose}><X size={18} /></button>
          </div>

          <div className="tkm-body">
            <div className="tkm-photos-upload-row">

              <div
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onClick={() => inputRef.current?.click()}
                className={`tkm-dropzone tkm-dropzone--photos${dragging ? ' tkm-dropzone--drag' : ''}`}
              >
                <input ref={inputRef} type="file" accept="image/*" multiple className="tkm-hidden" onChange={(e) => addFiles(e.target.files)} />
                <div className="tkm-dropzone-icon"><Image size={24} /></div>
                <p className="tkm-dropzone-title">{dragging ? 'Déposez les photos ici' : 'Glissez-déposez des photos'}</p>
                <p className="tkm-dropzone-hint">ou <span className="tkm-orange">parcourir</span> · JPG, PNG, WebP…</p>
              </div>

              <button onClick={() => cameraRef.current?.click()} className="tkm-camera-btn">
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="tkm-hidden" onChange={(e) => addFiles(e.target.files)} />
                <div className="tkm-dropzone-icon"><Camera size={24} /></div>
                <p className="tkm-dropzone-title">Prendre une photo</p>
              </button>

            </div>

            {photos.length > 0 && (
              <div className="tkm-photos-grid">
                {photos.map((p, idx) => (
                  <div key={idx} className="tkm-photo-thumb">
                    <img src={p.url ?? p.preview} alt={p.filename} />
                    <button onClick={() => remove(idx)} className="tkm-photo-del"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="tkm-footer">
            <span className="tkm-photos-count">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} className="tkm-btn-cancel">Annuler</button>
              <button onClick={handleConfirm} disabled={saving} className="tkm-btn-primary">
                {saving ? 'Upload…' : 'Confirmer'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
