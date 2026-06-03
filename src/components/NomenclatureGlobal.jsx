import { useEffect, useRef, useState } from 'react'
import { FileText, Download, Pencil } from 'lucide-react'
import { generateNomenclaturePdf, downloadNomenclaturePdf } from '../utils/generateNomenclaturePdf'
import './NomenclatureGlobal.css'

export default function NomenclatureGlobal({ clientData, nomenclatureData, onEdit }) {
  const [pdfUrl, setPdfUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const prevUrlRef = useRef(null)

  const hasItems = (nomenclatureData?.items?.length || 0) > 0

  useEffect(() => {
    if (!hasItems) {
      setPdfUrl(null)
      return
    }

    let cancelled = false
    setLoading(true)

    generateNomenclaturePdf(clientData, nomenclatureData)
      .then(bytes => {
        if (cancelled) return
        if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current)
        const blob = new Blob([bytes], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        prevUrlRef.current = url
        setPdfUrl(url)
      })
      .catch(err => console.warn('Nomenclature PDF generation failed:', err))
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [clientData, nomenclatureData])

  useEffect(() => {
    return () => { if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current) }
  }, [])

  if (!hasItems) {
    return (
      <div className="nomg-empty">
        <FileText size={36} strokeWidth={1.5} />
        <p>Aucune nomenclature</p>
        <span>Créez et sauvegardez une nomenclature dans l'onglet "Suivi de dossier".</span>
      </div>
    )
  }

  return (
    <div className="nomg-pdf-wrapper">
      <div className="nomg-pdf-toolbar">
        {onEdit && (
          <button className="nomg-edit-btn" onClick={onEdit}>
            <Pencil size={13} /> Modifier
          </button>
        )}
        <button
          className="nomg-dl-btn"
          onClick={() => downloadNomenclaturePdf(clientData, nomenclatureData)}
          disabled={!pdfUrl}
        >
          <Download size={13} /> Télécharger le PDF
        </button>
      </div>
      <div className="nomg-pdf-container">
        {loading && (
          <div className="nomg-loading">Génération du PDF...</div>
        )}
        {pdfUrl && !loading && (
          <iframe
            key={pdfUrl}
            src={pdfUrl}
            title="Nomenclature PDF"
            className="nomg-pdf-iframe"
          />
        )}
      </div>
    </div>
  )
}
