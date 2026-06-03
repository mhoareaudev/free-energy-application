import { useMemo, useState } from 'react'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import { NOMENCLATURE_CATEGORIES } from './NomenclatureView'
import { Download, RotateCcw, Package } from 'lucide-react'
import NomenclatureOrderModal from './NomenclatureOrderModal'
import { generateStockPdf } from '../utils/generateNomenclaturePdf'
import './NomenclatureStock.css'

function useStockData() {
  const { sheets } = useSpreadsheet()
  return useMemo(() => {
    const totals = {} // key → { designation, unite, categorie, quantite, sumValidated, offsetQ }

    // Parse stock offset
    let stockOffset = {}
    try {
      const raw = sheets['btoc-comptant']?.cells?.['__stock_offset']
      if (raw) stockOffset = JSON.parse(raw)
    } catch {}

    // Sum validated nomenclatures across all sheets
    Object.values(sheets).forEach(sheet => {
      Object.entries(sheet.cells || {}).forEach(([cellId, value]) => {
        if (!cellId.startsWith('__nomenclature:')) return
        try {
          const data = JSON.parse(value)
          if (!data?.validated) return
          ;(data.items || []).forEach(item => {
            const key = item.designation.trim().toLowerCase()
            const qty = parseFloat(item.quantite) || 0
            if (totals[key]) {
              totals[key].quantite += qty
              totals[key].sumValidated += qty
            } else {
              totals[key] = {
                designation: item.designation.trim(),
                unite: item.unite,
                categorie: item.categorie,
                quantite: qty,
                sumValidated: qty,
                offsetQ: 0,
              }
            }
          })
        } catch {}
      })
    })

    // Apply offsets (and add offset-only items)
    Object.entries(stockOffset).forEach(([key, off]) => {
      const offsetQ = off.q || 0
      if (totals[key]) {
        totals[key].quantite += offsetQ
        totals[key].offsetQ = offsetQ
      } else if (off.d) {
        totals[key] = {
          designation: off.d,
          unite: off.u || '',
          categorie: off.c || '',
          quantite: offsetQ,
          sumValidated: 0,
          offsetQ,
        }
      }
    })

    // Keep items with non-zero quantity (negative = over-ordered)
    return Object.values(totals).filter(i => i.quantite !== 0)
  }, [sheets])
}

export default function NomenclatureStock() {
  const { sheets, setCellValue, saveData } = useSpreadsheet()
  const items = useStockData()
  const [showOrderModal, setShowOrderModal] = useState(false)

  const handleDownload = async () => {
    await generateStockPdf(items)
  }

  const handleValidateOrder = async (commandedQuantities) => {
    // commandedQuantities = { [key]: number }

    // Load existing offset
    let stockOffset = {}
    try {
      const raw = sheets['btoc-comptant']?.cells?.['__stock_offset']
      if (raw) stockOffset = JSON.parse(raw)
    } catch {}

    // Compute new offset for each item
    items.forEach(item => {
      const key = item.designation.trim().toLowerCase()
      const commandee = parseFloat(commandedQuantities[key]) || 0
      const oldOffsetQ = stockOffset[key]?.q || 0
      const newOffsetQ = oldOffsetQ - commandee // reste becomes new base

      stockOffset[key] = {
        q: newOffsetQ,
        d: item.designation,
        u: item.unite,
        c: item.categorie,
      }
    })

    setCellValue('btoc-comptant', '__stock_offset', JSON.stringify(stockOffset))
    await saveData()
    setShowOrderModal(false)
  }

  return (
    <div className="stock-page">
      <div className="stock-header">
        <div>
          <div className="stock-title">Stock nomenclatures</div>
          <div className="stock-subtitle">
            {items.length} élément{items.length !== 1 ? 's' : ''} • Mis à jour automatiquement
          </div>
        </div>
        <div className="stock-actions">
          <button
            className="stock-btn stock-btn--secondary"
            onClick={() => setShowOrderModal(true)}
            disabled={items.length === 0}
            title="Remettre les totaux à 0"
          >
            <RotateCcw size={14} />
            Remettre les totaux à 0
          </button>
          <button
            className="stock-btn stock-btn--primary"
            onClick={handleDownload}
            disabled={items.length === 0}
            title="Télécharger le PDF"
          >
            <Download size={14} />
            Télécharger le PDF
          </button>
        </div>
      </div>

      <div className="stock-body">
        {items.length === 0 ? (
          <div className="stock-empty">
            <Package size={40} strokeWidth={1.5} />
            <div>Aucun élément en stock</div>
            <div style={{ fontSize: 12 }}>Validez des nomenclatures pour les voir apparaître ici</div>
          </div>
        ) : (
          NOMENCLATURE_CATEGORIES.map(cat => {
            const catItems = items.filter(item => item.categorie === cat.id)
            if (catItems.length === 0) return null
            return (
              <div key={cat.id} className="stock-category">
                <div className="stock-cat-header">{cat.label}</div>
                <table className="stock-table">
                  <thead>
                    <tr>
                      <th>Désignation</th>
                      <th className="stock-col-qty">Quantité</th>
                      <th className="stock-col-unit">Unité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map((item, i) => (
                      <tr key={i}>
                        <td>{item.designation}</td>
                        <td className="stock-col-qty">
                          {Number.isInteger(item.quantite)
                            ? item.quantite
                            : parseFloat(item.quantite.toFixed(2))}
                        </td>
                        <td className="stock-col-unit">{item.unite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })
        )}
      </div>

      <NomenclatureOrderModal
        isOpen={showOrderModal}
        onClose={() => setShowOrderModal(false)}
        items={items}
        onValidate={handleValidateOrder}
      />
    </div>
  )
}
