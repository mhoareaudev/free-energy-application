import { useRef, useEffect, useCallback, useState } from 'react'
import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Link, Image, Square, X, Upload,
} from 'lucide-react'
import { storageUpload } from '../lib/supabase'
import './RichTextEditor.css'

export const VT_EMAIL_VARIABLES = [
  { key: 'nom_client',     label: 'Nom client' },
  { key: 'commercial',     label: 'Commercial' },
  { key: 'adresse',        label: 'Adresse' },
  { key: 'ville',          label: 'Ville' },
  { key: 'code_postal',    label: 'Code postal' },
  { key: 'total_ttc',      label: 'Total TTC' },
  { key: 'date_signature', label: 'Date signature' },
  { key: 'telephone',      label: 'Téléphone' },
  { key: 'email_client',   label: 'Email client' },
  { key: 'type_contrat',   label: 'Type contrat' },
  { key: 'puissance',      label: 'Puissance (kWc)' },
]

const FONT_FAMILIES = [
  { value: 'Arial',             label: 'Arial' },
  { value: 'Georgia',           label: 'Georgia' },
  { value: 'Times New Roman',   label: 'Times New Roman' },
  { value: 'Courier New',       label: 'Courier New' },
  { value: 'Verdana',           label: 'Verdana' },
  { value: 'Trebuchet MS',      label: 'Trebuchet MS' },
]

const FONT_SIZES = [
  { value: '1', label: 'Très petit' },
  { value: '2', label: 'Petit' },
  { value: '3', label: 'Normal' },
  { value: '5', label: 'Grand' },
  { value: '6', label: 'Très grand' },
  { value: '7', label: 'Titre' },
]

// Prevent editor blur when clicking toolbar controls
const nb = e => e.preventDefault()

export default function RichTextEditor({ value, onChange, placeholder = 'Rédigez votre email ici…' }) {
  const editorRef    = useRef(null)
  const lastSelRef   = useRef(null)
  const textColorRef = useRef(null)
  const bgColorRef   = useRef(null)

  const [btnDialog, setBtnDialog] = useState(null)
  const [imgDialog, setImgDialog] = useState(false)
  const [imgDragging, setImgDragging] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const [imgError, setImgError] = useState(null)
  const imgFileRef = useRef(null)

  // ── Resize overlay ──
  const [selected, setSelected] = useState(null)
  const wrapperRef = useRef(null)

  // Set initial HTML only on mount
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = value || ''
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fireChange = useCallback(() => {
    onChange(editorRef.current?.innerHTML ?? '')
  }, [onChange])

  const updateOverlay = useCallback(el => {
    if (!el || !wrapperRef.current) return
    const wr = wrapperRef.current.getBoundingClientRect()
    const er = el.getBoundingClientRect()
    setSelected({
      el,
      type: el.tagName === 'IMG' ? 'img' : 'btn',
      top:   er.top  - wr.top  + wrapperRef.current.scrollTop,
      left:  er.left - wr.left,
      width: er.width,
      height: er.height,
    })
  }, [])

  const handleEditorClick = useCallback(e => {
    const t = e.target
    if (t.tagName === 'IMG') { updateOverlay(t); return }
    const link = t.closest('a[style]')
    if (link && link.style.background) { updateOverlay(link); return }
    setSelected(null)
  }, [updateOverlay])

  const handleResizeStart = useCallback(e => {
    e.preventDefault()
    e.stopPropagation()
    if (!selected) return
    const el     = selected.el
    const startX = e.clientX
    const startW = el.offsetWidth || el.getBoundingClientRect().width

    const onMove = ev => {
      const newW = Math.max(40, startW + ev.clientX - startX)
      el.style.width    = newW + 'px'
      el.style.maxWidth = newW + 'px'
      updateOverlay(el)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
      fireChange()
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }, [selected, updateOverlay, fireChange])

  const exec = useCallback((cmd, val = null) => {
    document.execCommand('styleWithCSS', false, true)
    document.execCommand(cmd, false, val)
    fireChange()
    editorRef.current?.focus()
  }, [fireChange])

  const saveSelection = useCallback(() => {
    const sel = window.getSelection()
    if (sel?.rangeCount > 0) {
      lastSelRef.current = sel.getRangeAt(0).cloneRange()
    }
  }, [])

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection()
    if (lastSelRef.current && sel) {
      sel.removeAllRanges()
      sel.addRange(lastSelRef.current)
    }
    editorRef.current?.focus()
  }, [])

  const insertVariable = useCallback(key => {
    restoreSelection()
    document.execCommand(
      'insertHTML', false,
      `<span class="rte-inline-var" contenteditable="false">{{${key}}}</span>&nbsp;`
    )
    fireChange()
  }, [restoreSelection, fireChange])

  const handleFontFamily = e => {
    const val = e.target.value
    e.target.value = ''
    exec('fontName', val)
  }

  const handleFontSize = e => {
    const val = e.target.value
    e.target.value = ''
    exec('fontSize', val)
  }

  const handleTextColor = e => exec('foreColor', e.target.value)
  const handleBgColor   = e => exec('hiliteColor', e.target.value)

  const insertLink = () => {
    const url = window.prompt('URL du lien :')
    if (url) exec('createLink', url)
  }

  const openBtnDialog = () => {
    saveSelection()
    setBtnDialog({ text: 'Cliquez ici', url: 'https://', color: '#f97316' })
  }

  const insertButton = () => {
    if (!btnDialog?.url) return
    restoreSelection()
    const { text, url, color } = btnDialog
    const html = `<a href="${url}" style="display:inline-block;background:${color};color:#ffffff;padding:10px 28px;border-radius:6px;text-decoration:none;font-weight:700;font-size:14px;font-family:Arial,sans-serif;">${text}</a>&nbsp;`
    document.execCommand('insertHTML', false, html)
    fireChange()
    setBtnDialog(null)
  }

  const openImgDialog = () => {
    saveSelection()
    setImgDialog(true)
    setImgError(null)
  }

  const uploadAndInsertImage = async file => {
    if (!file || !file.type.startsWith('image/')) {
      setImgError('Fichier invalide — images uniquement.')
      return
    }
    setImgUploading(true)
    setImgError(null)
    try {
      const path = `email-images/${Date.now()}_${file.name}`
      const { publicUrl } = await storageUpload('documents', path, file)
      restoreSelection()
      const html = `<img src="${publicUrl}" alt="" style="max-width:100%;height:auto;display:block;" />`
      document.execCommand('insertHTML', false, html)
      fireChange()
      setImgDialog(false)
    } catch (e) {
      setImgError('Échec de l\'upload : ' + (e?.message || e))
    } finally {
      setImgUploading(false)
    }
  }

  return (
    <div className="rte-root">
      {/* ── Toolbar ── */}
      <div className="rte-toolbar">
        {/* Format */}
        <div className="rte-group">
          <button type="button" className="rte-btn" onMouseDown={nb} onClick={() => exec('bold')} title="Gras (Ctrl+B)">
            <Bold size={14} />
          </button>
          <button type="button" className="rte-btn" onMouseDown={nb} onClick={() => exec('italic')} title="Italique (Ctrl+I)">
            <Italic size={14} />
          </button>
          <button type="button" className="rte-btn" onMouseDown={nb} onClick={() => exec('underline')} title="Souligné (Ctrl+U)">
            <Underline size={14} />
          </button>
        </div>

        <div className="rte-sep" />

        {/* Alignment */}
        <div className="rte-group">
          <button type="button" className="rte-btn" onMouseDown={nb} onClick={() => exec('justifyLeft')} title="Aligner à gauche">
            <AlignLeft size={14} />
          </button>
          <button type="button" className="rte-btn" onMouseDown={nb} onClick={() => exec('justifyCenter')} title="Centrer">
            <AlignCenter size={14} />
          </button>
          <button type="button" className="rte-btn" onMouseDown={nb} onClick={() => exec('justifyRight')} title="Aligner à droite">
            <AlignRight size={14} />
          </button>
        </div>

        <div className="rte-sep" />

        {/* Lists */}
        <div className="rte-group">
          <button type="button" className="rte-btn" onMouseDown={nb} onClick={() => exec('insertUnorderedList')} title="Liste à puces">
            <List size={14} />
          </button>
          <button type="button" className="rte-btn" onMouseDown={nb} onClick={() => exec('insertOrderedList')} title="Liste numérotée">
            <ListOrdered size={14} />
          </button>
          <button type="button" className="rte-btn" onMouseDown={nb} onClick={insertLink} title="Insérer un lien">
            <Link size={14} />
          </button>
          <button type="button" className="rte-btn" onMouseDown={nb} onClick={openBtnDialog} title="Insérer un bouton">
            <Square size={14} />
          </button>
          <button type="button" className="rte-btn" onMouseDown={nb} onClick={openImgDialog} title="Insérer une image">
            <Image size={14} />
          </button>
        </div>

        <div className="rte-sep" />

        {/* Font family */}
        <select
          className="rte-select rte-ff"
          onMouseDown={nb}
          onChange={handleFontFamily}
          defaultValue=""
          title="Police"
        >
          <option value="" disabled>Police</option>
          {FONT_FAMILIES.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        {/* Font size */}
        <select
          className="rte-select rte-fs"
          onMouseDown={nb}
          onChange={handleFontSize}
          defaultValue=""
          title="Taille"
        >
          <option value="" disabled>Taille</option>
          {FONT_SIZES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <div className="rte-sep" />

        {/* Colors */}
        <label className="rte-color-btn" title="Couleur du texte" onMouseDown={nb}>
          <span className="rte-color-icon rte-text-icon">A</span>
          <input ref={textColorRef} type="color" className="rte-color-input" defaultValue="#000000" onChange={handleTextColor} />
        </label>
        <label className="rte-color-btn" title="Couleur de surlignage" onMouseDown={nb}>
          <span className="rte-color-icon rte-hl-icon">A</span>
          <input ref={bgColorRef} type="color" className="rte-color-input" defaultValue="#ffff00" onChange={handleBgColor} />
        </label>
      </div>

      {/* ── Editor ── */}
      <div ref={wrapperRef} className="rte-editor-wrap">
        <div
          ref={editorRef}
          className="rte-body"
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={fireChange}
          onBlur={saveSelection}
          onKeyUp={saveSelection}
          onMouseUp={e => { saveSelection(); handleEditorClick(e) }}
          onClick={handleEditorClick}
        />
        {selected && (
          <div
            className="rte-resize-box"
            style={{ top: selected.top, left: selected.left, width: selected.width, height: selected.height }}
          >
            <div
              className="rte-resize-handle"
              onMouseDown={handleResizeStart}
              title="Glisser pour redimensionner"
            />
          </div>
        )}
      </div>

      {/* ── Button dialog ── */}
      {btnDialog && (
        <div className="rte-dialog">
          <div className="rte-dialog-header">
            <span className="rte-dialog-title">Insérer un bouton</span>
            <button type="button" className="rte-dialog-close" onClick={() => setBtnDialog(null)}><X size={14} /></button>
          </div>
          <div className="rte-dialog-body">
            <label>Texte du bouton</label>
            <input className="rte-dialog-input" value={btnDialog.text}
              onChange={e => setBtnDialog(p => ({ ...p, text: e.target.value }))} placeholder="Cliquez ici" />
            <label>URL</label>
            <input className="rte-dialog-input" value={btnDialog.url}
              onChange={e => setBtnDialog(p => ({ ...p, url: e.target.value }))} placeholder="https://..." />
            <label>Couleur</label>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <input type="color" value={btnDialog.color}
                onChange={e => setBtnDialog(p => ({ ...p, color: e.target.value }))} style={{ width:36, height:28, border:'none', cursor:'pointer' }} />
              <span style={{ fontSize:12, color:'#64748b' }}>{btnDialog.color}</span>
              <div style={{ flex:1, textAlign:'right' }}>
                <a style={{ display:'inline-block', background:btnDialog.color, color:'#fff', padding:'4px 14px', borderRadius:5, fontSize:12, fontWeight:700, textDecoration:'none' }}>
                  {btnDialog.text || 'Aperçu'}
                </a>
              </div>
            </div>
          </div>
          <div className="rte-dialog-footer">
            <button type="button" className="rte-dialog-cancel" onClick={() => setBtnDialog(null)}>Annuler</button>
            <button type="button" className="rte-dialog-confirm" onClick={insertButton}>Insérer</button>
          </div>
        </div>
      )}

      {/* ── Image dialog ── */}
      {imgDialog && (
        <div className="rte-dialog">
          <div className="rte-dialog-header">
            <span className="rte-dialog-title">Insérer une image</span>
            <button type="button" className="rte-dialog-close" onClick={() => setImgDialog(false)}><X size={14} /></button>
          </div>
          <div className="rte-dialog-body">
            <div
              className={`rte-img-drop${imgDragging ? ' rte-img-drop--over' : ''}${imgUploading ? ' rte-img-drop--uploading' : ''}`}
              onClick={() => !imgUploading && imgFileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setImgDragging(true) }}
              onDragLeave={() => setImgDragging(false)}
              onDrop={e => { e.preventDefault(); setImgDragging(false); uploadAndInsertImage(e.dataTransfer.files[0]) }}
            >
              <Upload size={22} color={imgDragging ? '#3b82f6' : '#94a3b8'} />
              <span>{imgUploading ? 'Upload en cours…' : 'Glisser une image ici ou cliquer'}</span>
              <span style={{ fontSize:11, color:'#94a3b8' }}>PNG, JPG, GIF, WebP</span>
            </div>
            {imgError && <div className="rte-img-error">{imgError}</div>}
            <input ref={imgFileRef} type="file" accept="image/*" style={{ display:'none' }}
              onChange={e => { uploadAndInsertImage(e.target.files[0]); e.target.value = '' }} />
          </div>
        </div>
      )}

      {/* ── Variables strip ── */}
      <div className="rte-vars">
        <span className="rte-vars-title">Insérer une variable :</span>
        <div className="rte-vars-chips">
          {VT_EMAIL_VARIABLES.map(v => (
            <button
              key={v.key}
              type="button"
              className="rte-var-chip"
              onMouseDown={e => { e.preventDefault(); saveSelection() }}
              onClick={() => insertVariable(v.key)}
              title={`{{${v.key}}}`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
