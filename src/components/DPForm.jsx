import { useState, useRef } from 'react'
import { Send, Upload, Check, X } from 'lucide-react'
import './DPForm.css'

const PLANS = [
  { id: 'cadastral', label: 'Plan cadastral' },
  { id: 'masse',     label: 'Plan de masse' },
  { id: 'toiture',   label: 'Plan de toiture' },
  { id: 'coupe',     label: 'Plan vue coupe élévation bâtiment' },
]

const BATIMENT_TYPES = [
  { id: 'residence_principale', label: 'Résidence principale' },
  { id: 'bureau',               label: 'Bureau' },
  { id: 'entrepot',             label: 'Entrepôt' },
]

const EMPTY_FORM = {
  superficie: '',
  refCadastrale: '',
  zoneParticuliere: '',
  certificatUrbanisme: '',
  permisConstruireName: '',
  typeBatiment: '',
  shon: '',
  plans: [],
  dateDP: '',
  numeroDP: '',
  incompletude: '',
  dateRelance: '',
}

export default function DPForm({ initialData, onSave }) {
  const [phase, setPhase]   = useState(initialData?.phase || 'form')
  const [saving, setSaving]  = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({ ...EMPTY_FORM, ...(initialData?.form || {}) })

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const togglePlan = (id) =>
    setForm(f => ({
      ...f,
      plans: f.plans.includes(id) ? f.plans.filter(p => p !== id) : [...f.plans, id],
    }))

  // ── Save helpers ─────────────────────────────────────────────
  const saveForm = async (overrides = {}) => {
    const merged = { ...form, ...overrides }
    const isComplete =
      merged.incompletude === 'non' && !!merged.dateDP && !!merged.numeroDP
    await onSave({ phase, form: merged, isComplete, numeroDP: merged.numeroDP })
  }

  const saveTracking = async (field, value) => {
    const newForm = { ...form, [field]: value }
    setForm(newForm)
    const isComplete =
      newForm.incompletude === 'non' && !!newForm.dateDP && !!newForm.numeroDP
    await onSave({ phase: 'tracking', form: newForm, isComplete, numeroDP: newForm.numeroDP })
  }

  // ── Send DP request ──────────────────────────────────────────
  const handleSendRequest = async () => {
    setSaving(true)
    await onSave({ phase: 'tracking', form, isComplete: false })
    setPhase('tracking')
    setSaving(false)
  }

  // ── File drag & drop ─────────────────────────────────────────
  const handleFileDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) set('permisConstruireName', file.name)
  }

  // ── TRACKING PHASE ───────────────────────────────────────────
  if (phase === 'tracking') {
    const hasDateAndNum = form.dateDP && form.numeroDP
    const isDone = hasDateAndNum && form.incompletude === 'non'

    return (
      <div className="dp-tracking">
        {isDone && (
          <div className="dp-done-banner">
            <Check size={15} strokeWidth={3} /> DP validée — passage à l'étape RAC
          </div>
        )}

        <div className="dp-tracking-grid">
          <div className="dp-tracking-field">
            <label>DP lancée le</label>
            <input
              type="date"
              className="dp-input"
              value={form.dateDP}
              onChange={e => set('dateDP', e.target.value)}
              onBlur={e => saveTracking('dateDP', e.target.value)}
            />
          </div>

          <div className="dp-tracking-field">
            <label>Numéro de DP</label>
            <input
              type="text"
              className="dp-input"
              value={form.numeroDP}
              onChange={e => set('numeroDP', e.target.value)}
              onBlur={e => saveTracking('numeroDP', e.target.value)}
              placeholder="Ex : DP 069 XXX XX XXXXX"
            />
          </div>
        </div>

        {hasDateAndNum && (
          <div className="dp-tracking-field">
            <label>Incomplétude ?</label>
            <div className="dp-radio-group">
              {['oui', 'non'].map(v => (
                <label
                  key={v}
                  className={`dp-radio-option ${form.incompletude === v ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    value={v}
                    checked={form.incompletude === v}
                    onChange={() => saveTracking('incompletude', v)}
                  />
                  {v === 'oui' ? 'Oui' : 'Non'}
                </label>
              ))}
            </div>
          </div>
        )}

        {hasDateAndNum && form.incompletude === 'oui' && (
          <div className="dp-tracking-field">
            <label>DP relancée le</label>
            <input
              type="date"
              className="dp-input"
              value={form.dateRelance}
              onChange={e => set('dateRelance', e.target.value)}
              onBlur={e => saveTracking('dateRelance', e.target.value)}
            />
          </div>
        )}

        <button
          className="dp-btn dp-btn--ghost dp-back-btn"
          onClick={() => setPhase('form')}
        >
          Voir / modifier le formulaire
        </button>
      </div>
    )
  }

  // ── FORM PHASE (single scrollable form) ─────────────────────
  return (
    <div className="dp-form">
      <div className="dp-fields">

        {/* Étape 1 */}
        <div className="dp-section-title">Étape 1</div>
        <div className="dp-field">
          <label>Superficie du terrain (m²)</label>
          <input type="number" className="dp-input" value={form.superficie}
            onChange={e => set('superficie', e.target.value)} placeholder="Ex : 500" />
        </div>
        <div className="dp-field">
          <label>Référence cadastrale</label>
          <input type="text" className="dp-input" value={form.refCadastrale}
            onChange={e => set('refCadastrale', e.target.value)} placeholder="Ex : Section A n°123" />
        </div>
        <div className="dp-field">
          <label>Zone particulière (Classée, ABF, …)</label>
          <input type="text" className="dp-input" value={form.zoneParticuliere}
            onChange={e => set('zoneParticuliere', e.target.value)} placeholder="Préciser si applicable" />
        </div>

        {/* Étape 2 */}
        <div className="dp-section-title">Étape 2</div>
        <div className="dp-field">
          <label>Titulaire d'un certificat d'urbanisme ?</label>
          <div className="dp-radio-group">
            {['oui', 'non'].map(v => (
              <label key={v} className={`dp-radio-option ${form.certificatUrbanisme === v ? 'selected' : ''}`}>
                <input type="radio" value={v} checked={form.certificatUrbanisme === v}
                  onChange={() => set('certificatUrbanisme', v)} />
                {v === 'oui' ? 'Oui' : 'Non'}
              </label>
            ))}
          </div>
        </div>
        <div className="dp-field">
          <label>Joindre le permis de construire</label>
          <div
            className={`dp-file-drop ${dragOver ? 'drag-over' : ''} ${form.permisConstruireName ? 'has-file' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            {form.permisConstruireName ? (
              <>
                <Check size={15} />
                <span>{form.permisConstruireName}</span>
                <button className="dp-file-remove"
                  onClick={e => { e.stopPropagation(); set('permisConstruireName', '') }}>
                  <X size={13} />
                </button>
              </>
            ) : (
              <>
                <Upload size={15} />
                <span>Glisser-déposer ou cliquer pour sélectionner</span>
                <span className="dp-file-hint">Optionnel</span>
              </>
            )}
            <input ref={fileInputRef} type="file" hidden
              onChange={e => { const f = e.target.files[0]; if (f) set('permisConstruireName', f.name) }} />
          </div>
        </div>
        <div className="dp-field">
          <label>Type de bâtiment</label>
          <div className="dp-radio-group">
            {BATIMENT_TYPES.map(bt => (
              <label key={bt.id} className={`dp-radio-option ${form.typeBatiment === bt.id ? 'selected' : ''}`}>
                <input type="radio" value={bt.id} checked={form.typeBatiment === bt.id}
                  onChange={() => set('typeBatiment', bt.id)} />
                {bt.label}
              </label>
            ))}
          </div>
        </div>
        <div className="dp-field">
          <label>Surface hors œuvre nette — SHON (m²)</label>
          <input type="number" className="dp-input" value={form.shon}
            onChange={e => set('shon', e.target.value)} placeholder="Ex : 120" />
        </div>

        {/* Étape 3 */}
        <div className="dp-section-title">Étape 3</div>
        <div className="dp-field">
          <label>Plans à joindre au dossier</label>
          <div className="dp-checkboxes">
            {PLANS.map(plan => (
              <label key={plan.id} className={`dp-checkbox-option ${form.plans.includes(plan.id) ? 'checked' : ''}`}>
                <input type="checkbox" checked={form.plans.includes(plan.id)}
                  onChange={() => togglePlan(plan.id)} />
                <div className="dp-checkbox-box">
                  {form.plans.includes(plan.id) && <Check size={11} strokeWidth={3} />}
                </div>
                {plan.label}
              </label>
            ))}
          </div>
        </div>

      </div>

      <div className="dp-form-footer">
        <div style={{ flex: 1 }} />
        <button className="dp-btn dp-btn--primary" onClick={handleSendRequest} disabled={saving}>
          <Send size={14} />
          {saving ? 'Envoi...' : 'Envoyer la demande de DP'}
        </button>
      </div>
    </div>
  )
}
