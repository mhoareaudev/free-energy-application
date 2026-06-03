import { useState, useEffect, useRef } from 'react'
import { X, Search, Plus, Check, Package } from 'lucide-react'
import { supabaseGet, supabasePost } from '../lib/supabase'
import { NOMENCLATURE_CATEGORIES } from './NomenclatureView'
import './NomenclatureAddModal.css'

const UNITS = ['unité', 'm', 'ml', 'sachet', 'boîte', 'rouleau', 'lot', 'kg']

export default function NomenclatureAddModal({ isOpen, onClose, onAdd, defaultCategory }) {
  const [catalog, setCatalog] = useState([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [search, setSearch] = useState('')

  // Item selection step
  const [selectedItem, setSelectedItem] = useState(null)
  const [quantite, setQuantite] = useState('1')

  // Create mode
  const [showCreate, setShowCreate] = useState(false)
  const [newItem, setNewItem] = useState({ designation: '', unite: 'unité', categorie: defaultCategory || 'cheminement' })
  const [creating, setCreating] = useState(false)
  const [addedCount, setAddedCount] = useState(0)

  const searchRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      fetchCatalog()
      setSearch('')
      setSelectedItem(null)
      setQuantite('1')
      setShowCreate(false)
      setAddedCount(0)
      setNewItem({ designation: '', unite: 'unité', categorie: defaultCategory || 'cheminement' })
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [isOpen, defaultCategory])

  const fetchCatalog = async () => {
    setLoadingCatalog(true)
    try {
      const data = await supabaseGet('nomenclature_catalog', {
        select: '*',
        order: 'designation.asc',
      })
      setCatalog(data)
    } catch (e) {
      console.warn('Could not load nomenclature catalog:', e)
    } finally {
      setLoadingCatalog(false)
    }
  }

  const handleSelectItem = (item) => {
    setSelectedItem(item)
    setQuantite('1')
  }

  const handleAdd = () => {
    if (!selectedItem || !quantite) return
    onAdd({
      designation: selectedItem.designation,
      quantite: parseFloat(quantite) || 1,
      unite: selectedItem.unite,
      categorie: selectedItem.categorie,
    })
    setAddedCount(c => c + 1)
    setSelectedItem(null)
    setQuantite('1')
    // Refocus search for next item
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  const handleCreate = async () => {
    if (!newItem.designation.trim()) return
    setCreating(true)
    try {
      const created = await supabasePost('nomenclature_catalog', {
        designation: newItem.designation.trim(),
        unite: newItem.unite,
        categorie: newItem.categorie,
      })
      setCatalog(prev =>
        [...prev, created].sort((a, b) => a.designation.localeCompare(b.designation))
      )
      setShowCreate(false)
      setSelectedItem(created)
      setQuantite('1')
    } catch (e) {
      console.error('Error creating catalog item:', e)
    } finally {
      setCreating(false)
    }
  }

  // Filter catalog
  const filteredCatalog = catalog.filter(item =>
    !search || item.designation.toLowerCase().includes(search.toLowerCase())
  )

  // Group by category — put defaultCategory first
  const sortedCategories = defaultCategory
    ? [
        ...NOMENCLATURE_CATEGORIES.filter(c => c.id === defaultCategory),
        ...NOMENCLATURE_CATEGORIES.filter(c => c.id !== defaultCategory),
      ]
    : NOMENCLATURE_CATEGORIES

  const grouped = sortedCategories.reduce((acc, cat) => {
    const items = filteredCatalog.filter(item => item.categorie === cat.id)
    if (items.length > 0) acc.push({ ...cat, items })
    return acc
  }, [])

  if (!isOpen) return null

  return (
    <div className="nom-modal-overlay" onClick={onClose}>
      <div className="nom-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="nom-modal-header">
          <div className="nom-modal-title">
            Ajouter un élément
            {addedCount > 0 && (
              <span className="nom-modal-added-badge">{addedCount} ajouté{addedCount > 1 ? 's' : ''}</span>
            )}
          </div>
          <button className="nom-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        {!selectedItem && !showCreate && (
          <div className="nom-modal-search">
            <Search size={15} className="nom-search-icon" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Rechercher un élément..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="nom-search-clear" onClick={() => setSearch('')}>
                <X size={13} />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="nom-modal-body">
          {selectedItem ? (
            /* ── Quantity step ── */
            <div className="nom-qty-step">
              <div className="nom-qty-item-info">
                <strong>{selectedItem.designation}</strong>
                <span className="nom-qty-unit">{selectedItem.unite}</span>
              </div>
              <div className="nom-qty-row">
                <label>Quantité</label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={quantite}
                  onChange={e => setQuantite(e.target.value)}
                  autoFocus
                  onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
                  className="nom-qty-field"
                />
              </div>
              <div className="nom-qty-actions">
                <button className="nom-action-btn nom-action-btn--secondary" onClick={() => setSelectedItem(null)}>
                  Retour
                </button>
                <button
                  className="nom-action-btn nom-action-btn--primary"
                  onClick={handleAdd}
                  disabled={!quantite || parseFloat(quantite) <= 0}
                >
                  <Check size={14} /> Ajouter
                </button>
              </div>
            </div>
          ) : showCreate ? (
            /* ── Create element ── */
            <div className="nom-create-step">
              <div className="nom-create-title">Créer un nouvel élément</div>
              <div className="nom-create-fields">
                <div className="nom-field">
                  <label>Désignation</label>
                  <input
                    type="text"
                    value={newItem.designation}
                    onChange={e => setNewItem(p => ({ ...p, designation: e.target.value }))}
                    placeholder="Nom de l'élément"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                  />
                </div>
                <div className="nom-create-row">
                  <div className="nom-field">
                    <label>Unité</label>
                    <select
                      value={newItem.unite}
                      onChange={e => setNewItem(p => ({ ...p, unite: e.target.value }))}
                    >
                      {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                  <div className="nom-field">
                    <label>Catégorie</label>
                    <select
                      value={newItem.categorie}
                      onChange={e => setNewItem(p => ({ ...p, categorie: e.target.value }))}
                    >
                      {NOMENCLATURE_CATEGORIES.map(c => (
                        <option key={c.id} value={c.id}>{c.label.charAt(0) + c.label.slice(1).toLowerCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="nom-create-actions">
                <button className="nom-action-btn nom-action-btn--secondary" onClick={() => setShowCreate(false)}>
                  Annuler
                </button>
                <button
                  className="nom-action-btn nom-action-btn--primary"
                  onClick={handleCreate}
                  disabled={creating || !newItem.designation.trim()}
                >
                  {creating ? 'Création...' : 'Créer et sélectionner'}
                </button>
              </div>
            </div>
          ) : (
            /* ── Catalog ── */
            <div className="nom-catalog">
              {loadingCatalog ? (
                <div className="nom-catalog-loading">Chargement du catalogue...</div>
              ) : grouped.length === 0 ? (
                <div className="nom-catalog-empty">
                  {search
                    ? `Aucun résultat pour "${search}"`
                    : 'Le catalogue est vide. Créez votre premier élément ci-dessous.'}
                </div>
              ) : (
                grouped.map(({ id, label, items }) => (
                  <div key={id} className="nom-catalog-section">
                    <div className="nom-catalog-cat">{label}</div>
                    <div className="nom-catalog-grid">
                      {items.map(item => (
                        <button
                          key={item.id}
                          className="nom-tile"
                          onClick={() => handleSelectItem(item)}
                        >
                          <Package size={18} className="nom-tile-icon" />
                          <span className="nom-tile-name">{item.designation}</span>
                          <span className="nom-tile-unit">{item.unite}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!selectedItem && !showCreate && (
          <div className="nom-modal-footer">
            <button className="nom-create-trigger" onClick={() => setShowCreate(true)}>
              <Plus size={14} />
              Créer un élément
            </button>
            <button className="nom-action-btn nom-action-btn--secondary" onClick={onClose}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
