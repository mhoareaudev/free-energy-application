import { useState, useRef, useEffect } from 'react'
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Highlighter,
  Palette,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ChevronDown,
  Scissors,
  Copy,
  Clipboard,
  Upload,
  ArrowDownNarrowWide,
} from 'lucide-react'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import { FONT_FAMILIES, FONT_SIZES, COLOR_PRESETS } from '../data/sheetsConfig'
import ImportModal from './ImportModal'
import './StyleBar.css'

export default function StyleBar() {
  const {
    selectedCells,
    applyStyleToSelection,
    undo,
    redo,
    copyCells,
    cutCells,
    pasteCells,
    compactRows,
    activeSheet,
    saveData,
  } = useSpreadsheet()

  const [selectedFont, setSelectedFont] = useState('Arial')
  const [selectedSize, setSelectedSize] = useState(12)
  const [showFontDropdown, setShowFontDropdown] = useState(false)
  const [showSizeDropdown, setShowSizeDropdown] = useState(false)
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const [showTextColorPicker, setShowTextColorPicker] = useState(false)
  const [showImportModal,  setShowImportModal]  = useState(false)
  const [compacting,       setCompacting]       = useState(false)

  const fontDropdownRef = useRef(null)
  const sizeDropdownRef = useRef(null)
  const highlightPickerRef = useRef(null)
  const textColorPickerRef = useRef(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fontDropdownRef.current && !fontDropdownRef.current.contains(event.target)) {
        setShowFontDropdown(false)
      }
      if (sizeDropdownRef.current && !sizeDropdownRef.current.contains(event.target)) {
        setShowSizeDropdown(false)
      }
      if (highlightPickerRef.current && !highlightPickerRef.current.contains(event.target)) {
        setShowHighlightPicker(false)
      }
      if (textColorPickerRef.current && !textColorPickerRef.current.contains(event.target)) {
        setShowTextColorPicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault()
            if (e.shiftKey) { redo() } else { undo() }
            break
          case 'b':
            e.preventDefault()
            handleBold()
            break
          case 'i':
            e.preventDefault()
            handleItalic()
            break
          case 'u':
            e.preventDefault()
            handleUnderline()
            break
          case 'c':
            e.preventDefault()
            copyCells()
            break
          case 'x':
            e.preventDefault()
            cutCells()
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo, copyCells, cutCells])

  const handleFontChange = (font) => {
    setSelectedFont(font)
    applyStyleToSelection({ fontFamily: font })
    setShowFontDropdown(false)
  }

  const handleSizeChange = (size) => {
    setSelectedSize(size)
    applyStyleToSelection({ fontSize: `${size}px` })
    setShowSizeDropdown(false)
  }

  const handleBold = () => {
    applyStyleToSelection({ fontWeight: 'bold' })
  }

  const handleItalic = () => {
    applyStyleToSelection({ fontStyle: 'italic' })
  }

  const handleUnderline = () => {
    applyStyleToSelection({ textDecoration: 'underline' })
  }

  const handleHighlight = (color) => {
    applyStyleToSelection({ backgroundColor: color })
    setShowHighlightPicker(false)
  }

  const handleTextColor = (color) => {
    applyStyleToSelection({ color: color })
    setShowTextColorPicker(false)
  }

  const handleAlign = (alignment) => {
    applyStyleToSelection({ textAlign: alignment })
  }

  const hasSelection = selectedCells.length > 0

  return (
    <div className="stylebar">
      {/* Undo/Redo Group */}
      <div className="stylebar-group">
        <button
          className="stylebar-btn"
          onClick={undo}
          title="Annuler (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          className="stylebar-btn"
          onClick={redo}
          title="Rétablir (Ctrl+Shift+Z)"
        >
          <Redo2 size={16} />
        </button>
      </div>

      <div className="stylebar-divider" />

      {/* Clipboard Group */}
      <div className="stylebar-group">
        <button
          className="stylebar-btn"
          onClick={cutCells}
          disabled={!hasSelection}
          title="Couper (Ctrl+X)"
        >
          <Scissors size={16} />
        </button>
        <button
          className="stylebar-btn"
          onClick={copyCells}
          disabled={!hasSelection}
          title="Copier (Ctrl+C)"
        >
          <Copy size={16} />
        </button>
        <button
          className="stylebar-btn"
          onClick={pasteCells}
          title="Coller (Ctrl+V)"
        >
          <Clipboard size={16} />
        </button>
      </div>

      <div className="stylebar-divider" />

      {/* Font Group */}
      <div className="stylebar-group">
        <div className="stylebar-dropdown" ref={fontDropdownRef}>
          <button
            className="stylebar-dropdown-btn"
            onClick={() => setShowFontDropdown(!showFontDropdown)}
            disabled={!hasSelection}
          >
            <span className="dropdown-value">{selectedFont}</span>
            <ChevronDown size={14} />
          </button>
          {showFontDropdown && (
            <div className="dropdown-menu font-dropdown">
              {FONT_FAMILIES.map((font) => (
                <button
                  key={font}
                  className="dropdown-item"
                  style={{ fontFamily: font }}
                  onClick={() => handleFontChange(font)}
                >
                  {font}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="stylebar-dropdown" ref={sizeDropdownRef}>
          <button
            className="stylebar-dropdown-btn size-dropdown-btn"
            onClick={() => setShowSizeDropdown(!showSizeDropdown)}
            disabled={!hasSelection}
          >
            <span className="dropdown-value">{selectedSize}</span>
            <ChevronDown size={14} />
          </button>
          {showSizeDropdown && (
            <div className="dropdown-menu size-dropdown">
              {FONT_SIZES.map((size) => (
                <button
                  key={size}
                  className="dropdown-item"
                  onClick={() => handleSizeChange(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="stylebar-divider" />

      {/* Text Style Group */}
      <div className="stylebar-group">
        <button
          className="stylebar-btn"
          onClick={handleBold}
          disabled={!hasSelection}
          title="Gras (Ctrl+B)"
        >
          <Bold size={16} />
        </button>
        <button
          className="stylebar-btn"
          onClick={handleItalic}
          disabled={!hasSelection}
          title="Italique (Ctrl+I)"
        >
          <Italic size={16} />
        </button>
        <button
          className="stylebar-btn"
          onClick={handleUnderline}
          disabled={!hasSelection}
          title="Souligné (Ctrl+U)"
        >
          <Underline size={16} />
        </button>
      </div>

      <div className="stylebar-divider" />

      {/* Color Group */}
      <div className="stylebar-group">
        <div className="stylebar-color-picker" ref={highlightPickerRef}>
          <button
            className="stylebar-btn color-btn"
            onClick={() => setShowHighlightPicker(!showHighlightPicker)}
            disabled={!hasSelection}
            title="Surligner"
          >
            <Highlighter size={16} />
            <span className="color-indicator" style={{ backgroundColor: '#ffff00' }} />
          </button>
          {showHighlightPicker && (
            <div className="color-picker-dropdown">
              <div className="color-picker-grid">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    className="color-swatch"
                    style={{ backgroundColor: color }}
                    onClick={() => handleHighlight(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="stylebar-color-picker" ref={textColorPickerRef}>
          <button
            className="stylebar-btn color-btn"
            onClick={() => setShowTextColorPicker(!showTextColorPicker)}
            disabled={!hasSelection}
            title="Couleur du texte"
          >
            <Palette size={16} />
            <span className="color-indicator" style={{ backgroundColor: '#000000' }} />
          </button>
          {showTextColorPicker && (
            <div className="color-picker-dropdown">
              <div className="color-picker-grid">
                {COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    className="color-swatch"
                    style={{ backgroundColor: color }}
                    onClick={() => handleTextColor(color)}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="stylebar-divider" />

      {/* Alignment Group */}
      <div className="stylebar-group">
        <button
          className="stylebar-btn"
          onClick={() => handleAlign('left')}
          disabled={!hasSelection}
          title="Aligner à gauche"
        >
          <AlignLeft size={16} />
        </button>
        <button
          className="stylebar-btn"
          onClick={() => handleAlign('center')}
          disabled={!hasSelection}
          title="Centrer"
        >
          <AlignCenter size={16} />
        </button>
        <button
          className="stylebar-btn"
          onClick={() => handleAlign('right')}
          disabled={!hasSelection}
          title="Aligner à droite"
        >
          <AlignRight size={16} />
        </button>
      </div>

      {/* Right-side actions */}
      <div className="stylebar-right-actions">
        <button
          className="stylebar-import-btn"
          title="Réorganiser les lignes sans espaces vides"
          disabled={compacting}
          onClick={async () => {
            setCompacting(true)
            await compactRows(activeSheet)
            await saveData()
            setCompacting(false)
          }}
        >
          <ArrowDownNarrowWide size={14} />
          {compacting ? 'En cours…' : 'Compacter'}
        </button>

        <button
          className="stylebar-import-btn"
          title="Importer depuis un PDF"
          onClick={() => setShowImportModal(true)}
        >
          <Upload size={14} />
          Importer
        </button>
      </div>

      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} />
      )}
    </div>
  )
}
