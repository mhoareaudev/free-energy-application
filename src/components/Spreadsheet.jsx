import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import { getSheetColumns } from '../data/sheetsConfig'
import ContextMenu from './ContextMenu'
import HeaderContextMenu from './HeaderContextMenu'
import './Spreadsheet.css'

const TOTAL_ROWS = 999
const VISIBLE_BUFFER = 10
const ROW_HEIGHT = 28
const ROW_NUMBER_WIDTH = 40

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

  // Column/row resize state
  const [resizing, setResizing] = useState(null) // { type: 'column'|'row', index, startPos, startSize }
  const resizeRef = useRef(null)

  const columnsConfig = useMemo(() => getSheetColumns(activeSheet), [activeSheet])

  // Calculate all columns with their positions (using custom widths if available)
  const allColumns = useMemo(() => {
    const cols = []
    let position = ROW_NUMBER_WIDTH // Start after row number column

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
      })
      position += customWidth
    })

    const frozenWidth = position // Includes ROW_NUMBER_WIDTH + frozen columns

    // Group columns
    columnsConfig.groups.forEach((group) => {
      group.columns.forEach((col) => {
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
          letter: getColumnLetter(index),
        })
        position += customWidth
      })
    })

    return { columns: cols, frozenWidth, totalWidth: position }
  }, [columnsConfig, activeSheet, getColumnWidth])

  // Memoize frozen and non-frozen columns
  const frozenCols = useMemo(() => allColumns.columns.filter((col) => col.isFrozen), [allColumns.columns])
  const nonFrozenCols = useMemo(() => allColumns.columns.filter((col) => !col.isFrozen), [allColumns.columns])

  // Calculate visible rows
  const visibleRows = useMemo(() => {
    const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - VISIBLE_BUFFER)
    const endRow = Math.min(
      TOTAL_ROWS,
      Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + VISIBLE_BUFFER
    )
    return { startRow, endRow }
  }, [scrollTop, containerHeight])

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

  // Handle scroll with RAF throttling
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

  // Generate cell ID
  const getCellId = useCallback((colIndex, rowIndex) => {
    return `${getColumnLetter(colIndex)}${rowIndex + 1}`
  }, [])

  // Set for O(1) lookup of selected cells
  const selectedCellsSet = useMemo(() => new Set(selectedCells), [selectedCells])

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
    setEditingCell(cellId)
    setEditValue(getCellValue(activeSheet, cellId))
  }, [activeSheet, getCellValue, setEditingCell])

  // Handle cell edit
  const handleCellEdit = useCallback((e) => {
    setEditValue(e.target.value)
  }, [])

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

  // Select entire column
  const selectColumn = useCallback((colLetter) => {
    const newSelection = []
    for (let row = 1; row <= TOTAL_ROWS; row++) {
      newSelection.push(`${colLetter}${row}`)
    }
    setSelectedCells(newSelection)
  }, [setSelectedCells])

  // Select entire row
  const selectRow = useCallback((rowNumber) => {
    const newSelection = []
    allColumns.columns.forEach((col) => {
      newSelection.push(`${col.letter}${rowNumber}`)
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

    nonFrozenCols.forEach((col, index) => {
      if (col.groupName !== currentGroup) {
        if (currentGroup !== null) {
          groups.push({
            name: currentGroup,
            startPos: groupStartPos,
            width: col.position - allColumns.frozenWidth - groupStartPos,
          })
        }
        currentGroup = col.groupName
        groupStartPos = col.position - allColumns.frozenWidth
      }
    })
    if (currentGroup !== null) {
      groups.push({
        name: currentGroup,
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
            {frozenCols.map((col) => {
              const isSelected = selectedCells.some((cellId) => {
                const [letter] = parseCellId(cellId)
                return letter === col.letter
              })
              return (
                <div
                  key={col.id}
                  className={`header-cell letter-header frozen ${isSelected ? 'selected' : ''}`}
                  style={{ width: col.width }}
                  onClick={() => selectColumn(col.letter)}
                  onContextMenu={(e) => handleColumnContextMenu(e, col.letter)}
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
            style={{ transform: `translateX(-${scrollLeft}px)` }}
          >
            {visibleNonFrozenCols.map((col) => {
              const isSelected = selectedCells.some((cellId) => {
                const [letter] = parseCellId(cellId)
                return letter === col.letter
              })
              return (
                <div
                  key={col.id}
                  className={`header-cell letter-header ${isSelected ? 'selected' : ''}`}
                  style={{
                    position: 'absolute',
                    left: col.position - allColumns.frozenWidth,
                    width: col.width,
                  }}
                  onClick={() => selectColumn(col.letter)}
                  onContextMenu={(e) => handleColumnContextMenu(e, col.letter)}
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
            style={{ transform: `translateX(-${scrollLeft}px)` }}
          >
            {groups.map((group, index) => (
              <div
                key={index}
                className="header-cell group-header"
                style={{
                  position: 'absolute',
                  left: group.startPos,
                  width: group.width,
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
            {frozenCols.map((col) => {
              const isSelected = selectedCells.some((cellId) => {
                const [letter] = parseCellId(cellId)
                return letter === col.letter
              })
              return (
                <div
                  key={col.id}
                  className={`header-cell column-header frozen ${isSelected ? 'selected' : ''}`}
                  style={{ width: col.width }}
                >
                  {col.label}
                </div>
              )
            })}
          </div>
          <div
            className="scrollable-header-cells"
            style={{ transform: `translateX(-${scrollLeft}px)` }}
          >
            {visibleNonFrozenCols.map((col) => {
              const isSelected = selectedCells.some((cellId) => {
                const [letter] = parseCellId(cellId)
                return letter === col.letter
              })
              return (
                <div
                  key={col.id}
                  className={`header-cell column-header ${isSelected ? 'selected' : ''}`}
                  style={{
                    position: 'absolute',
                    left: col.position - allColumns.frozenWidth,
                    width: col.width,
                  }}
                >
                  {col.label}
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

    for (let rowIndex = visibleRows.startRow; rowIndex < visibleRows.endRow; rowIndex++) {
      const rowNumber = rowIndex + 1
      const isRowSelected = selectedCells.some((cellId) => {
        const [, row] = parseCellId(cellId)
        return row === rowNumber
      })

      const rowHeight = getRowHeight(activeSheet, rowIndex, ROW_HEIGHT)

      rows.push(
        <div
          key={rowIndex}
          className="spreadsheet-row"
          style={{
            position: 'absolute',
            top: rowIndex * ROW_HEIGHT, // TODO: calculate cumulative height for variable row heights
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
            {frozenCols.map((col) => {
              const cellId = getCellId(col.index, rowIndex)
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
                    <div className="cell-content" style={style}>
                      {value}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Scrollable cells */}
          <div className="scrollable-cells">
            {visibleNonFrozenCols.map((col) => {
              const cellId = getCellId(col.index, rowIndex)
              const isSelected = isCellSelected(cellId)
              const isEditing = editingCell === cellId
              const value = getCellValue(activeSheet, cellId)
              const style = getCellStyle(activeSheet, cellId)
              const borderClasses = getSelectionBorderClasses(cellId)

              return (
                <div
                  key={col.id}
                  className={`cell ${isSelected ? 'selected' : ''} ${borderClasses}`}
                  style={{
                    position: 'absolute',
                    left: col.position - allColumns.frozenWidth,
                    width: col.width,
                  }}
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
                    <div className="cell-content" style={style}>
                      {value}
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
      {renderColumnHeaders()}

      <div
        className="spreadsheet-body"
        ref={scrollableRef}
        onScroll={handleScroll}
      >
        <div
          className="spreadsheet-content"
          style={{
            height: TOTAL_ROWS * ROW_HEIGHT,
            width: allColumns.totalWidth,
          }}
        >
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
