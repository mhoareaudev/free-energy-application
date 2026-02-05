import { useSpreadsheet } from '../context/SpreadsheetContext'
import { SHEETS } from '../data/sheetsConfig'
import './SheetTabs.css'

export default function SheetTabs() {
  const { activeSheet, setActiveSheet, initializeSheet } = useSpreadsheet()

  const handleTabClick = (sheetId) => {
    initializeSheet(sheetId)
    setActiveSheet(sheetId)
  }

  return (
    <div className="sheet-tabs">
      <div className="tabs-container">
        {SHEETS.map((sheet) => (
          <button
            key={sheet.id}
            className={`sheet-tab ${activeSheet === sheet.id ? 'active' : ''}`}
            onClick={() => handleTabClick(sheet.id)}
          >
            {sheet.name}
          </button>
        ))}
      </div>
      <div className="tabs-actions">
        <span className="sheet-info">
          {SHEETS.find(s => s.id === activeSheet)?.name}
        </span>
      </div>
    </div>
  )
}
