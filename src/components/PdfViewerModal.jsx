import { useState, useEffect } from 'react'
import { X, Download, Loader2 } from 'lucide-react'
import { generateVTPdf, downloadVTPdf } from '../utils/generateVTPdf'
import './Modal.css'

export default function PdfViewerModal({ isOpen, onClose, data }) {
  const [pdfUrl, setPdfUrl] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !data) {
      setPdfUrl(null)
      return
    }

    let url = null
    const generate = async () => {
      setLoading(true)
      try {
        const pdfBytes = await generateVTPdf(data)
        const blob = new Blob([pdfBytes], { type: 'application/pdf' })
        url = URL.createObjectURL(blob)
        setPdfUrl(url)
      } catch (err) {
        console.error('Error generating PDF:', err)
      } finally {
        setLoading(false)
      }
    }

    generate()

    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [isOpen, data])

  const handleDownload = async () => {
    if (!data) return
    const clientName = data.clientName || 'client'
    await downloadVTPdf(data, `VT_${clientName.replace(/\s+/g, '_')}.pdf`)
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-pdf" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Formulaire VT</h2>
          <div className="modal-header-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleDownload}
              title="Télécharger le PDF"
            >
              <Download size={16} />
              <span>Télécharger</span>
            </button>
            <button className="modal-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="modal-body pdf-viewer-body">
          {loading ? (
            <div className="pdf-loading">
              <Loader2 size={32} className="spinning" />
              <p>Génération du PDF...</p>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="pdf-iframe"
              title="Formulaire VT"
            />
          ) : (
            <div className="pdf-loading">
              <p>Erreur lors de la génération du PDF</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
