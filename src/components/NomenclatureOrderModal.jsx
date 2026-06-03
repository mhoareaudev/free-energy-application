import { useState, useEffect } from 'react'
import { X, Check } from 'lucide-react'
import { NOMENCLATURE_CATEGORIES } from './NomenclatureView'
import './NomenclatureOrderModal.css'

export default function NomenclatureOrderModal({ isOpen, onClose, items, onValidate }) {
  const [quantities, setQuantities] = useState({})

  useEffect(() => {
    if (!isOpen) return
    const init = {}
    items.forEach(item => {
      const key = item.designation.trim().toLowerCase()
      init[key] = String(item.quantite)
    })
    setQuantities(init)
  }, [isOpen, items])

  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const categoryOrder = NOMENCLATURE_CATEGORIES.map(c => c.id)
  const sortedItems = [...items].sort((a, b) => {
    const ia = categoryOrder.indexOf(a.categorie)
    const ib = categoryOrder.indexOf(b.categorie)
    if (ia !== ib) return ia - ib
    return a.designation.localeCompare(b.designation)
  })

  const handleValidate = () => {
    const result = {}
    Object.entries(quantities).forEach(([key, val]) => {
      result[key] = parseFloat(val) || 0
    })
    onValidate(result)
  }

  const handleBackdrop = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="order-overlay" onClick={handleBackdrop}>
      <div className="order-modal">
        <div className="order-header">
          <span className="order-title">Commande de matériel</span>
          <button className="order-close" onClick={onClose} title="Fermer">
            <X size={16} />
          </button>
        </div>

        <div className="order-body">
          <div className="order-table-wrap">
            <table className="order-table">
              <thead>
                <tr>
                  <th>Désignation</th>
                  <th className="order-col-unit">Unité</th>
                  <th className="order-col-num">Nécessaire</th>
                  <th className="order-col-num">Commandée</th>
                  <th className="order-col-num">Reste</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item, i) => {
                  const key = item.designation.trim().toLowerCase()
                  const necessaire = parseFloat(item.quantite) || 0
                  const commandee = parseFloat(quantities[key]) || 0
                  const reste = necessaire - commandee
                  const resteClass = reste > 0
                    ? 'reste-positive'
                    : reste < 0
                      ? 'reste-negative'
                      : 'reste-zero'

                  const qtyStr = Number.isInteger(necessaire)
                    ? String(necessaire)
                    : necessaire.toFixed(2)

                  const resteStr = Number.isInteger(reste)
                    ? String(reste)
                    : reste.toFixed(2)

                  return (
                    <tr key={i}>
                      <td>{item.designation}</td>
                      <td className="order-col-unit">{item.unite}</td>
                      <td className="order-col-num">{qtyStr}</td>
                      <td className="order-col-num">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          className="order-commandee-input"
                          value={quantities[key] ?? ''}
                          onChange={e => setQuantities(prev => ({ ...prev, [key]: e.target.value }))}
                        />
                      </td>
                      <td className={`order-col-num ${resteClass}`}>{resteStr}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="order-footer">
          <button className="order-btn order-btn--secondary" onClick={onClose}>
            Annuler
          </button>
          <button className="order-btn order-btn--primary" onClick={handleValidate}>
            <Check size={14} />
            Valider la commande
          </button>
        </div>
      </div>
    </div>
  )
}
