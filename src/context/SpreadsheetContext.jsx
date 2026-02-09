import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase'
import { getColumnIdToLetterMap } from '../data/sheetsConfig'
import { useAuth } from './AuthContext'

const SpreadsheetContext = createContext({})

export const useSpreadsheet = () => useContext(SpreadsheetContext)

const MAX_HISTORY = 50

export const SpreadsheetProvider = ({ children }) => {
  const { user, userProfile } = useAuth()

  const [sheets, setSheets] = useState({})
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

  // Online users (just for showing who's connected)
  const [onlineUsers, setOnlineUsers] = useState([])

  // VT form data stored per row (sheetId:row -> form data) for PDF generation
  const [vtFormData, setVtFormData] = useState({})

  // Ref to prevent concurrent saves
  const savingRef = useRef(false)

  // Timestamp of last successful save (to ignore realtime echoes)
  const lastSaveTimeRef = useRef(0)

  // Ref for pending cell edit (value being typed but not yet committed)
  const pendingEditRef = useRef(null)

  // Cached auth token (so save never calls supabase.auth.getSession which can hang)
  const tokenRef = useRef(null)

  // History for undo/redo
  const historyRef = useRef([])
  const historyIndexRef = useRef(-1)

  // Load data from Supabase on mount
  useEffect(() => {
    const loadSheets = async () => {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('sheets')
          .select('*')

        if (error) {
          console.error('Error loading sheets:', error)
          return
        }

        if (data && data.length > 0) {
          const loadedSheets = {}
          data.forEach(sheet => {
            loadedSheets[sheet.sheet_id] = {
              cells: sheet.data || {},
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
  }, [])

  // Cache auth token so save path never needs to call supabase.auth.getSession()
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      tokenRef.current = session?.access_token || null
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      tokenRef.current = session?.access_token || null
    })
    return () => subscription.unsubscribe()
  }, [])

  // Subscribe to Supabase Realtime for live updates
  useEffect(() => {
    const channel = supabase
      .channel('sheets-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sheets',
        },
        (payload) => {
          console.log('Realtime update received:', payload)

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const { sheet_id, data, styles } = payload.new

            // Ignore echoes: during active save OR within 3s after save
            if (savingRef.current || (Date.now() - lastSaveTimeRef.current < 3000)) {
              console.log('Ignoring realtime echo (save in progress or recent)')
              return
            }

            setSheets(prev => ({
              ...prev,
              [sheet_id]: {
                cells: data || {},
                styles: styles || {},
              }
            }))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Simple presence tracking - just who's online (no selections)
  useEffect(() => {
    if (!user || !userProfile) return

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users = []

        Object.keys(state).forEach(key => {
          const presences = state[key]
          if (presences && presences.length > 0) {
            const presence = presences[0]
            // Don't include current user
            if (presence.user_id !== user.id) {
              users.push({
                id: presence.user_id,
                nom: presence.nom,
                prenom: presence.prenom,
                initials: (presence.prenom?.charAt(0) || '') + (presence.nom?.charAt(0) || '') || '?',
              })
            }
          }
        })

        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: user.id,
            nom: userProfile.nom,
            prenom: userProfile.prenom,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, userProfile])

  // Ref to always have current sheets value for saving
  const sheetsRef = useRef(sheets)
  useEffect(() => {
    sheetsRef.current = sheets
  }, [sheets])

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
      sheetsRef.current = {
        ...sheetsRef.current,
        [sheetId]: {
          ...sheetsRef.current[sheetId],
          cells: {
            ...sheetsRef.current[sheetId]?.cells,
            [cellId]: value,
          }
        }
      }
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

  // Get cell value
  const getCellValue = useCallback((sheetId, cellId) => {
    return sheets[sheetId]?.cells?.[cellId] ?? ''
  }, [sheets])

  // Get cell style
  const getCellStyle = useCallback((sheetId, cellId) => {
    return sheets[sheetId]?.styles?.[cellId] ?? {}
  }, [sheets])

  // Set cell value
  const setCellValue = useCallback((sheetId, cellId, value) => {
    saveToHistory()
    setHasUnsavedChanges(true)
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
    setHasUnsavedChanges(true)
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
    setHasUnsavedChanges(true)
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
    setHasUnsavedChanges(true)
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
    setHasUnsavedChanges(true)
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
    setHasUnsavedChanges(true)
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
    setHasUnsavedChanges(true)
    setSheets(prev => {
      const sheet = prev[sheetId]
      if (!sheet) return prev

      const newCells = {}
      const newStyles = {}

      Object.entries(sheet.cells || {}).forEach(([cellId, value]) => {
        const [col, row] = parseCellId(cellId)
        if (row > afterRow) {
          newCells[`${col}${row + 1}`] = value
        } else {
          newCells[cellId] = value
        }
      })

      Object.entries(sheet.styles || {}).forEach(([cellId, style]) => {
        const [col, row] = parseCellId(cellId)
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
    setHasUnsavedChanges(true)
    setSheets(prev => {
      const sheet = prev[sheetId]
      if (!sheet) return prev

      const newCells = {}
      const newStyles = {}

      Object.entries(sheet.cells || {}).forEach(([cellId, value]) => {
        const [col, cellRow] = parseCellId(cellId)
        if (cellRow < row) {
          newCells[cellId] = value
        } else if (cellRow > row) {
          newCells[`${col}${cellRow - 1}`] = value
        }
      })

      Object.entries(sheet.styles || {}).forEach(([cellId, style]) => {
        const [col, cellRow] = parseCellId(cellId)
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
    setHasUnsavedChanges(true)
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
    setHasUnsavedChanges(true)
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
      setHasUnsavedChanges(true)
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

  // Manual save trigger
  const saveData = useCallback(async () => {
    return await saveAllSheets()
  }, [saveAllSheets])

  // Add a VT request to a specific sheet
  const addVTRequest = useCallback((sheetId, data) => {
    // Initialize sheet if needed
    if (!sheets[sheetId]) {
      setSheets(prev => ({
        ...prev,
        [sheetId]: { cells: {}, styles: {} }
      }))
    }

    // Find the first empty row (start from row 1)
    const sheet = sheets[sheetId] || { cells: {} }
    let nextRow = 1
    while (sheet.cells[`A${nextRow}`] || sheet.cells[`B${nextRow}`] || sheet.cells[`C${nextRow}`]) {
      nextRow++
      if (nextRow > 1000) break // Safety limit
    }

    saveToHistory()
    setHasUnsavedChanges(true)

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
  }, [sheets, saveToHistory])

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
    vtFormData,
    loading,
    saving,
    lastSaved,
    hasUnsavedChanges,
    onlineUsers,
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
