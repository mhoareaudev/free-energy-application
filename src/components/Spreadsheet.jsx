import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Filter, MoreVertical } from 'lucide-react'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import { useAuth } from '../context/AuthContext'
import { getSheetColumns, getColumnIdToLetterMap } from '../data/sheetsConfig'
import { formatDateDisplay } from '../utils/dateUtils'
import { supabaseGet } from '../lib/supabase'
import ContextMenu from './ContextMenu'
import HeaderContextMenu from './HeaderContextMenu'
import PdfViewerModal from './PdfViewerModal'
import CRMModal from './CRMModal'
import { SHEETS } from '../data/sheetsConfig'
import './Spreadsheet.css'

const TOTAL_ROWS = 999
const VISIBLE_BUFFER = 10
const DATE_COL_RE = /^DATE_|_LE$/
const EXTRA_DATE_COLS = new Set(['DEMANDE_DP'])

function isDateColumn(colId) {
  return DATE_COL_RE.test(colId) || EXTRA_DATE_COLS.has(colId)
}
const ROW_HEIGHT = 28
const ROW_NUMBER_WIDTH = 40
const ACTION_COL_WIDTH = 56
const HEADER_HEIGHT = 74 // letter-row(22) + group-row(24) + column-row(28)

export default function Spreadsheet() {
  const {
    activeSheet,
    selectedCells,
    setSelectedCells,
    editingCell,
    setEditingCell,
    getCellValue,
    getCellStyle,
    setCellValue,
    setColumnWidth,
    getColumnWidth,
    setRowHeight,
    getRowHeight,
    pasteFromClipboard,
    setPendingEdit,
    vtFormData,
    setDataToDisplayLetterMap,
  } = useSpreadsheet()

  const containerRef = useRef(null)
  const scrollableRef = useRef(null)
  const scrollRAF = useRef(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [scrollLeft, setScrollLeft] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const [containerWidth, setContainerWidth] = useState(0)
  const [editValue, setEditValue] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [headerContextMenu, setHeaderContextMenu] = useState(null)

  // PDF viewer modal
  const [pdfModalData, setPdfModalData] = useState(null)

  // CRM modal
  const [crmModalData, setCrmModalData] = useState(null)

  // Column filter (CHARGES_AFFAIRES)
  const [columnFilter, setColumnFilter] = useState(null) // null = no filter, string = filter value
  const [showColumnFilter, setShowColumnFilter] = useState(false)
  const [filterDropdownPos, setFilterDropdownPos] = useState(null) // { top, left }
  const columnFilterRef = useRef(null)
  const filterBtnRef = useRef(null)

  // Column filter (COMMERCIAL)
  const [commercialFilter, setCommercialFilter] = useState(null)
  const [showCommercialFilter, setShowCommercialFilter] = useState(false)
  const [commercialFilterDropdownPos, setCommercialFilterDropdownPos] = useState(null)
  const commercialFilterRef = useRef(null)
  const commercialFilterBtnRef = useRef(null)

  // Cell dropdown position (for portal rendering)
  const [cellDropdownPos, setCellDropdownPos] = useState(null) // { top, left, width }

  // Column/row resize state
  const [resizing, setResizing] = useState(null) // { type: 'column'|'row', index, startPos, startSize }
  const resizeRef = useRef(null)

  // Role-based column group visibility
  const { userProfile } = useAuth()
  const [roleHiddenGroups, setRoleHiddenGroups] = useState({})

  // Techniciens list for CHARGES_AFFAIRES dropdown
  const [techniciens, setTechniciens] = useState([])

  // Commerciaux list for COMMERCIAL column filter
  const [commerciaux, setCommerciaux] = useState([])

  useEffect(() => {
    supabaseGet('profiles', { select: 'id,nom,prenom', role: 'eq.technique', order: 'nom.asc' })
      .then(data => { if (data.length) setTechniciens(data) })
  }, [])

  useEffect(() => {
    supabaseGet('profiles', { select: 'id,nom,prenom', role: 'eq.commercial', order: 'nom.asc' })
      .then(data => { if (data.length) setCommerciaux(data) })
  }, [])

  // Fetch role-based hidden groups for current user
  useEffect(() => {
    const role = userProfile?.role
    if (!role || role === 'administrateur') {
      setRoleHiddenGroups({})
      return
    }
    supabaseGet('role_visibility', { select: 'hidden_groups', role: `eq.${role}` })
      .then(data => {
        if (data[0]) setRoleHiddenGroups(data[0].hidden_groups || {})
      })
  }, [userProfile?.role])

  const columnsConfig = useMemo(() => getSheetColumns(activeSheet), [activeSheet])

  // Calculate all columns with their positions (using custom widths if available)
  const allColumns = useMemo(() => {
    const cols = []
    let position = ROW_NUMBER_WIDTH + ACTION_COL_WIDTH // Start after row number + action column

    // Full config letter mapping (stable regardless of hidden groups)
    // This ensures data is always read/written at the correct cell position
    const fullLetterMap = getColumnIdToLetterMap(activeSheet)

    // Frozen columns
    columnsConfig.frozen.forEach((col, index) => {
      const customWidth = getColumnWidth(activeSheet, index, col.width)
      cols.push({
        ...col,
        index,
        position,
        width: customWidth,
        defaultWidth: col.width,
        isFrozen: true,
        letter: String.fromCharCode(65 + index),
        dataLetter: fullLetterMap[col.id],
      })
      position += customWidth
    })

    const frozenWidth = position // Includes ROW_NUMBER_WIDTH + frozen columns

    // Hidden groups for current sheet (based on user role)
    const hiddenForSheet = roleHiddenGroups[activeSheet] || []

    // Group columns (skip hidden groups)
    columnsConfig.groups.forEach((group, groupIdx) => {
      if (hiddenForSheet.includes(group.name)) return

      group.columns.forEach((col, colIdx) => {
        const index = cols.length
        const customWidth = getColumnWidth(activeSheet, index, col.width)
        cols.push({
          ...col,
          index,
          position,
          width: customWidth,
          defaultWidth: col.width,
          isFrozen: false,
          groupName: group.name,
          groupColors: group.colors,
          isGroupStart: colIdx === 0,
          letter: getColumnLetter(index),
          dataLetter: fullLetterMap[col.id],
        })
        position += customWidth
      })
    })

    return { columns: cols, frozenWidth, totalWidth: position }
  }, [columnsConfig, activeSheet, getColumnWidth, roleHiddenGroups])

  // Update dataLetter → displayLetter mapping for FormulaBar
  useEffect(() => {
    const map = {}
    allColumns.columns.forEach((col) => {
      if (col.dataLetter) map[col.dataLetter] = col.letter
    })
    setDataToDisplayLetterMap(map)
  }, [allColumns, setDataToDisplayLetterMap])

  // Memoize frozen and non-frozen columns
  const frozenCols = useMemo(() => allColumns.columns.filter((col) => col.isFrozen), [allColumns.columns])
  const nonFrozenCols = useMemo(() => allColumns.columns.filter((col) => !col.isFrozen), [allColumns.columns])

  // Reverse map: data letter → column ID (e.g. 'AN' → 'CHARGES_AFFAIRES')
  const letterToColId = useMemo(() => {
    const map = {}
    allColumns.columns.forEach(col => {
      map[col.dataLetter] = col.id
    })
    return map
  }, [allColumns.columns])

  // Columns that use a dropdown instead of free text
  const DROPDOWN_COLUMNS = new Set(['CHARGES_AFFAIRES'])

  const isDropdownCell = useCallback((cellId) => {
    const match = cellId.match(/^([A-Z]+)(\d+)$/)
    if (!match) return false
    return DROPDOWN_COLUMNS.has(letterToColId[match[1]])
  }, [letterToColId])

  // CHARGES_AFFAIRES data letter for the current sheet (stable across views)
  const chargesAffairesLetter = useMemo(() => {
    const col = allColumns.columns.find(c => c.id === 'CHARGES_AFFAIRES')
    return col?.dataLetter || null
  }, [allColumns.columns])

  // COMMERCIAL data letter for the current sheet
  const commercialDataLetter = useMemo(() => {
    const col = allColumns.columns.find(c => c.id === 'COMMERCIAL')
    return col?.dataLetter || null
  }, [allColumns.columns])

  // Unique non-empty values in CHARGES_AFFAIRES for filter options
  const uniqueChargesAffaires = useMemo(() => {
    if (!chargesAffairesLetter) return []
    const values = new Set()
    for (let row = 1; row <= TOTAL_ROWS; row++) {
      const val = getCellValue(activeSheet, `${chargesAffairesLetter}${row}`)
      if (val) values.add(val)
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [chargesAffairesLetter, activeSheet, getCellValue])

  // Unique non-empty values in COMMERCIAL for filter options
  const uniqueCommercials = useMemo(() => {
    if (!commercialDataLetter) return []
    const values = new Set()
    for (let row = 1; row <= TOTAL_ROWS; row++) {
      const val = getCellValue(activeSheet, `${commercialDataLetter}${row}`)
      if (val) values.add(val)
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'fr'))
  }, [commercialDataLetter, activeSheet, getCellValue])

  // Filtered row indices (0-based). When no filter, all rows are included.
  // Supports both CHARGES_AFFAIRES and COMMERCIAL filters simultaneously.
  const filteredRowIndices = useMemo(() => {
    const hasChargesFilter = columnFilter && chargesAffairesLetter
    const hasCommercialFilter = commercialFilter && commercialDataLetter

    if (!hasChargesFilter && !hasCommercialFilter) return null // null = no filter

    const indices = []
    for (let rowIndex = 0; rowIndex < TOTAL_ROWS; rowIndex++) {
      const rowNumber = rowIndex + 1
      let matches = true

      if (hasChargesFilter) {
        const val = getCellValue(activeSheet, `${chargesAffairesLetter}${rowNumber}`)
        if (val !== columnFilter) matches = false
      }

      if (hasCommercialFilter && matches) {
        const val = getCellValue(activeSheet, `${commercialDataLetter}${rowNumber}`)
        if (val !== commercialFilter) matches = false
      }

      if (matches) indices.push(rowIndex)
    }
    return indices
  }, [columnFilter, chargesAffairesLetter, commercialFilter, commercialDataLetter, activeSheet, getCellValue])

  const totalDisplayedRows = filteredRowIndices ? filteredRowIndices.length : TOTAL_ROWS

  // Close filter dropdown on outside click
  useEffect(() => {
    if (!showColumnFilter) return
    const handleClick = (e) => {
      const inDropdown = columnFilterRef.current && columnFilterRef.current.contains(e.target)
      const inButton = filterBtnRef.current && filterBtnRef.current.contains(e.target)
      if (!inDropdown && !inButton) {
        setShowColumnFilter(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showColumnFilter])

  // Close commercial filter dropdown on outside click
  useEffect(() => {
    if (!showCommercialFilter) return
    const handleClick = (e) => {
      const inDropdown = commercialFilterRef.current && commercialFilterRef.current.contains(e.target)
      const inButton = commercialFilterBtnRef.current && commercialFilterBtnRef.current.contains(e.target)
      if (!inDropdown && !inButton) {
        setShowCommercialFilter(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showCommercialFilter])

  // Close cell dropdown on outside click
  useEffect(() => {
    if (!editingCell || !cellDropdownPos || !isDropdownCell(editingCell)) return
    const handleClick = (e) => {
      // Check if click is inside the portal dropdown
      const portal = document.querySelector('.cell-dropdown-portal')
      if (portal && portal.contains(e.target)) return
      // Click outside: close dropdown without saving
      setEditingCell(null)
      setEditValue('')
      setCellDropdownPos(null)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [editingCell, cellDropdownPos, isDropdownCell, setEditingCell])

  // Reset filters when sheet changes
  useEffect(() => {
    setColumnFilter(null)
    setShowColumnFilter(false)
    setCommercialFilter(null)
    setShowCommercialFilter(false)
  }, [activeSheet])

  // Pre-compute cumulative row positions (accounts for custom row heights)
  const rowLayout = useMemo(() => {
    const positions = new Array(totalDisplayedRows + 1)
    let cumulative = 0
    for (let d = 0; d < totalDisplayedRows; d++) {
      positions[d] = cumulative
      const actualRow = filteredRowIndices ? filteredRowIndices[d] : d
      cumulative += getRowHeight(activeSheet, actualRow, ROW_HEIGHT)
    }
    positions[totalDisplayedRows] = cumulative
    return { positions, totalHeight: cumulative }
  }, [totalDisplayedRows, filteredRowIndices, activeSheet, getRowHeight])

  // Calculate visible rows (binary search on cumulative positions).
  // Rows are offset by HEADER_HEIGHT in the content, so adjust scrollTop accordingly.
  const visibleRows = useMemo(() => {
    const { positions } = rowLayout
    // Rows start at content-y = HEADER_HEIGHT. A row at positions[i] is visible when
    // positions[i] + HEADER_HEIGHT - scrollTop < containerHeight (bottom in viewport)
    // and positions[i+1] + HEADER_HEIGHT - scrollTop > HEADER_HEIGHT (top below sticky header)
    // Simplified: positions[i+1] > scrollTop (top clamp)
    let lo = 0, hi = totalDisplayedRows - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (positions[mid + 1] <= scrollTop) lo = mid + 1
      else hi = mid
    }
    const startRow = Math.max(0, lo - VISIBLE_BUFFER)

    // viewBottom in row-position space: rows below this are off-screen
    const viewBottom = scrollTop + containerHeight - HEADER_HEIGHT
    let end = lo
    while (end < totalDisplayedRows && positions[end] < viewBottom) end++
    const endRow = Math.min(totalDisplayedRows, end + VISIBLE_BUFFER)

    return { startRow, endRow }
  }, [scrollTop, containerHeight, totalDisplayedRows, rowLayout])

  // Calculate visible columns (non-frozen)
  const visibleColumns = useMemo(() => {
    const nonFrozenCols = allColumns.columns.filter((col) => !col.isFrozen)
    const startCol = nonFrozenCols.findIndex(
      (col) => col.position + col.width - allColumns.frozenWidth > scrollLeft
    )
    const endCol = nonFrozenCols.findIndex(
      (col) => col.position - allColumns.frozenWidth > scrollLeft + containerWidth
    )

    return {
      startCol: Math.max(0, startCol - VISIBLE_BUFFER),
      endCol: endCol === -1 ? nonFrozenCols.length : Math.min(nonFrozenCols.length, endCol + VISIBLE_BUFFER),
    }
  }, [scrollLeft, containerWidth, allColumns])

  // Update container dimensions
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight)
        setContainerWidth(containerRef.current.clientWidth)
      }
    }

    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  // Handle scroll: defer React state updates (for visible row/column recalculation) to RAF.
  // The header is inside the scroll container with position:sticky so it syncs natively — no JS transform needed.
  const handleScroll = useCallback((e) => {
    const newScrollTop = e.target.scrollTop
    const newScrollLeft = e.target.scrollLeft

    if (scrollRAF.current) {
      cancelAnimationFrame(scrollRAF.current)
    }

    scrollRAF.current = requestAnimationFrame(() => {
      setScrollTop(newScrollTop)
      setScrollLeft(newScrollLeft)
    })
  }, [])

  // Set for O(1) lookup of selected cells
  const selectedCellsSet = useMemo(() => new Set(selectedCells), [selectedCells])

  // Pre-computed sets for fast header highlighting (O(1) instead of O(n))
  const selectedColLetters = useMemo(() => {
    const set = new Set()
    selectedCells.forEach(cellId => {
      const [letter] = parseCellId(cellId)
      if (letter) set.add(letter)
    })
    return set
  }, [selectedCells])

  const selectedRowNumbers = useMemo(() => {
    const set = new Set()
    selectedCells.forEach(cellId => {
      const [, row] = parseCellId(cellId)
      if (row) set.add(row)
    })
    return set
  }, [selectedCells])

  // Check if cell is selected
  const isCellSelected = useCallback((cellId) => {
    return selectedCellsSet.has(cellId)
  }, [selectedCellsSet])

  // Calculate selection bounds for border rendering
  const selectionBounds = useMemo(() => {
    if (selectedCells.length === 0) return null

    let minCol = Infinity, maxCol = -Infinity
    let minRow = Infinity, maxRow = -Infinity

    selectedCells.forEach((cellId) => {
      const [colLetter, row] = parseCellId(cellId)
      if (colLetter && row) {
        const colIndex = colLetter.charCodeAt(0)
        minCol = Math.min(minCol, colIndex)
        maxCol = Math.max(maxCol, colIndex)
        minRow = Math.min(minRow, row)
        maxRow = Math.max(maxRow, row)
      }
    })

    return { minCol, maxCol, minRow, maxRow }
  }, [selectedCells])

  // Get selection border classes for a cell
  const getSelectionBorderClasses = useCallback((cellId) => {
    if (!selectionBounds || !selectedCellsSet.has(cellId)) return ''

    const [colLetter, row] = parseCellId(cellId)
    if (!colLetter || !row) return ''

    const colIndex = colLetter.charCodeAt(0)
    const classes = []

    if (colIndex === selectionBounds.minCol) classes.push('selection-left')
    if (colIndex === selectionBounds.maxCol) classes.push('selection-right')
    if (row === selectionBounds.minRow) classes.push('selection-top')
    if (row === selectionBounds.maxRow) classes.push('selection-bottom')

    return classes.join(' ')
  }, [selectedCellsSet, selectionBounds])

  // Handle cell click
  const handleCellClick = useCallback((cellId, e) => {
    if (e.shiftKey && selectedCells.length > 0) {
      // Extend selection
      const lastSelected = selectedCells[selectedCells.length - 1]
      const [lastCol, lastRow] = parseCellId(lastSelected)
      const [newCol, newRow] = parseCellId(cellId)

      const minCol = Math.min(lastCol.charCodeAt(0), newCol.charCodeAt(0))
      const maxCol = Math.max(lastCol.charCodeAt(0), newCol.charCodeAt(0))
      const minRow = Math.min(lastRow, newRow)
      const maxRow = Math.max(lastRow, newRow)

      const newSelection = []
      for (let col = minCol; col <= maxCol; col++) {
        for (let row = minRow; row <= maxRow; row++) {
          newSelection.push(`${String.fromCharCode(col)}${row}`)
        }
      }
      setSelectedCells(newSelection)
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      if (selectedCells.includes(cellId)) {
        setSelectedCells(selectedCells.filter((id) => id !== cellId))
      } else {
        setSelectedCells([...selectedCells, cellId])
      }
    } else {
      setSelectedCells([cellId])
    }
  }, [selectedCells, setSelectedCells])

  // Handle cell double click
  const handleCellDoubleClick = useCallback((cellId) => {
    setCellDropdownPos(null) // Reset portal position for new cell
    setEditingCell(cellId)
    setEditValue(getCellValue(activeSheet, cellId))
  }, [activeSheet, getCellValue, setEditingCell])

  // Handle cell edit
  const handleCellEdit = useCallback((e) => {
    setEditValue(e.target.value)
  }, [])

  // Handle dropdown select (for CHARGES_AFFAIRES etc.)
  const handleDropdownSelect = useCallback((value) => {
    if (editingCell) {
      setCellValue(activeSheet, editingCell, value)

      // Update __vtFormData for this row so PDF includes chargé d'affaires
      const match = editingCell.match(/^([A-Z]+)(\d+)$/)
      if (match && letterToColId[match[1]] === 'CHARGES_AFFAIRES') {
        const rowNumber = match[2]
        const existingJson = getCellValue(activeSheet, `__vtFormData:${rowNumber}`)
        if (existingJson) {
          try {
            const vtData = JSON.parse(existingJson)
            vtData.chargesAffaires = value
            setCellValue(activeSheet, `__vtFormData:${rowNumber}`, JSON.stringify(vtData))
          } catch { /* ignore parse errors */ }
        }
      }

      setEditingCell(null)
      setEditValue('')
      setCellDropdownPos(null)
    }
  }, [activeSheet, editingCell, setCellValue, setEditingCell, letterToColId, getCellValue])

  // Keep context informed of pending edit (so save can commit it)
  useEffect(() => {
    if (editingCell) {
      setPendingEdit(activeSheet, editingCell, editValue)
    } else {
      setPendingEdit(null, null, null)
    }
  }, [editingCell, editValue, activeSheet, setPendingEdit])

  // Handle cell edit complete
  const handleCellEditComplete = useCallback(() => {
    if (editingCell) {
      setCellValue(activeSheet, editingCell, editValue)
      setEditingCell(null)
      setEditValue('')
    }
  }, [activeSheet, editingCell, editValue, setCellValue, setEditingCell])

  // Handle key down in edit mode
  const handleEditKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleCellEditComplete()
    } else if (e.key === 'Escape') {
      setEditingCell(null)
      setEditValue('')
      setCellDropdownPos(null)
    }
  }, [handleCellEditComplete, setEditingCell])

  // Handle mouse down for drag selection
  const handleMouseDown = useCallback((cellId, e) => {
    if (e.button === 0 && !editingCell) {
      setIsDragging(true)
      setDragStart(cellId)
      setSelectedCells([cellId])
    }
  }, [editingCell, setSelectedCells])

  // Handle mouse enter during drag
  const handleMouseEnter = useCallback((cellId) => {
    if (isDragging && dragStart) {
      const [startCol, startRow] = parseCellId(dragStart)
      const [endCol, endRow] = parseCellId(cellId)

      const minCol = Math.min(startCol.charCodeAt(0), endCol.charCodeAt(0))
      const maxCol = Math.max(startCol.charCodeAt(0), endCol.charCodeAt(0))
      const minRow = Math.min(startRow, endRow)
      const maxRow = Math.max(startRow, endRow)

      const newSelection = []
      for (let col = minCol; col <= maxCol; col++) {
        for (let row = minRow; row <= maxRow; row++) {
          newSelection.push(`${String.fromCharCode(col)}${row}`)
        }
      }
      setSelectedCells(newSelection)
    }
  }, [isDragging, dragStart, setSelectedCells])

  // Handle mouse up
  useEffect(() => {
    const handleMouseUp = () => {
      setIsDragging(false)
      setDragStart(null)
      if (resizing) {
        setResizing(null)
      }
    }

    window.addEventListener('mouseup', handleMouseUp)
    return () => window.removeEventListener('mouseup', handleMouseUp)
  }, [resizing])

  // Handle column resize
  const handleColumnResizeStart = useCallback((e, colIndex, currentWidth) => {
    e.preventDefault()
    e.stopPropagation()
    setResizing({
      type: 'column',
      index: colIndex,
      startPos: e.clientX,
      startSize: currentWidth,
    })
    resizeRef.current = { colIndex, startX: e.clientX, startWidth: currentWidth }
  }, [])

  // Handle row resize
  const handleRowResizeStart = useCallback((e, rowIndex, currentHeight) => {
    e.preventDefault()
    e.stopPropagation()
    setResizing({
      type: 'row',
      index: rowIndex,
      startPos: e.clientY,
      startSize: currentHeight,
    })
    resizeRef.current = { rowIndex, startY: e.clientY, startHeight: currentHeight }
  }, [])

  // Mouse move for resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!resizing || !resizeRef.current) return

      if (resizing.type === 'column') {
        const diff = e.clientX - resizing.startPos
        const newWidth = Math.max(30, resizing.startSize + diff)
        setColumnWidth(activeSheet, resizing.index, newWidth)
      } else if (resizing.type === 'row') {
        const diff = e.clientY - resizing.startPos
        const newHeight = Math.max(20, resizing.startSize + diff)
        setRowHeight(activeSheet, resizing.index, newHeight)
      }
    }

    if (resizing) {
      window.addEventListener('mousemove', handleMouseMove)
      return () => window.removeEventListener('mousemove', handleMouseMove)
    }
  }, [resizing, activeSheet, setColumnWidth, setRowHeight])

  // Handle paste from clipboard (Ctrl+V)
  useEffect(() => {
    const handleKeyDown = async (e) => {
      // Handle paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !editingCell) {
        if (selectedCells.length > 0) {
          e.preventDefault()
          await pasteFromClipboard(selectedCells[0])
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [editingCell, selectedCells, pasteFromClipboard])

  // Handle context menu
  const handleContextMenu = useCallback((e, cellId) => {
    e.preventDefault()
    if (!selectedCells.includes(cellId)) {
      setSelectedCells([cellId])
    }
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      cellId,
    })
  }, [selectedCells, setSelectedCells])

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Select entire column (uses dataLetter for consistent cell IDs)
  const selectColumn = useCallback((dataLetter) => {
    const newSelection = []
    for (let row = 1; row <= TOTAL_ROWS; row++) {
      newSelection.push(`${dataLetter}${row}`)
    }
    setSelectedCells(newSelection)
  }, [setSelectedCells])

  // Select entire row (uses dataLetter for consistent cell IDs)
  const selectRow = useCallback((rowNumber) => {
    const newSelection = []
    allColumns.columns.forEach((col) => {
      newSelection.push(`${col.dataLetter}${rowNumber}`)
    })
    setSelectedCells(newSelection)
  }, [allColumns.columns, setSelectedCells])

  // Handle row header context menu
  const handleRowContextMenu = useCallback((e, rowNumber) => {
    e.preventDefault()
    // Select the row
    selectRow(rowNumber)
    setHeaderContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'row',
      index: rowNumber,
    })
  }, [selectRow])

  // Handle column header context menu
  const handleColumnContextMenu = useCallback((e, colLetter) => {
    e.preventDefault()
    // Select the column
    selectColumn(colLetter)
    setHeaderContextMenu({
      x: e.clientX,
      y: e.clientY,
      type: 'column',
      index: colLetter,
    })
  }, [selectColumn])

  // Close header context menu
  const closeHeaderContextMenu = useCallback(() => {
    setHeaderContextMenu(null)
  }, [])

  // Memoize visible non-frozen columns
  const visibleNonFrozenCols = useMemo(() =>
    nonFrozenCols.slice(visibleColumns.startCol, visibleColumns.endCol),
    [nonFrozenCols, visibleColumns.startCol, visibleColumns.endCol]
  )

  // Render column headers
  const renderColumnHeaders = () => {

    // Get group headers
    const groups = []
    let currentGroup = null
    let groupStartPos = 0

    let currentGroupColors = null
    nonFrozenCols.forEach((col, index) => {
      if (col.groupName !== currentGroup) {
        if (currentGroup !== null) {
          groups.push({
            name: currentGroup,
            colors: currentGroupColors,
            startPos: groupStartPos,
            width: col.position - allColumns.frozenWidth - groupStartPos,
          })
        }
        currentGroup = col.groupName
        currentGroupColors = col.groupColors
        groupStartPos = col.position - allColumns.frozenWidth
      }
    })
    if (currentGroup !== null) {
      groups.push({
        name: currentGroup,
        colors: currentGroupColors,
        startPos: groupStartPos,
        width: allColumns.totalWidth - allColumns.frozenWidth - groupStartPos,
      })
    }

    return (
      <div className="spreadsheet-headers">
        {/* Letter headers row (A, B, C, ...) */}
        <div className="header-row letter-row">
          <div
            className="frozen-header-cells"
            style={{ width: allColumns.frozenWidth }}
          >
            <div className="header-cell corner-cell" style={{ width: ROW_NUMBER_WIDTH }} />
            <div className="header-cell action-col-header" style={{ width: ACTION_COL_WIDTH }} />
            {frozenCols.map((col) => {
              const isSelected = selectedColLetters.has(col.dataLetter)
              return (
                <div
                  key={col.id}
                  className={`header-cell letter-header frozen ${isSelected ? 'selected' : ''}`}
                  style={{ width: col.width }}
                  onClick={() => selectColumn(col.dataLetter)}
                  onContextMenu={(e) => handleColumnContextMenu(e, col.dataLetter)}
                >
                  {col.letter}
                  <div
                    className={`column-resize-handle ${resizing?.index === col.index ? 'resizing' : ''}`}
                    onMouseDown={(e) => handleColumnResizeStart(e, col.index, col.width)}
                  />
                </div>
              )
            })}
          </div>
          <div
            className="scrollable-header-cells"
          >
            {visibleNonFrozenCols.map((col) => {
              const isSelected = selectedColLetters.has(col.dataLetter)
              return (
                <div
                  key={col.id}
                  className={`header-cell letter-header ${isSelected ? 'selected' : ''}`}
                  style={{
                    position: 'absolute',
                    left: col.position - allColumns.frozenWidth,
                    width: col.width,
                    backgroundColor: col.groupColors?.dark || undefined,
                    borderTop: `1px solid ${col.groupColors?.border || 'var(--border-light)'}`,
                    borderBottom: `1px solid ${col.groupColors?.border || 'var(--border-light)'}`,
                    borderLeft: col.isGroupStart ? `2px solid ${col.groupColors?.border || 'var(--border-medium)'}` : undefined,
                  }}
                  onClick={() => selectColumn(col.dataLetter)}
                  onContextMenu={(e) => handleColumnContextMenu(e, col.dataLetter)}
                >
                  {col.letter}
                  <div
                    className={`column-resize-handle ${resizing?.index === col.index ? 'resizing' : ''}`}
                    onMouseDown={(e) => handleColumnResizeStart(e, col.index, col.width)}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Group headers row */}
        <div className="header-row group-row">
          <div
            className="frozen-header-cells"
            style={{ width: allColumns.frozenWidth }}
          >
            <div className="header-cell corner-cell" style={{ width: ROW_NUMBER_WIDTH }} />
            <div className="header-cell action-col-header" style={{ width: ACTION_COL_WIDTH }} />
            {frozenCols.map((col) => (
              <div
                key={col.id}
                className="header-cell group-header frozen"
                style={{ width: col.width }}
              />
            ))}
          </div>
          <div
            className="scrollable-header-cells"
          >
            {groups.map((group, index) => (
              <div
                key={index}
                className="header-cell group-header"
                style={{
                  position: 'absolute',
                  left: group.startPos,
                  width: group.width,
                  backgroundColor: group.colors?.dark || undefined,
                  borderTop: `1px solid ${group.colors?.border || 'var(--border-light)'}`,
                  borderBottom: `1px solid ${group.colors?.border || 'var(--border-light)'}`,
                  borderLeft: `2px solid ${group.colors?.border || 'var(--border-medium)'}`,
                }}
              >
                {group.name}
              </div>
            ))}
          </div>
        </div>

        {/* Column headers row (titles) */}
        <div className="header-row column-row">
          <div
            className="frozen-header-cells"
            style={{ width: allColumns.frozenWidth }}
          >
            <div className="header-cell corner-cell" style={{ width: ROW_NUMBER_WIDTH }} />
            <div className="header-cell action-col-header" style={{ width: ACTION_COL_WIDTH }} title="PDF VT" />
            {frozenCols.map((col) => {
              const isSelected = selectedColLetters.has(col.dataLetter)
              const hasFilter = col.id === 'COMMERCIAL'
              return (
                <div
                  key={col.id}
                  className={`header-cell column-header frozen ${isSelected ? 'selected' : ''} ${hasFilter ? 'filterable' : ''}`}
                  style={{ width: col.width }}
                >
                  <span className="column-header-label">{col.label}</span>
                  {hasFilter && (
                    <button
                      ref={commercialFilterBtnRef}
                      className={`column-filter-btn ${commercialFilter ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (showCommercialFilter) {
                          setShowCommercialFilter(false)
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setCommercialFilterDropdownPos({ top: rect.bottom + 4, left: rect.left })
                          setShowCommercialFilter(true)
                        }
                      }}
                      title="Filtrer par commercial"
                    >
                      <Filter size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          <div
            className="scrollable-header-cells"
          >
            {visibleNonFrozenCols.map((col) => {
              const isSelected = selectedColLetters.has(col.dataLetter)
              const hasFilter = col.id === 'CHARGES_AFFAIRES'
              return (
                <div
                  key={col.id}
                  className={`header-cell column-header ${isSelected ? 'selected' : ''} ${hasFilter ? 'filterable' : ''}`}
                  style={{
                    position: 'absolute',
                    left: col.position - allColumns.frozenWidth,
                    width: col.width,
                    backgroundColor: col.groupColors?.medium || undefined,
                    borderTop: `1px solid ${col.groupColors?.border || 'var(--border-light)'}`,
                    borderBottom: `1px solid ${col.groupColors?.border || 'var(--border-light)'}`,
                    borderLeft: col.isGroupStart ? `2px solid ${col.groupColors?.border || 'var(--border-medium)'}` : undefined,
                  }}
                >
                  <span className="column-header-label">{col.label}</span>
                  {hasFilter && (
                    <button
                      ref={filterBtnRef}
                      className={`column-filter-btn ${columnFilter ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (showColumnFilter) {
                          setShowColumnFilter(false)
                        } else {
                          const rect = e.currentTarget.getBoundingClientRect()
                          setFilterDropdownPos({ top: rect.bottom + 4, left: rect.right - 200 })
                          setShowColumnFilter(true)
                        }
                      }}
                      title="Filtrer"
                    >
                      <Filter size={12} />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  // Render rows
  const renderRows = () => {
    const rows = []

    for (let displayIndex = visibleRows.startRow; displayIndex < visibleRows.endRow; displayIndex++) {
      // When filtered, map display index → actual row index
      const rowIndex = filteredRowIndices ? filteredRowIndices[displayIndex] : displayIndex
      if (rowIndex === undefined) continue
      const rowNumber = rowIndex + 1
      const isRowSelected = selectedRowNumbers.has(rowNumber)

      const rowHeight = getRowHeight(activeSheet, rowIndex, ROW_HEIGHT)
      const isCancelled = !!getCellValue(activeSheet, `__cancelled:${rowNumber}`)

      rows.push(
        <div
          key={rowIndex}
          className={`spreadsheet-row${isCancelled ? ' spreadsheet-row--cancelled' : ''}`}
          style={{
            position: 'absolute',
            top: rowLayout.positions[displayIndex] + HEADER_HEIGHT,
            height: rowHeight,
          }}
        >
          {/* Frozen cells */}
          <div
            className="frozen-cells"
            style={{ width: allColumns.frozenWidth }}
          >
            <div
              className={`row-number ${isRowSelected ? 'selected' : ''}`}
              style={{ width: ROW_NUMBER_WIDTH, height: getRowHeight(activeSheet, rowIndex, ROW_HEIGHT) }}
              onClick={() => selectRow(rowNumber)}
              onContextMenu={(e) => handleRowContextMenu(e, rowNumber)}
            >
              {rowNumber}
              <div
                className={`row-resize-handle ${resizing?.type === 'row' && resizing?.index === rowIndex ? 'resizing' : ''}`}
                onMouseDown={(e) => handleRowResizeStart(e, rowIndex, getRowHeight(activeSheet, rowIndex, ROW_HEIGHT))}
              />
            </div>
            {/* Action column (PDF + Actions) */}
            <div
              className="cell action-col-cell"
              style={{ width: ACTION_COL_WIDTH }}
            >
              {getCellValue(activeSheet, `A${rowNumber}`) && (
                <>
                  <button
                    className="action-icon-btn"
                    title="Voir le formulaire VT"
                    onClick={(e) => {
                      e.stopPropagation()
                      // Read PDF data from cells (persists across reloads)
                      const colMap = getColumnIdToLetterMap(activeSheet)
                      const getCell = (colId) => {
                        const letter = colMap[colId]
                        return letter ? getCellValue(activeSheet, `${letter}${rowNumber}`) : ''
                      }
                      const clientColId = activeSheet === 'btoc-comptant' ? 'Colonne1' : 'NOM_PRENOM'
                      const cellData = {
                        commercial: getCell('COMMERCIAL'),
                        clientName: getCell(clientColId),
                        date: getCell('DATE_DDE_VT'),
                        adresse: getCell('ADRESSE_INSTALLATION'),
                        codePostal: getCell('CODE_POSTAL'),
                        commune: getCell('VILLE'),
                        email: getCell('EMAIL'),
                        tel: getCell('TELEPHONE'),
                        typeContrat: activeSheet === 'btoc-abonnement' ? 'abonnement' : 'comptant',
                        contratMaintenance: getCell('CONTRAT_MAINTENANCE'),
                        puissance: getCell('PUISSANCE_PREVI') || getCell('PUISSANCE_REALISEE'),
                        chargesAffaires: getCell('CHARGES_AFFAIRES'),
                      }
                      // Merge with persisted vtFormData from DB (stored as __vtFormData:row in cells)
                      const persistedJson = getCellValue(activeSheet, `__vtFormData:${rowNumber}`)
                      const persistedData = persistedJson ? JSON.parse(persistedJson) : null
                      // Fall back to in-memory vtFormData (before first save)
                      const storedData = persistedData || vtFormData[`${activeSheet}:${rowNumber}`]
                      if (storedData) {
                        Object.keys(storedData).forEach(key => {
                          if (!cellData[key]) cellData[key] = storedData[key]
                        })
                      }
                      // Merge technical VT form data (step 2) — only fills missing keys
                      try {
                        const vtTechJson = getCellValue(activeSheet, `__vtTechForm:${rowNumber}`)
                        if (vtTechJson) {
                          const vtTech = JSON.parse(vtTechJson)
                          Object.keys(vtTech).forEach(key => {
                            if (!cellData[key]) cellData[key] = vtTech[key]
                          })
                        }
                      } catch { /* ignore */ }
                      // Spreadsheet cells always win — apply on top of everything
                      const dateRetourCell = getCell('DATE_RETOUR_VT')
                      if (dateRetourCell) cellData.dateRetour = dateRetourCell
                      setPdfModalData(cellData)
                    }}
                  >
                    <FileText size={14} />
                  </button>
                  <button
                    className="action-icon-btn"
                    title="Actions"
                    onClick={(e) => {
                      e.stopPropagation()
                      const colMap = getColumnIdToLetterMap(activeSheet)
                      const getCell = (colId) => {
                        const letter = colMap[colId]
                        return letter ? getCellValue(activeSheet, `${letter}${rowNumber}`) : ''
                      }
                      const clientColId = activeSheet === 'btoc-comptant' ? 'Colonne1' : 'NOM_PRENOM'
                      const sheetConfig = SHEETS.find(s => s.id === activeSheet)
                      setCrmModalData({
                        rowNumber,
                        activeSheet,
                        clientName:    getCell(clientColId),
                        sheetLabel:    sheetConfig?.name || activeSheet,
                        // Coordonnées clients
                        commercial:    getCell('COMMERCIAL'),
                        objectif:      getCell('OBJECTIF'),
                        typeContact:   getCell('TYPE_CONTACT'),
                        adresse:       getCell('ADRESSE_INSTALLATION'),
                        ville:         getCell('VILLE'),
                        codePostal:    getCell('CODE_POSTAL'),
                        telephone:     getCell('TELEPHONE'),
                        email:         getCell('EMAIL'),
                        typeProduit:   getCell('TYPE_PRODUIT'),
                        interlocuteur: getCell('INTERLOCUTEUR') || undefined,
                        // Étapes suivi de dossier
                        dateDemandeVT: getCell('DATE_DDE_VT'),
                        dateRetourVT:  getCell('DATE_RETOUR_VT'),
                        nomenclature:  getCell('RECEPTION_BDC'),
                        nDP:           getCell('N_DP') || getCell('DEMANDE_DP'),
                        raccordement:  getCell('DDE_RACC_EDF'),
                        vad:           getCell('ENREGISTREMENT_ADMIN'),
                        datePose:      getCell('DATE_REELLE_POSE') || getCell('DATE_POSE'),
                        consuelVise:   getCell('CONSUEL_VISE'),
                        mesEDF:        getCell('MES_EDF'),
                        chargesAffaires: getCell('CHARGES_AFFAIRES'),
                        vtTechFormData: (() => {
                          try {
                            const json = getCellValue(activeSheet, `__vtTechForm:${rowNumber}`)
                            return json ? JSON.parse(json) : null
                          } catch { return null }
                        })(),
                        nomenclatureData: (() => {
                          try {
                            const json = getCellValue(activeSheet, `__nomenclature:${rowNumber}`)
                            return json ? JSON.parse(json) : null
                          } catch { return null }
                        })(),
                      })
                    }}
                  >
                    <MoreVertical size={14} />
                  </button>
                </>
              )}
            </div>

            {frozenCols.map((col) => {
              const cellId = `${col.dataLetter}${rowIndex + 1}`
              const isSelected = isCellSelected(cellId)
              const isEditing = editingCell === cellId
              const value = getCellValue(activeSheet, cellId)
              const style = getCellStyle(activeSheet, cellId)
              const borderClasses = getSelectionBorderClasses(cellId)

              return (
                <div
                  key={col.id}
                  className={`cell frozen ${isSelected ? 'selected' : ''} ${borderClasses}`}
                  style={{ width: col.width }}
                  onClick={(e) => handleCellClick(cellId, e)}
                  onDoubleClick={() => handleCellDoubleClick(cellId)}
                  onMouseDown={(e) => handleMouseDown(cellId, e)}
                  onMouseEnter={() => handleMouseEnter(cellId)}
                  onContextMenu={(e) => handleContextMenu(e, cellId)}
                >
                  {isEditing ? (
                    <input
                      type="text"
                      className="cell-input"
                      value={editValue}
                      onChange={handleCellEdit}
                      onBlur={handleCellEditComplete}
                      onKeyDown={handleEditKeyDown}
                      autoFocus
                    />
                  ) : (
                    <div className="cell-content" style={{ ...style, textAlign: col.align || undefined }}>
                      {isDateColumn(col.id) ? formatDateDisplay(value) : value}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Scrollable cells */}
          <div className="scrollable-cells" style={{ position: 'relative' }}>
            {isCancelled && (
              <div className="sp-cancelled-overlay">
                <span className="sp-cancelled-label">Annulé</span>
              </div>
            )}
            {visibleNonFrozenCols.map((col) => {
              const cellId = `${col.dataLetter}${rowIndex + 1}`
              const isSelected = isCellSelected(cellId)
              const isEditing = editingCell === cellId
              const value = getCellValue(activeSheet, cellId)
              const style = getCellStyle(activeSheet, cellId)
              const borderClasses = getSelectionBorderClasses(cellId)
              const isDropdown = DROPDOWN_COLUMNS.has(col.id)

              return (
                <div
                  key={col.id}
                  className={`cell ${isSelected ? 'selected' : ''} ${borderClasses}`}
                  style={{
                    position: 'absolute',
                    left: col.position - allColumns.frozenWidth,
                    width: col.width,
                    backgroundColor: isSelected ? undefined : col.groupColors?.light || undefined,
                    borderLeft: col.isGroupStart ? `2px solid ${col.groupColors?.border || 'var(--border-medium)'}` : undefined,
                  }}
                  onClick={(e) => handleCellClick(cellId, e)}
                  onDoubleClick={() => handleCellDoubleClick(cellId)}
                  onMouseDown={(e) => handleMouseDown(cellId, e)}
                  onMouseEnter={() => handleMouseEnter(cellId)}
                  onContextMenu={(e) => handleContextMenu(e, cellId)}
                >
                  {isEditing && isDropdown ? (
                    <div
                      className="cell-dropdown-anchor"
                      ref={(el) => {
                        if (el && !cellDropdownPos) {
                          const rect = el.getBoundingClientRect()
                          setCellDropdownPos({ top: rect.top, left: rect.left, width: Math.max(rect.width, 180) })
                        }
                      }}
                    />
                  ) : isEditing ? (
                    <input
                      type="text"
                      className="cell-input"
                      value={editValue}
                      onChange={handleCellEdit}
                      onBlur={handleCellEditComplete}
                      onKeyDown={handleEditKeyDown}
                      autoFocus
                    />
                  ) : (
                    <div className="cell-content" style={{ ...style, textAlign: col.align || undefined }}>
                      {isDateColumn(col.id) ? formatDateDisplay(value) : value}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    return rows
  }

  return (
    <div className="spreadsheet-container" ref={containerRef}>
      <div
        className="spreadsheet-body"
        ref={scrollableRef}
        onScroll={handleScroll}
      >
        <div
          className="spreadsheet-content"
          style={{
            height: rowLayout.totalHeight + HEADER_HEIGHT,
            width: allColumns.totalWidth,
          }}
        >
          {renderColumnHeaders()}
          {renderRows()}
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          cellId={contextMenu.cellId}
          onClose={closeContextMenu}
        />
      )}

      {headerContextMenu && (
        <HeaderContextMenu
          x={headerContextMenu.x}
          y={headerContextMenu.y}
          type={headerContextMenu.type}
          index={headerContextMenu.index}
          onClose={closeHeaderContextMenu}
        />
      )}

      <PdfViewerModal
        isOpen={!!pdfModalData}
        onClose={() => setPdfModalData(null)}
        data={pdfModalData}
      />

      <CRMModal
        isOpen={!!crmModalData}
        onClose={() => setCrmModalData(null)}
        data={crmModalData}
      />

      {/* Filter dropdown portal */}
      {showColumnFilter && filterDropdownPos && createPortal(
        <div
          ref={columnFilterRef}
          className="column-filter-dropdown"
          style={{ position: 'fixed', top: filterDropdownPos.top, left: filterDropdownPos.left }}
        >
          <div className="column-filter-header">Filtrer par technicien</div>
          <div className="column-filter-options">
            <button
              className={`column-filter-option ${!columnFilter ? 'selected' : ''}`}
              onClick={() => { setColumnFilter(null); setShowColumnFilter(false) }}
            >
              Tous
            </button>
            {uniqueChargesAffaires.map((name) => (
              <button
                key={name}
                className={`column-filter-option ${columnFilter === name ? 'selected' : ''}`}
                onClick={() => { setColumnFilter(name); setShowColumnFilter(false) }}
              >
                {name}
              </button>
            ))}
          </div>
          {columnFilter && (
            <div className="column-filter-footer">
              <button
                className="column-filter-clear"
                onClick={() => { setColumnFilter(null); setShowColumnFilter(false) }}
              >
                Effacer le filtre
              </button>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Commercial filter dropdown portal */}
      {showCommercialFilter && commercialFilterDropdownPos && createPortal(
        <div
          ref={commercialFilterRef}
          className="column-filter-dropdown"
          style={{ position: 'fixed', top: commercialFilterDropdownPos.top, left: commercialFilterDropdownPos.left }}
        >
          <div className="column-filter-header">Filtrer par commercial</div>
          <div className="column-filter-options">
            <button
              className={`column-filter-option ${!commercialFilter ? 'selected' : ''}`}
              onClick={() => { setCommercialFilter(null); setShowCommercialFilter(false) }}
            >
              Tous
            </button>
            {uniqueCommercials.map((name) => (
              <button
                key={name}
                className={`column-filter-option ${commercialFilter === name ? 'selected' : ''}`}
                onClick={() => { setCommercialFilter(name); setShowCommercialFilter(false) }}
              >
                {name}
              </button>
            ))}
          </div>
          {commercialFilter && (
            <div className="column-filter-footer">
              <button
                className="column-filter-clear"
                onClick={() => { setCommercialFilter(null); setShowCommercialFilter(false) }}
              >
                Effacer le filtre
              </button>
            </div>
          )}
        </div>,
        document.body
      )}

      {/* Cell dropdown portal (CHARGES_AFFAIRES) */}
      {editingCell && cellDropdownPos && isDropdownCell(editingCell) && createPortal(
        <div
          className="cell-dropdown-portal"
          style={{ position: 'fixed', top: cellDropdownPos.top, left: cellDropdownPos.left, width: cellDropdownPos.width }}
        >
          <div className="cell-dropdown-list">
            <button
              className={`cell-dropdown-option ${!editValue ? 'selected' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect('') }}
            >
              -- Aucun --
            </button>
            {techniciens.map((t) => {
              const fullName = `${t.prenom} ${t.nom}`
              return (
                <button
                  key={t.id}
                  className={`cell-dropdown-option ${editValue === fullName ? 'selected' : ''}`}
                  onMouseDown={(e) => { e.preventDefault(); handleDropdownSelect(fullName) }}
                >
                  {fullName}
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// Helper functions
function getColumnLetter(index) {
  let letter = ''
  let num = index
  while (num >= 0) {
    letter = String.fromCharCode((num % 26) + 65) + letter
    num = Math.floor(num / 26) - 1
  }
  return letter
}

function parseCellId(cellId) {
  const match = cellId.match(/^([A-Z]+)(\d+)$/)
  if (!match) return [null, null]
  return [match[1], parseInt(match[2], 10)]
}
