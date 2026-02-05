import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import './HeaderContextMenu.css'

export default function HeaderContextMenu({ x, y, type, index, onClose }) {
  const { deleteRow, deleteColumn } = useSpreadsheet()
  const menuRef = useRef(null)
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

  const handleDelete = () => {
    if (type === 'row') {
      deleteRow(index)
    } else if (type === 'column') {
      deleteColumn(index)
    }
    onClose()
  }

  return (
    <div className="header-context-overlay" onClick={onClose}>
      <div
        ref={menuRef}
        className="header-context-menu"
        style={{ left: menuPosition.x, top: menuPosition.y }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="header-context-item" onClick={handleDelete}>
          <Trash2 size={14} />
          <span>Supprimer {type === 'row' ? 'la ligne' : 'la colonne'}</span>
        </button>
      </div>
    </div>
  )
}
