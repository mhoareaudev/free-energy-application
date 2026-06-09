import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { supabase, supabaseUrl, supabaseAnonKey, getFreshToken } from '../lib/supabase'
import { getColumnIdToLetterMap } from '../data/sheetsConfig'
import { addDaysToFR } from '../utils/dateUtils'
import { useAuth } from './AuthContext'

const SpreadsheetContext = createContext({})

export const useSpreadsheet = () => useContext(SpreadsheetContext)

const MAX_HISTORY = 50

export const SpreadsheetProvider = ({ children }) => {
  const { user, userProfile } = useAuth()

  const [sheets, _setSheets] = useState({})
  const [activeSheet, setActiveSheet] = useState('btoc-comptant')
  const [selectedCells, setSelectedCells] = useState([])
  const [editingCell, setEditingCell] = useState(null)
  const [clipboard, setClipboard] = useState({ data: null, type: null })
  const [dataToDisplayLetterMap, setDataToDisplayLetterMap] = useState({})
  const [columnWidths, setColumnWidths] = useState({})
  const [rowHeights, setRowHeights] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // VT form data stored per row (sheetId:row -> form data) for PDF generation
  const [vtFormData, setVtFormData] = useState({})

  // Ref to prevent concurrent saves
  const savingRef = useRef(false)

  // Auto-save debounce timer
  const autoSaveTimerRef = useRef(null)

  // Timestamp of last successful save (to ignore realtime echoes)
  const lastSaveTimeRef = useRef(0)

  // Ref for pending cell edit (value being typed but not yet committed)
  const pendingEditRef = useRef(null)

  // Cached auth token (so save never calls supabase.auth.getSession which can hang)
  const tokenRef = useRef(null)

  // History for undo/redo
  const historyRef = useRef([])
  const historyIndexRef = useRef(-1)

  // Cache auth token — se met à jour à chaque changement d'état auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      tokenRef.current = session?.access_token || null
    })
    return () => subscription.unsubscribe()
  }, [])

  // Charger les sheets UNIQUEMENT quand l'utilisateur est authentifié
  // Le tableau de dépendances [user] garantit le rechargement après login
  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }

    const loadSheets = async () => {
      try {
        setLoading(true)

        // Utiliser getFreshToken pour éviter le blocage du client Supabase JS
        const token = await getFreshToken()
        const res = await fetch(
          `${supabaseUrl}/rest/v1/sheets?select=*`,
          {
            headers: {
              'apikey':        supabaseAnonKey,
              'Authorization': `Bearer ${token}`,
              'Content-Type':  'application/json',
            },
          }
        )

        if (!res.ok) {
          console.error('Error loading sheets:', res.status, await res.text())
          return
        }

        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          const loadedSheets = {}
          data.forEach(sheet => {
            loadedSheets[sheet.sheet_id] = {
              cells:  sheet.data   || {},
              styles: sheet.styles || {},
            }
          })
          setSheets(loadedSheets)
        }
      } catch (err) {
        console.error('Error loading sheets:', err)
      } finally {
        setLoading(false)
      }
    }

    loadSheets()
  }, [user])


  // Ref always in sync with sheets — updated synchronously inside every setSheets call
  const sheetsRef = useRef(sheets)

  // Wrapper: computes next state synchronously from sheetsRef.current,
  // so saveAllSheets always reads fresh data regardless of React's batch schedule.
  const setSheets = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(sheetsRef.current) : updater
    sheetsRef.current = next
    _setSheets(next)
  }, [])

  // When tab becomes visible again, ensure clean state and warm up connection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // If savingRef got stuck somehow, reset it
        if (savingRef.current) {
          console.log('Tab visible: resetting stuck savingRef')
          savingRef.current = false
          setSaving(false)
        }
        // Warm up the connection so next save doesn't hang
        fetch(`${supabaseUrl}/rest/v1/sheets?select=sheet_id&limit=1`, {
          headers: { 'apikey': supabaseAnonKey },
        }).then(() => {
          console.log('Connection warmed up after tab switch')
        }).catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Warn user before closing tab with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  // Register a pending edit (called by Spreadsheet when user is typing in a cell)
  const setPendingEdit = useCallback((sheetId, cellId, value) => {
    if (sheetId && cellId) {
      pendingEditRef.current = { sheetId, cellId, value }
    } else {
      pendingEditRef.current = null
    }
  }, [])

  // Upsert a single sheet using raw fetch (bypasses Supabase client which can hang after tab switch)
  const upsertSheet = async (sheetId, sheetData, timeoutMs) => {
    // Use cached token (never calls supabase client during save)
    const token = tokenRef.current || supabaseAnonKey

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/sheets?on_conflict=sheet_id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({
          sheet_id: sheetId,
          data: sheetData.cells || {},
          styles: sheetData.styles || {},
          updated_at: new Date().toISOString(),
        }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!response.ok) {
        const text = await response.text()
        throw new Error(`HTTP ${response.status}: ${text}`)
      }
    } catch (err) {
      clearTimeout(timer)
      throw err
    }
  }

  // Save all sheets to Supabase (with 1 automatic retry on failure)
  const saveAllSheets = useCallback(async () => {
    // Prevent concurrent saves
    if (savingRef.current) {
      console.log('Save already in progress, skipping')
      return false
    }

    // Commit any pending cell edit before saving
    const pendingEdit = pendingEditRef.current
    if (pendingEdit) {
      const { sheetId, cellId, value } = pendingEdit
      setSheets(prev => ({
        ...prev,
        [sheetId]: {
          ...prev[sheetId],
          cells: {
            ...prev[sheetId]?.cells,
            [cellId]: value,
          }
        }
      }))
      pendingEditRef.current = null
    }

    const currentSheets = sheetsRef.current
    if (Object.keys(currentSheets).length === 0) {
      console.log('No sheets to save')
      return false
    }

    savingRef.current = true
    setSaving(true)

    const doSave = async (attempt) => {
      console.log(`Saving sheets (attempt ${attempt}):`, Object.keys(currentSheets))
      const promises = Object.entries(currentSheets).map(([sheetId, sheetData]) =>
        upsertSheet(sheetId, sheetData, 8000)
      )
      await Promise.all(promises)
    }

    try {
      await doSave(1)
      console.log('Save successful')
      lastSaveTimeRef.current = Date.now()
      setLastSaved(new Date())
      setHasUnsavedChanges(false)
      return true
    } catch (firstErr) {
      console.warn('First save attempt failed, retrying...', firstErr.message)
      // Brief pause before retrying with a fresh connection
      await new Promise(r => setTimeout(r, 500))
      try {
        await doSave(2)
        console.log('Save successful on retry')
        lastSaveTimeRef.current = Date.now()
        setLastSaved(new Date())
        setHasUnsavedChanges(false)
        return true
      } catch (retryErr) {
        console.error('Save failed after retry:', retryErr.message)
        return false
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [])

  // Initialize sheet data
  const initializeSheet = useCallback((sheetId) => {
    if (!sheets[sheetId]) {
      setSheets(prev => ({
        ...prev,
        [sheetId]: {
          cells: {},
          styles: {},
        }
      }))
    }
  }, [sheets])

  // Save state to history
  const saveToHistory = useCallback(() => {
    const currentState = JSON.stringify(sheets)
    const history = historyRef.current
    const index = historyIndexRef.current

    // Remove future states if we're not at the end
    if (index < history.length - 1) {
      history.splice(index + 1)
    }

    // Add new state
    history.push(currentState)

    // Limit history size
    if (history.length > MAX_HISTORY) {
      history.shift()
    } else {
      historyIndexRef.current = history.length - 1
    }
  }, [sheets])

  // Undo
  const undo = useCallback(() => {
    const history = historyRef.current
    const index = historyIndexRef.current

    if (index > 0) {
      historyIndexRef.current = index - 1
      const previousState = JSON.parse(history[index - 1])
      setSheets(previousState)
    }
  }, [])

  // Redo
  const redo = useCallback(() => {
    const history = historyRef.current
    const index = historyIndexRef.current

    if (index < history.length - 1) {
      historyIndexRef.current = index + 1
      const nextState = JSON.parse(history[index + 1])
      setSheets(nextState)
    }
  }, [])

  // Get cell value — reads from sheetsRef (always synchronously up-to-date)
  // so callers like modal open handlers never see stale data between renders
  const getCellValue = useCallback((sheetId, cellId) => {
    return sheetsRef.current[sheetId]?.cells?.[cellId] ?? ''
  }, [])

  // Get cell style
  const getCellStyle = useCallback((sheetId, cellId) => {
    return sheetsRef.current[sheetId]?.styles?.[cellId] ?? {}
  }, [])

  // Set cell value
  const setCellValue = useCallback((sheetId, cellId, value) => {
    saveToHistory()
    markDirty()
    setSheets(prev => ({
      ...prev,
      [sheetId]: {
        ...prev[sheetId],
        cells: {
          ...prev[sheetId]?.cells,
          [cellId]: value,
        }
      }
    }))
  }, [saveToHistory])

  // Set cell style
  const setCellStyle = useCallback((sheetId, cellId, style) => {
    saveToHistory()
    markDirty()
    setSheets(prev => ({
      ...prev,
      [sheetId]: {
        ...prev[sheetId],
        styles: {
          ...prev[sheetId]?.styles,
          [cellId]: {
            ...prev[sheetId]?.styles?.[cellId],
            ...style,
          }
        }
      }
    }))
  }, [saveToHistory])

  // Apply style to selected cells
  const applyStyleToSelection = useCallback((style) => {
    if (selectedCells.length === 0) return

    saveToHistory()
    markDirty()
    setSheets(prev => {
      const newStyles = { ...prev[activeSheet]?.styles }
      selectedCells.forEach(cellId => {
        newStyles[cellId] = {
          ...newStyles[cellId],
          ...style,
        }
      })
      return {
        ...prev,
        [activeSheet]: {
          ...prev[activeSheet],
          styles: newStyles,
        }
      }
    })
  }, [selectedCells, activeSheet, saveToHistory])

  // Copy cells
  const copyCells = useCallback(() => {
    if (selectedCells.length === 0) return

    const data = selectedCells.map(cellId => ({
      cellId,
      value: getCellValue(activeSheet, cellId),
      style: getCellStyle(activeSheet, cellId),
    }))

    setClipboard({ data, type: 'copy' })
  }, [selectedCells, activeSheet, getCellValue, getCellStyle])

  // Cut cells
  const cutCells = useCallback(() => {
    if (selectedCells.length === 0) return

    const data = selectedCells.map(cellId => ({
      cellId,
      value: getCellValue(activeSheet, cellId),
      style: getCellStyle(activeSheet, cellId),
    }))

    setClipboard({ data, type: 'cut' })

    // Clear original cells
    saveToHistory()
    markDirty()
    setSheets(prev => {
      const newCells = { ...prev[activeSheet]?.cells }
      const newStyles = { ...prev[activeSheet]?.styles }
      selectedCells.forEach(cellId => {
        delete newCells[cellId]
        delete newStyles[cellId]
      })
      return {
        ...prev,
        [activeSheet]: {
          ...prev[activeSheet],
          cells: newCells,
          styles: newStyles,
        }
      }
    })
  }, [selectedCells, activeSheet, getCellValue, getCellStyle, saveToHistory])

  // Paste cells
  const pasteCells = useCallback(() => {
    if (!clipboard.data || selectedCells.length === 0) return

    const targetCell = selectedCells[0]
    const [targetCol, targetRow] = parseCellId(targetCell)
    const sourceCell = clipboard.data[0].cellId
    const [sourceCol, sourceRow] = parseCellId(sourceCell)

    const colOffset = targetCol.charCodeAt(0) - sourceCol.charCodeAt(0)
    const rowOffset = targetRow - sourceRow

    saveToHistory()
    markDirty()
    setSheets(prev => {
      const newCells = { ...prev[activeSheet]?.cells }
      const newStyles = { ...prev[activeSheet]?.styles }

      clipboard.data.forEach(({ cellId, value, style }) => {
        const [col, row] = parseCellId(cellId)
        const newCol = String.fromCharCode(col.charCodeAt(0) + colOffset)
        const newRow = row + rowOffset
        const newCellId = `${newCol}${newRow}`

        newCells[newCellId] = value
        newStyles[newCellId] = style
      })

      return {
        ...prev,
        [activeSheet]: {
          ...prev[activeSheet],
          cells: newCells,
          styles: newStyles,
        }
      }
    })
  }, [clipboard, selectedCells, activeSheet, saveToHistory])

  // Clear selected cells
  const clearSelectedCells = useCallback(() => {
    if (selectedCells.length === 0) return

    saveToHistory()
    markDirty()
    setSheets(prev => {
      const newCells = { ...prev[activeSheet]?.cells }
      selectedCells.forEach(cellId => {
        delete newCells[cellId]
      })
      return {
        ...prev,
        [activeSheet]: {
          ...prev[activeSheet],
          cells: newCells,
        }
      }
    })
  }, [selectedCells, activeSheet, saveToHistory])

  // Insert row
  const insertRow = useCallback((afterRow, sheetId = activeSheet) => {
    saveToHistory()
    markDirty()
    setSheets(prev => {
      const sheet = prev[sheetId]
      if (!sheet) return prev

      const newCells = {}
      const newStyles = {}

      Object.entries(sheet.cells || {}).forEach(([cellId, value]) => {
        // Handle special meta cells like __vtFormData:N or __vtTechForm:N
        const metaMatch = cellId.match(/^(__\w+):(\d+)$/)
        if (metaMatch) {
          const metaRow = parseInt(metaMatch[2], 10)
          if (metaRow > afterRow) newCells[`${metaMatch[1]}:${metaRow + 1}`] = value
          else newCells[cellId] = value
          return
        }
        const [col, row] = parseCellId(cellId)
        if (!col) { newCells[cellId] = value; return }
        if (row > afterRow) {
          newCells[`${col}${row + 1}`] = value
        } else {
          newCells[cellId] = value
        }
      })

      Object.entries(sheet.styles || {}).forEach(([cellId, style]) => {
        const [col, row] = parseCellId(cellId)
        if (!col) { newStyles[cellId] = style; return }
        if (row > afterRow) {
          newStyles[`${col}${row + 1}`] = style
        } else {
          newStyles[cellId] = style
        }
      })

      return {
        ...prev,
        [sheetId]: {
          ...sheet,
          cells: newCells,
          styles: newStyles,
        }
      }
    })
  }, [activeSheet, saveToHistory])

  // Delete row
  const deleteRow = useCallback((row, sheetId = activeSheet) => {
    saveToHistory()
    markDirty()
    setSheets(prev => {
      const sheet = prev[sheetId]
      if (!sheet) return prev

      const newCells = {}
      const newStyles = {}

      Object.entries(sheet.cells || {}).forEach(([cellId, value]) => {
        // Handle special meta cells like __vtFormData:N or __vtTechForm:N
        const metaMatch = cellId.match(/^(__\w+):(\d+)$/)
        if (metaMatch) {
          const metaRow = parseInt(metaMatch[2], 10)
          if (metaRow < row) newCells[cellId] = value
          else if (metaRow > row) newCells[`${metaMatch[1]}:${metaRow - 1}`] = value
          // metaRow === row: drop (delete with the row)
          return
        }
        const [col, cellRow] = parseCellId(cellId)
        if (!col) { newCells[cellId] = value; return } // unknown format: keep as-is
        if (cellRow < row) {
          newCells[cellId] = value
        } else if (cellRow > row) {
          newCells[`${col}${cellRow - 1}`] = value
        }
      })

      Object.entries(sheet.styles || {}).forEach(([cellId, style]) => {
        const [col, cellRow] = parseCellId(cellId)
        if (!col) { newStyles[cellId] = style; return }
        if (cellRow < row) {
          newStyles[cellId] = style
        } else if (cellRow > row) {
          newStyles[`${col}${cellRow - 1}`] = style
        }
      })

      return {
        ...prev,
        [sheetId]: {
          ...sheet,
          cells: newCells,
          styles: newStyles,
        }
      }
    })
  }, [activeSheet, saveToHistory])

  // Insert column
  const insertColumn = useCallback((afterCol, sheetId = activeSheet) => {
    saveToHistory()
    markDirty()
    setSheets(prev => {
      const sheet = prev[sheetId]
      if (!sheet) return prev

      const afterColCode = afterCol.charCodeAt(0)
      const newCells = {}
      const newStyles = {}

      Object.entries(sheet.cells || {}).forEach(([cellId, value]) => {
        const [col, row] = parseCellId(cellId)
        const colCode = col.charCodeAt(0)
        if (colCode > afterColCode) {
          newCells[`${String.fromCharCode(colCode + 1)}${row}`] = value
        } else {
          newCells[cellId] = value
        }
      })

      Object.entries(sheet.styles || {}).forEach(([cellId, style]) => {
        const [col, row] = parseCellId(cellId)
        const colCode = col.charCodeAt(0)
        if (colCode > afterColCode) {
          newStyles[`${String.fromCharCode(colCode + 1)}${row}`] = style
        } else {
          newStyles[cellId] = style
        }
      })

      return {
        ...prev,
        [sheetId]: {
          ...sheet,
          cells: newCells,
          styles: newStyles,
        }
      }
    })
  }, [activeSheet, saveToHistory])

  // Delete column
  const deleteColumn = useCallback((col, sheetId = activeSheet) => {
    saveToHistory()
    markDirty()
    setSheets(prev => {
      const sheet = prev[sheetId]
      if (!sheet) return prev

      const colCode = col.charCodeAt(0)
      const newCells = {}
      const newStyles = {}

      Object.entries(sheet.cells || {}).forEach(([cellId, value]) => {
        const [cellCol, row] = parseCellId(cellId)
        const cellColCode = cellCol.charCodeAt(0)
        if (cellColCode < colCode) {
          newCells[cellId] = value
        } else if (cellColCode > colCode) {
          newCells[`${String.fromCharCode(cellColCode - 1)}${row}`] = value
        }
      })

      Object.entries(sheet.styles || {}).forEach(([cellId, style]) => {
        const [cellCol, row] = parseCellId(cellId)
        const cellColCode = cellCol.charCodeAt(0)
        if (cellColCode < colCode) {
          newStyles[cellId] = style
        } else if (cellColCode > colCode) {
          newStyles[`${String.fromCharCode(cellColCode - 1)}${row}`] = style
        }
      })

      return {
        ...prev,
        [sheetId]: {
          ...sheet,
          cells: newCells,
          styles: newStyles,
        }
      }
    })
  }, [activeSheet, saveToHistory])

  // Set column width
  const setColumnWidth = useCallback((sheetId, colIndex, width) => {
    setColumnWidths(prev => ({
      ...prev,
      [sheetId]: {
        ...prev[sheetId],
        [colIndex]: Math.max(30, width), // Minimum 30px
      }
    }))
  }, [])

  // Get column width
  const getColumnWidth = useCallback((sheetId, colIndex, defaultWidth) => {
    return columnWidths[sheetId]?.[colIndex] ?? defaultWidth
  }, [columnWidths])

  // Set row height
  const setRowHeight = useCallback((sheetId, rowIndex, height) => {
    setRowHeights(prev => ({
      ...prev,
      [sheetId]: {
        ...prev[sheetId],
        [rowIndex]: Math.max(20, height), // Minimum 20px
      }
    }))
  }, [])

  // Get row height
  const getRowHeight = useCallback((sheetId, rowIndex, defaultHeight) => {
    return rowHeights[sheetId]?.[rowIndex] ?? defaultHeight
  }, [rowHeights])

  // Paste from external clipboard (Excel/text)
  const pasteFromClipboard = useCallback(async (targetCellId) => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return false

      const [targetCol, targetRow] = parseCellId(targetCellId)
      if (!targetCol || !targetRow) return false

      // Parse clipboard content (tab-separated for Excel, newline for rows)
      const rows = text.split(/\r?\n/).filter(row => row.length > 0)

      saveToHistory()
      markDirty()
      setSheets(prev => {
        const newCells = { ...prev[activeSheet]?.cells }

        rows.forEach((row, rowOffset) => {
          const cells = row.split('\t')
          cells.forEach((value, colOffset) => {
            const newCol = String.fromCharCode(targetCol.charCodeAt(0) + colOffset)
            const newRow = targetRow + rowOffset
            const newCellId = `${newCol}${newRow}`
            newCells[newCellId] = value
          })
        })

        return {
          ...prev,
          [activeSheet]: {
            ...prev[activeSheet],
            cells: newCells,
          }
        }
      })
      return true
    } catch (error) {
      console.error('Failed to paste from clipboard:', error)
      return false
    }
  }, [activeSheet, saveToHistory])

  // Auto-save: schedule a save 1.5s after the last change
  const markDirty = useCallback(() => {
    setHasUnsavedChanges(true)
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    autoSaveTimerRef.current = setTimeout(() => {
      saveAllSheets()
    }, 1500)
  }, [saveAllSheets])

  // Immediate save (used by modals after explicit user actions)
  const saveData = useCallback(async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
    // If a save is already running, wait for it to finish before saving
    // (otherwise saveAllSheets returns false and changes are lost)
    if (savingRef.current) {
      await new Promise(resolve => {
        const check = () => {
          if (!savingRef.current) resolve()
          else setTimeout(check, 50)
        }
        setTimeout(check, 50)
      })
    }
    return await saveAllSheets()
  }, [saveAllSheets])

  // Add a VT request to a specific sheet
  const addVTRequest = useCallback((sheetId, data) => {
    // Use sheetsRef.current (always fresh) to avoid stale state issues
    const currentSheets = sheetsRef.current

    // Initialize sheet if needed
    if (!currentSheets[sheetId]) {
      setSheets(prev => ({
        ...prev,
        [sheetId]: { cells: {}, styles: {} }
      }))
    }

    // Find the first available row >= 2 (fills gaps left by deletions)
    const sheet = sheetsRef.current[sheetId] || { cells: {} }
    const usedRows = new Set()
    Object.keys(sheet.cells).forEach(key => {
      if (key.startsWith('__')) return
      if (!sheet.cells[key]) return
      const m = key.match(/^[A-Z]+(\d+)$/)
      if (m) { const r = parseInt(m[1]); if (r >= 2) usedRows.add(r) }
    })
    let nextRow = 2
    while (usedRows.has(nextRow)) nextRow++

    saveToHistory()
    markDirty()

    const colMap = getColumnIdToLetterMap(sheetId)

    setSheets(prev => {
      const currentSheet = prev[sheetId] || { cells: {}, styles: {} }
      const newCells = { ...currentSheet.cells }

      // Helper to set a cell by column ID
      const setCell = (colId, value) => {
        if (value && colMap[colId]) {
          newCells[`${colMap[colId]}${nextRow}`] = value
        }
      }

      // Commercial name (frozen col A)
      setCell('COMMERCIAL', data.commercial)

      // Client name (frozen col C - Colonne1 or NOM_PRENOM depending on sheet)
      const clientCol = sheetId === 'btoc-comptant' ? 'Colonne1' : 'NOM_PRENOM'
      setCell(clientCol, data.clientName)

      // Additional fields from VT form
      if (data.vtFormData) {
        setCell('ADRESSE_INSTALLATION', data.vtFormData.adresse)
        setCell('VILLE', data.vtFormData.commune)
        setCell('CODE_POSTAL', data.vtFormData.codePostal)
        setCell('TELEPHONE', data.vtFormData.tel)
        setCell('EMAIL', data.vtFormData.email)
        setCell('DATE_DDE_VT', data.dateDemandeVT)
        setCell('ECHEANCE', addDaysToFR(data.dateDemandeVT, 7))
        setCell('CHARGES_AFFAIRES', data.chargesAffaires)

        // Persist full VT form data for PDF generation (survives page reload)
        newCells[`__vtFormData:${nextRow}`] = JSON.stringify(data.vtFormData)
      }

      return {
        ...prev,
        [sheetId]: {
          ...currentSheet,
          cells: newCells,
        }
      }
    })

    // Also keep in memory for immediate use before save
    if (data.vtFormData) {
      setVtFormData(prev => ({
        ...prev,
        [`${sheetId}:${nextRow}`]: data.vtFormData,
      }))
    }

    // Switch to the target sheet
    setActiveSheet(sheetId)
    return nextRow
  }, [saveToHistory])

  // Add a contact-only row (no commercial / VT form)
  const addContactRow = useCallback((sheetId, { clientName, email, adresse, codePostal, commune, tel }) => {
    if (!sheetsRef.current[sheetId]) {
      setSheets(prev => ({ ...prev, [sheetId]: { cells: {}, styles: {} } }))
    }
    const sheet = sheetsRef.current[sheetId] || { cells: {} }
    const usedRows2 = new Set()
    Object.keys(sheet.cells).forEach(key => {
      if (key.startsWith('__')) return
      if (!sheet.cells[key]) return
      const m = key.match(/^[A-Z]+(\d+)$/)
      if (m) { const r = parseInt(m[1]); if (r >= 2) usedRows2.add(r) }
    })
    let nextRow = 2
    while (usedRows2.has(nextRow)) nextRow++
    saveToHistory()
    markDirty()
    const colMap = getColumnIdToLetterMap(sheetId)
    setSheets(prev => {
      const currentSheet = prev[sheetId] || { cells: {}, styles: {} }
      const newCells = { ...currentSheet.cells }
      const setCell = (colId, value) => { if (value && colMap[colId]) newCells[`${colMap[colId]}${nextRow}`] = value }
      const clientCol = sheetId === 'btoc-comptant' ? 'Colonne1' : 'NOM_PRENOM'
      setCell(clientCol, clientName)
      setCell('EMAIL', email)
      setCell('ADRESSE_INSTALLATION', adresse)
      setCell('CODE_POSTAL', codePostal)
      setCell('VILLE', commune)
      setCell('TELEPHONE', tel)
      return { ...prev, [sheetId]: { ...currentSheet, cells: newCells } }
    })
    setActiveSheet(sheetId)
    return nextRow
  }, [saveToHistory])

  // Batch import multiple rows across sheets in a single state update (avoids row collisions)
  const batchImportRows = useCallback((importRows) => {
    saveToHistory()
    markDirty()

    setSheets(prev => {
      const next = { ...prev }

      // Group by sheetId
      const bySheet = {}
      importRows.forEach(row => {
        if (!bySheet[row.sheetId]) bySheet[row.sheetId] = []
        bySheet[row.sheetId].push(row)
      })

      Object.entries(bySheet).forEach(([sheetId, rows]) => {
        const currentSheet = next[sheetId] || { cells: {}, styles: {} }
        const newCells = { ...currentSheet.cells }
        const colMap = getColumnIdToLetterMap(sheetId)

        // Build set of already-used rows (from existing + rows added in this batch)
        const usedRows = new Set()
        Object.keys(newCells).forEach(key => {
          if (key.startsWith('__')) return
          if (!newCells[key]) return
          const m = key.match(/^[A-Z]+(\d+)$/)
          if (m) { const r = parseInt(m[1]); if (r >= 2) usedRows.add(r) }
        })

        rows.forEach(row => {
          let nextRow = 2
          while (usedRows.has(nextRow)) nextRow++
          usedRows.add(nextRow)

          const setCell = (colId, value) => {
            if (value !== undefined && value !== null && String(value).trim() !== '' && colMap[colId]) {
              newCells[`${colMap[colId]}${nextRow}`] = String(value)
            }
          }

          const clientCol = sheetId === 'btoc-comptant' ? 'Colonne1' : 'NOM_PRENOM'
          setCell(clientCol, row.clientName)
          setCell('COMMERCIAL', row.commercial)
          setCell('EMAIL', row.email)
          setCell('TELEPHONE', row.tel)
          setCell('ADRESSE_INSTALLATION', row.adresse)
          setCell('VILLE', row.ville)
          setCell('CODE_POSTAL', row.codePostal)
          setCell('DATE_DDE_VT', row.dateDemandeVT)
          setCell('DATE_PREV_VT', row.dateVT)
          setCell('DATE_RETOUR_VT', row.dateRetourVT)
          setCell('PUISSANCE_PREVI', row.puissance)
          setCell('ETAT_DOSSIER', row.etatDossier)
          setCell('CHARGES_AFFAIRES', row.chargesAffaires)
          setCell('DEMANDE_DP', row.demandeDp)
          setCell('N_DP', row.nDp)
          setCell('DATE_PREV_POSE', row.datePrevPose)
          setCell('DATE_REELLE_POSE', row.dateReellePose)
          setCell('DATE_POSE', row.dateReellePose)
          setCell('MES_EDF', row.mesEdf)

          if (row.vtFormData) {
            newCells[`__vtFormData:${nextRow}`] = JSON.stringify(row.vtFormData)
          }
        })

        next[sheetId] = { ...currentSheet, cells: newCells }
      })

      return next
    })
  }, [saveToHistory])

  // Compact all rows of a sheet: move data to rows 2, 3, 4... with no gaps.
  // Also updates Supabase foreign keys in contact_activities, contact_task_lists, contact_metadata.
  const compactRows = useCallback(async (sheetId) => {
    const sheet = sheetsRef.current[sheetId] || { cells: {}, styles: {} }

    // Find all rows that have at least one non-empty non-meta cell
    const usedRowSet = new Set()
    Object.entries(sheet.cells).forEach(([key, val]) => {
      if (key.startsWith('__')) return
      if (!val) return
      const m = key.match(/^[A-Z]+(\d+)$/)
      if (m) { const r = parseInt(m[1]); if (r >= 2) usedRowSet.add(r) }
    })

    const sortedRows = [...usedRowSet].sort((a, b) => a - b)
    if (sortedRows.length === 0) return

    // Build old → new mapping; skip if already compact
    const rowMap = {}
    let changed = false
    sortedRows.forEach((oldRow, i) => {
      const newRow = i + 2
      rowMap[oldRow] = newRow
      if (oldRow !== newRow) changed = true
    })
    if (!changed) return

    // Rebuild cells & styles with new row numbers
    const newCells = {}
    const newStyles = {}

    Object.entries(sheet.cells).forEach(([key, val]) => {
      const metaM = key.match(/^(__[^:]+):(\d+)$/)
      if (metaM) {
        const oldRow = parseInt(metaM[2])
        const newRow = rowMap[oldRow] ?? oldRow
        newCells[`${metaM[1]}:${newRow}`] = val
        return
      }
      const m = key.match(/^([A-Z]+)(\d+)$/)
      if (m) {
        const oldRow = parseInt(m[2])
        if (oldRow < 2) { if (val) newCells[key] = val; return }
        const newRow = rowMap[oldRow] ?? oldRow
        if (val) newCells[`${m[1]}${newRow}`] = val
      }
    })

    Object.entries(sheet.styles || {}).forEach(([key, val]) => {
      const m = key.match(/^([A-Z]+)(\d+)$/)
      if (!m) return
      const oldRow = parseInt(m[2])
      if (oldRow < 2) { newStyles[key] = val; return }
      const newRow = rowMap[oldRow] ?? oldRow
      newStyles[`${m[1]}${newRow}`] = val
    })

    saveToHistory()
    markDirty()
    setSheets(prev => ({ ...prev, [sheetId]: { cells: newCells, styles: newStyles } }))

    // Update Supabase foreign keys
    const prefix = sheetId === 'btoc-comptant' ? 'c' : sheetId === 'btoc-abonnement' ? 'a' : 'b'
    const tables = ['contact_activities', 'contact_task_lists', 'contact_metadata']
    for (const [oldRow, newRow] of Object.entries(rowMap)) {
      if (parseInt(oldRow) === newRow) continue
      const oldId = `${prefix}:${oldRow}`
      const newId = `${prefix}:${newRow}`
      await Promise.allSettled(tables.map(t => supabase.from(t).update({ contact_id: newId }).eq('contact_id', oldId)))
    }
  }, [saveToHistory])

  const clearContactRow = useCallback((sheetId, rowNum) => {
    saveToHistory()
    markDirty()
    setSheets(prev => {
      const sheet = prev[sheetId]
      if (!sheet) return prev
      const newCells  = {}
      const newStyles = {}
      Object.entries(sheet.cells  || {}).forEach(([k, v]) => {
        const meta = k.match(/^(__\w+):(\d+)$/)
        if (meta) { if (parseInt(meta[2]) !== rowNum) newCells[k] = v; return }
        const m = k.match(/^([A-Z]+)(\d+)$/)
        if (m && parseInt(m[2]) === rowNum) return
        newCells[k] = v
      })
      Object.entries(sheet.styles || {}).forEach(([k, v]) => {
        const m = k.match(/^([A-Z]+)(\d+)$/)
        if (m && parseInt(m[2]) === rowNum) return
        newStyles[k] = v
      })
      return { ...prev, [sheetId]: { ...sheet, cells: newCells, styles: newStyles } }
    })
  }, [saveToHistory])

  const value = {
    sheets,
    activeSheet,
    setActiveSheet,
    selectedCells,
    setSelectedCells,
    editingCell,
    setEditingCell,
    clipboard,
    initializeSheet,
    getCellValue,
    getCellStyle,
    setCellValue,
    setCellStyle,
    applyStyleToSelection,
    copyCells,
    cutCells,
    pasteCells,
    clearSelectedCells,
    insertRow,
    deleteRow,
    insertColumn,
    deleteColumn,
    undo,
    redo,
    saveData,
    columnWidths,
    setColumnWidth,
    getColumnWidth,
    rowHeights,
    setRowHeight,
    getRowHeight,
    pasteFromClipboard,
    addVTRequest,
    addContactRow,
    clearContactRow,
    batchImportRows,
    compactRows,
    vtFormData,
    loading,
    saving,
    lastSaved,
    setPendingEdit,
    dataToDisplayLetterMap,
    setDataToDisplayLetterMap,
  }

  return (
    <SpreadsheetContext.Provider value={value}>
      {children}
    </SpreadsheetContext.Provider>
  )
}

// Helper function to parse cell ID (e.g., "A1" -> ["A", 1])
function parseCellId(cellId) {
  const match = cellId.match(/^([A-Z]+)(\d+)$/)
  if (!match) return [null, null]
  return [match[1], parseInt(match[2], 10)]
}
