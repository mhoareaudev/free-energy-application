import { useState, useEffect, useRef } from 'react'
import {
  Scissors,
  Copy,
  Clipboard,
  Plus,
  Trash2,
  Eraser,
  ChevronRight,
  Bold,
  Italic,
  Underline,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import { FONT_FAMILIES, FONT_SIZES, COLOR_PRESETS } from '../data/sheetsConfig'
import './ContextMenu.css'

export default function ContextMenu({ x, y, cellId, onClose }) {
  const {
    copyCells,
    cutCells,
    pasteCells,
    clearSelectedCells,
    insertRow,
    deleteRow,
    insertColumn,
    deleteColumn,
    applyStyleToSelection,
  } = useSpreadsheet()

  const menuRef = useRef(null)
  const [submenu, setSubmenu] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ x, y })

  // Adjust menu position if it goes off screen
  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect()
      const newX = x + rect.width > window.innerWidth ? x - rect.width : x
      const newY = y + rect.height > window.innerHeight ? y - rect.height : y
      setMenuPosition({ x: Math.max(0, newX), y: Math.max(0, newY) })
    }
  }, [x, y])

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  // Close on escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const parseCellId = (id) => {
    const match = id.match(/^([A-Z]+)(\d+)$/)
    if (!match) return [null, null]
    return [match[1], parseInt(match[2], 10)]
  }

  const [col, row] = parseCellId(cellId)

  const handleCut = () => {
    cutCells()
    onClose()
  }

  const handleCopy = () => {
    copyCells()
    onClose()
  }

  const handlePaste = () => {
    pasteCells()
    onClose()
  }

  const handleClear = () => {
    clearSelectedCells()
    onClose()
  }

  const handleInsertRowAbove = () => {
    insertRow(row - 1)
    onClose()
  }

  const handleInsertRowBelow = () => {
    insertRow(row)
    onClose()
  }

  const handleInsertColumnLeft = () => {
    insertColumn(String.fromCharCode(col.charCodeAt(0) - 1))
    onClose()
  }

  const handleInsertColumnRight = () => {
    insertColumn(col)
    onClose()
  }

  const handleDeleteRow = () => {
    deleteRow(row)
    onClose()
  }

  const handleDeleteColumn = () => {
    deleteColumn(col)
    onClose()
  }

  const handleStyleChange = (style) => {
    applyStyleToSelection(style)
    setSubmenu(null)
  }

  return (
    <div
      className="context-menu-overlay"
      onClick={onClose}
    >
      <div
        ref={menuRef}
        className="context-menu"
        style={{ left: menuPosition.x, top: menuPosition.y }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Style Bar - Horizontal */}
        <div className="context-style-bar">
          <button
            className="style-btn"
            onClick={() => handleStyleChange({ fontWeight: 'bold' })}
            title="Gras"
          >
            <Bold size={14} />
          </button>
          <button
            className="style-btn"
            onClick={() => handleStyleChange({ fontStyle: 'italic' })}
            title="Italique"
          >
            <Italic size={14} />
          </button>
          <button
            className="style-btn"
            onClick={() => handleStyleChange({ textDecoration: 'underline' })}
            title="Souligné"
          >
            <Underline size={14} />
          </button>
          <div className="style-divider" />
          <button
            className="style-btn"
            onClick={() => handleStyleChange({ textAlign: 'left' })}
            title="Aligner à gauche"
          >
            <AlignLeft size={14} />
          </button>
          <button
            className="style-btn"
            onClick={() => handleStyleChange({ textAlign: 'center' })}
            title="Centrer"
          >
            <AlignCenter size={14} />
          </button>
          <button
            className="style-btn"
            onClick={() => handleStyleChange({ textAlign: 'right' })}
            title="Aligner à droite"
          >
            <AlignRight size={14} />
          </button>
          <div className="style-divider" />
          <div className="style-dropdown">
            <button
              className="style-btn"
              onMouseEnter={() => setSubmenu('font')}
              title="Police"
            >
              Aa
            </button>
            {submenu === 'font' && (
              <div className="style-submenu font-submenu">
                {FONT_FAMILIES.map((font) => (
                  <button
                    key={font}
                    className="submenu-item"
                    style={{ fontFamily: font }}
                    onClick={() => handleStyleChange({ fontFamily: font })}
                  >
                    {font}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="style-dropdown">
            <button
              className="style-btn"
              onMouseEnter={() => setSubmenu('size')}
              title="Taille"
            >
              12
            </button>
            {submenu === 'size' && (
              <div className="style-submenu size-submenu">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    className="submenu-item"
                    onClick={() => handleStyleChange({ fontSize: `${size}px` })}
                  >
                    {size}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="style-dropdown">
            <button
              className="style-btn color-btn"
              onMouseEnter={() => setSubmenu('bgcolor')}
              title="Couleur de fond"
            >
              <Palette size={14} />
              <span className="color-bar" style={{ backgroundColor: '#ffff00' }} />
            </button>
            {submenu === 'bgcolor' && (
              <div className="style-submenu color-submenu">
                <div className="color-grid">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      className="color-swatch"
                      style={{ backgroundColor: color }}
                      onClick={() => handleStyleChange({ backgroundColor: color })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="style-dropdown">
            <button
              className="style-btn color-btn"
              onMouseEnter={() => setSubmenu('textcolor')}
              title="Couleur du texte"
            >
              <span className="text-color-icon">A</span>
              <span className="color-bar" style={{ backgroundColor: '#000000' }} />
            </button>
            {submenu === 'textcolor' && (
              <div className="style-submenu color-submenu">
                <div className="color-grid">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      className="color-swatch"
                      style={{ backgroundColor: color }}
                      onClick={() => handleStyleChange({ color: color })}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions Menu - Vertical */}
        <div className="context-actions">
          <button className="context-item" onClick={handleCut}>
            <Scissors size={14} />
            <span>Couper</span>
            <span className="shortcut">Ctrl+X</span>
          </button>
          <button className="context-item" onClick={handleCopy}>
            <Copy size={14} />
            <span>Copier</span>
            <span className="shortcut">Ctrl+C</span>
          </button>
          <button className="context-item" onClick={handlePaste}>
            <Clipboard size={14} />
            <span>Coller</span>
            <span className="shortcut">Ctrl+V</span>
          </button>

          <div className="context-divider" />

          <div className="context-item has-submenu">
            <Plus size={14} />
            <span>Insérer</span>
            <ChevronRight size={14} className="submenu-arrow" />
            <div className="context-submenu">
              <button className="context-item" onClick={handleInsertRowAbove}>
                <span>Ligne au-dessus</span>
              </button>
              <button className="context-item" onClick={handleInsertRowBelow}>
                <span>Ligne en-dessous</span>
              </button>
              <button className="context-item" onClick={handleInsertColumnLeft}>
                <span>Colonne à gauche</span>
              </button>
              <button className="context-item" onClick={handleInsertColumnRight}>
                <span>Colonne à droite</span>
              </button>
            </div>
          </div>

          <div className="context-item has-submenu">
            <Trash2 size={14} />
            <span>Supprimer</span>
            <ChevronRight size={14} className="submenu-arrow" />
            <div className="context-submenu">
              <button className="context-item" onClick={handleDeleteRow}>
                <span>Supprimer la ligne</span>
              </button>
              <button className="context-item" onClick={handleDeleteColumn}>
                <span>Supprimer la colonne</span>
              </button>
            </div>
          </div>

          <div className="context-divider" />

          <button className="context-item" onClick={handleClear}>
            <Eraser size={14} />
            <span>Effacer le contenu</span>
            <span className="shortcut">Suppr</span>
          </button>
        </div>
      </div>
    </div>
  )
}
