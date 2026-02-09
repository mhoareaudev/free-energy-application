import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, Check, ChevronDown, FunctionSquare } from 'lucide-react'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import './FormulaBar.css'

export default function FormulaBar() {
  const {
    activeSheet,
    selectedCells,
    getCellValue,
    setCellValue,
    dataToDisplayLetterMap,
  } = useSpreadsheet()

  const [inputValue, setInputValue] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const inputRef = useRef(null)

  // The "active" cell is the first selected cell (uses dataLetter, e.g. "P1")
  const activeCellId = selectedCells.length > 0 ? selectedCells[0] : null

  // Convert dataLetter cell ID to display letter cell ID (e.g. "P1" → "E1")
  const displayCellName = useMemo(() => {
    if (!activeCellId) return ''
    const match = activeCellId.match(/^([A-Z]+)(\d+)$/)
    if (!match) return activeCellId
    const dataLetter = match[1]
    const rowNumber = match[2]
    const displayLetter = dataToDisplayLetterMap[dataLetter] || dataLetter
    return `${displayLetter}${rowNumber}`
  }, [activeCellId, dataToDisplayLetterMap])

  // Current value from the spreadsheet
  const cellValue = activeCellId ? getCellValue(activeSheet, activeCellId) : ''

  // Track the value when editing started (for cancel)
  const originalValueRef = useRef('')

  // Sync input with cell value when selection changes or cell value changes externally
  useEffect(() => {
    if (!isFocused) {
      setInputValue(cellValue)
    }
  }, [activeCellId, cellValue, isFocused])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
    setInputValue(cellValue)
    originalValueRef.current = cellValue
  }, [cellValue])

  const handleConfirm = useCallback(() => {
    setIsFocused(false)
    if (activeCellId && inputValue !== cellValue) {
      setCellValue(activeSheet, activeCellId, inputValue)
    }
    inputRef.current?.blur()
  }, [activeCellId, activeSheet, inputValue, cellValue, setCellValue])

  const handleCancel = useCallback(() => {
    setIsFocused(false)
    // Revert to value before editing started
    setInputValue(originalValueRef.current)
    if (activeCellId && cellValue !== originalValueRef.current) {
      setCellValue(activeSheet, activeCellId, originalValueRef.current)
    }
    inputRef.current?.blur()
  }, [activeCellId, activeSheet, cellValue, setCellValue])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
  }, [])

  const handleChange = useCallback((e) => {
    const newValue = e.target.value
    setInputValue(newValue)
    if (activeCellId) {
      setCellValue(activeSheet, activeCellId, newValue)
    }
  }, [activeCellId, activeSheet, setCellValue])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }, [handleConfirm, handleCancel])

  const isEditing = isFocused && activeCellId

  return (
    <div className={`formula-bar ${expanded ? 'expanded' : ''}`}>
      {/* Cell name box */}
      <div className="formula-bar-namebox">
        <span className="formula-bar-name">{displayCellName}</span>
        <ChevronDown size={12} className="namebox-chevron" />
      </div>

      <div className="formula-bar-separator" />

      {/* Action buttons: X, Check, fx */}
      <div className="formula-bar-actions">
        <button
          className="formula-bar-action-btn cancel"
          onClick={handleCancel}
          disabled={!isEditing}
          title="Annuler"
        >
          <X size={14} />
        </button>
        <button
          className="formula-bar-action-btn confirm"
          onClick={handleConfirm}
          disabled={!isEditing}
          title="Confirmer"
        >
          <Check size={14} />
        </button>
        <div className="formula-bar-fx">
          <span>fx</span>
        </div>
      </div>

      <div className="formula-bar-separator" />

      {/* Content input */}
      <input
        ref={inputRef}
        className="formula-bar-input"
        type="text"
        value={isFocused ? inputValue : cellValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={!activeCellId}
        spellCheck={false}
      />

      {/* Expand/collapse chevron */}
      <button
        className={`formula-bar-expand ${expanded ? 'expanded' : ''}`}
        onClick={() => setExpanded(!expanded)}
        title={expanded ? 'Réduire' : 'Développer'}
      >
        <ChevronDown size={14} />
      </button>
    </div>
  )
}
