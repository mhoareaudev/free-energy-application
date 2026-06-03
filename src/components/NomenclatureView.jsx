import { useState } from 'react'
import { Plus, Trash2, Download, Pencil, CheckCircle2 } from 'lucide-react'
import NomenclatureAddModal from './NomenclatureAddModal'
import { downloadNomenclaturePdf } from '../utils/generateNomenclaturePdf'
import './NomenclatureView.css'

export const NOMENCLATURE_CATEGORIES = [
  { id: 'cheminement',    label: 'CHEMINEMENT' },
  { id: 'electricite',    label: 'ÉLECTRICITÉ' },
  { id: 'cable',          label: 'CÂBLE' },
  { id: 'securite',       label: 'SÉCURITÉ' },
  { id: 'onduleur',       label: 'ONDULEUR' },
  { id: 'structure',      label: 'STRUCTURE' },
  { id: 'b_exterieurs',   label: 'B. EXTÉRIEURS' },
  { id: 'mise_a_la_terre',label: 'MISE À LA TERRE' },
  { id: 'panneaux',       label: 'PANNEAUX' },
]

export default function NomenclatureView({ initialData, onSubmit, onSave, onCancel, clientData }) {
  const [items, setItems] = useState(initialData?.items || [])
  const [validated, setValidated] = useState(initialData?.validated || false)
  const [editMode, setEditMode] = useState(!initialData?.validated)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addingToCategory, setAddingToCategory] = useState(null)

  const handleAddItem = (item) => {
    setItems(prev => [...prev, item])
  }

  const handleRemoveItem = (globalIdx) => {
    setItems(prev => prev.filter((_, i) => i !== globalIdx))
  }

  const handleQuantityChange = (globalIdx, value) => {
    setItems(prev => prev.map((item, i) =>
      i === globalIdx ? { ...item, quantite: value } : item
    ))
  }

  const handleValidate = () => {
    setValidated(true)
    setEditMode(false)
    onSubmit({ items, validated: true })
  }

  const handleSave = () => {
    onSave({ items, validated: false })
  }

  const openAddModal = (categoryId) => {
    setAddingToCategory(categoryId)
    setShowAddModal(true)
  }

  return (
    <div className="nom-view">
      {/* ── Header ── */}
      <div className="nom-view-header">
        {validated && !editMode ? (
          <button className="nom-btn nom-btn--modifier" onClick={() => setEditMode(true)}>
            <Pencil size={13} /> Modifier
          </button>
        ) : null}
        <button
          className="nom-btn nom-btn--download"
          title="Télécharger"
          disabled={items.length === 0}
          onClick={() => downloadNomenclaturePdf(clientData, { items })}
        >
          <Download size={13} /> Télécharger
        </button>
        {validated && !editMode ? (
          <span className="nom-badge-validated">
            <CheckCircle2 size={13} /> Validée
          </span>
        ) : (
          <>
            {items.length > 0 && initialData?.items?.length > 0 && !validated && (
              <span className="nom-badge-draft">Brouillon</span>
            )}
            <button className="nom-btn nom-btn--save" onClick={handleSave}>
              Sauvegarder
            </button>
            <button className="nom-btn nom-btn--validate" onClick={handleValidate}>
              Valider
            </button>
          </>
        )}
      </div>

      {/* ── Tables by category ── */}
      <div className="nom-tables">
        {NOMENCLATURE_CATEGORIES.map(cat => {
          const catItems = items
            .map((item, globalIdx) => ({ item, globalIdx }))
            .filter(({ item }) => item.categorie === cat.id)

          if (catItems.length === 0 && !editMode) return null

          return (
            <div key={cat.id} className="nom-category">
              <div className="nom-cat-header">{cat.label}</div>

              {catItems.length > 0 && (
                <table className="nom-table">
                  <thead>
                    <tr>
                      <th>Désignation</th>
                      <th className="nom-col-qty">Quantité</th>
                      <th className="nom-col-unit">Unité</th>
                      {editMode && <th className="nom-col-del" />}
                    </tr>
                  </thead>
                  <tbody>
                    {catItems.map(({ item, globalIdx }) => (
                      <tr key={globalIdx}>
                        <td>{item.designation}</td>
                        <td className="nom-col-qty">
                          {editMode ? (
                            <input
                              type="number"
                              min="0.01"
                              step="any"
                              value={item.quantite}
                              onChange={e => handleQuantityChange(globalIdx, e.target.value)}
                              className="nom-qty-input"
                            />
                          ) : item.quantite}
                        </td>
                        <td className="nom-col-unit">{item.unite}</td>
                        {editMode && (
                          <td className="nom-col-del">
                            <button
                              className="nom-del-btn"
                              onClick={() => handleRemoveItem(globalIdx)}
                              title="Supprimer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {editMode && (
                <button className="nom-add-row-btn" onClick={() => openAddModal(cat.id)}>
                  <Plus size={13} /> Ajouter
                </button>
              )}
            </div>
          )
        })}

        {items.length === 0 && !editMode && (
          <div className="nom-empty">Aucun élément dans la nomenclature.</div>
        )}
      </div>

      <NomenclatureAddModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddItem}
        defaultCategory={addingToCategory}
      />
    </div>
  )
}
