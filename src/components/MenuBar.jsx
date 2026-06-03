import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Share2, Download, Printer } from 'lucide-react'
import './MenuBar.css'

export default function MenuBar({ activePage, setActivePage }) {
  const [showFichierMenu, setShowFichierMenu] = useState(false)
  const [dropdownPos, setDropdownPos] = useState(null)
  const fichierBtnRef = useRef(null)
  const dropdownRef = useRef(null)

  const openDropdown = useCallback(() => {
    if (fichierBtnRef.current) {
      const rect = fichierBtnRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom, left: rect.left })
    }
    setShowFichierMenu(true)
  }, [])

  const closeDropdown = useCallback(() => {
    setShowFichierMenu(false)
    setDropdownPos(null)
  }, [])

  useEffect(() => {
    if (!showFichierMenu) return
    const handleClick = (e) => {
      if (
        fichierBtnRef.current && !fichierBtnRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        closeDropdown()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showFichierMenu, closeDropdown])

  return (
    <nav className="menubar">
      <div className="menubar-item">
        <button
          ref={fichierBtnRef}
          className={`menubar-btn ${showFichierMenu ? 'active' : ''}`}
          onClick={() => showFichierMenu ? closeDropdown() : openDropdown()}
        >
          Fichier
        </button>
        {showFichierMenu && dropdownPos && createPortal(
          <div
            ref={dropdownRef}
            className="menubar-dropdown"
            style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left }}
          >
            <button
              className="menubar-dropdown-item"
              onClick={closeDropdown}
            >
              <Share2 size={15} />
              <span>Partager</span>
            </button>
            <button
              className="menubar-dropdown-item"
              onClick={closeDropdown}
            >
              <Download size={15} />
              <span>Exporter</span>
            </button>
            <button
              className="menubar-dropdown-item"
              onClick={() => {
                closeDropdown()
                window.print()
              }}
            >
              <Printer size={15} />
              <span>Imprimer</span>
            </button>
          </div>,
          document.body
        )}
      </div>

      <div className="menubar-item">
        <button
          className={`menubar-btn ${activePage === 'spreadsheet' ? 'active-tab' : ''}`}
          onClick={() => setActivePage('spreadsheet')}
        >
          Accueil
        </button>
      </div>
      <div className="menubar-item">
        <button
          className={`menubar-btn ${activePage === 'nomenclatures' ? 'active-tab' : ''}`}
          onClick={() => setActivePage('nomenclatures')}
        >
          Nomenclatures
        </button>
      </div>
    </nav>
  )
}
