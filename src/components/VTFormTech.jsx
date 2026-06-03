import { useState } from 'react'
import './VTFormTech.css'

// ── Default form state — keys aligned with PDF field names ────
const DEFAULT_FORM = {
  // Bâtiment
  plans: [],                  // suffixes: 'vue_coupe_elevation_batiment' | 'cadastral' | 'de_toiture' | 'de_masse'

  // Toiture
  type_toiture: [],           // 'mono_pente' | 'bi_pente' | 'autre'
  autre_toiture_texte: '',
  accessibilite: '',          // 'oui' | 'non'

  // Couverture
  type_couverture: [],        // 'tole_ondulee' | 'nervuree' | 'autre'
  autre_couverture_texte: '',
  etat_couverture: '',        // 'bon' | 'moyen' | 'age'
  age_couverture_texte: '',

  // Vis
  etat_vis: '',               // 'bon' | 'moyen' | 'age'
  age_vis_texte: '',
  type_de_vis: '',

  // Charpente
  type_charpente: [],         // 'metallique' | 'bois' | 'autre'
  autre_charpente_texte: '',
  etat_charpente: '',         // 'bon' | 'moyen' | 'age'
  age_etat_charpente_texte: '',
  entraxe_de_pannes: '',

  // Ombre
  zone_ombre: '',             // 'oui' | 'non'

  // Réseau
  compteur: '',               // 'limite_propriete' | 'interieur_batiment'
  disjoncteur: '',            // 'limite_propriete' | 'interieur_batiment'
  arrivee_edf: '',            // 'aerienne' | 'souterrain' | 'aero_souterrain'
  cheminement_retenu: false,

  // Photos — valeurs = noms de champs PDF exacts
  photos: [],

  // Résultats
  commentaires_inclinaison: '',
  commentaires_orientation: '',
  commentaires_latitude: '',
  commentaires_longitude: '',
  commentaires_connexion_internet: '',
  productible: '',
  production_annuelle: '',
  dateRetour: '',             // → Date_2 dans le PDF
  prise_securisee_text: '',
  commentaires_technique: '',
}

// ── Photo options (key = champ PDF exact) ─────────────────────
const PHOTO_OPTIONS = [
  { key: 'photo_facades',                   label: 'Façades' },
  { key: 'photos_batiment',                 label: 'Bâtiment' },
  { key: 'photos_toiture',                  label: 'Toiture' },
  { key: 'photo_situer_environnement_proche', label: 'Environnement proche' },
  { key: 'photo_situer_paysage_lointain',   label: 'Paysage lointain' },
  { key: 'photo_compteur_disjoncteur',      label: 'Compteur / Disjoncteur' },
  { key: 'photo_local_onduleur_retenu',     label: 'Local onduleur retenu' },
  { key: 'photo_toiture_retenue',           label: 'Toiture retenue' },
]

// ── Plan options (suffix après "plan_") ───────────────────────
const PLAN_OPTIONS = [
  { key: 'vue_coupe_elevation_batiment', label: 'Vue / coupe / élévation' },
  { key: 'cadastral',                    label: 'Plan cadastral' },
  { key: 'de_toiture',                   label: 'Plan de toiture' },
  { key: 'de_masse',                     label: 'Plan de masse' },
]

// ── Helper: PillGroup ─────────────────────────────────────────
function PillGroup({ label, options, value, onChange, multi = false }) {
  const handleClick = (key) => {
    if (multi) {
      const arr = Array.isArray(value) ? value : []
      onChange(arr.includes(key) ? arr.filter((v) => v !== key) : [...arr, key])
    } else {
      onChange(value === key ? '' : key)
    }
  }
  const isActive = (key) =>
    multi ? Array.isArray(value) && value.includes(key) : value === key

  return (
    <div className="vtf-group">
      {label && <span className="vtf-label">{label}</span>}
      <div className="vtf-pills">
        {options.map(({ key, label: lbl }) => (
          <button
            key={key}
            type="button"
            className={`vtf-pill${isActive(key) ? ' vtf-pill--active' : ''}`}
            onClick={() => handleClick(key)}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Helper: FormField ─────────────────────────────────────────
function FormField({ label, children }) {
  return (
    <div className="vtf-group">
      {label && <span className="vtf-label">{label}</span>}
      {children}
    </div>
  )
}

// ── Progress dots ─────────────────────────────────────────────
function ProgressDots({ current, total }) {
  return (
    <div className="vtf-progress">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`vtf-progress-dot${
            i < current ? ' vtf-progress-dot--done' : i === current ? ' vtf-progress-dot--active' : ''
          }`}
        />
      ))}
    </div>
  )
}

// ── Shared pill option sets ───────────────────────────────────
const OPTS_OUI_NON = [
  { key: 'oui', label: 'Oui' },
  { key: 'non', label: 'Non' },
]
const OPTS_ETAT = [
  { key: 'bon',   label: 'Bon état' },
  { key: 'moyen', label: 'Moyen' },
  { key: 'age',   label: 'Vétuste / Âgé' },
]
const OPTS_TOITURE = [
  { key: 'mono_pente', label: 'Mono pente' },
  { key: 'bi_pente',   label: 'Bi pente' },
  { key: 'autre',      label: 'Autre' },
]
const OPTS_COUVERTURE = [
  { key: 'tole_ondulee', label: 'Tôle ondulée' },
  { key: 'nervuree',     label: 'Nervurée' },
  { key: 'autre',        label: 'Autre' },
]
const OPTS_CHARPENTE = [
  { key: 'metallique', label: 'Métallique' },
  { key: 'bois',       label: 'Bois' },
  { key: 'autre',      label: 'Autre' },
]
const OPTS_COMPTEUR = [
  { key: 'limite_propriete',    label: 'Limite propriété' },
  { key: 'interieur_batiment',  label: 'Intérieur bâtiment' },
]
const OPTS_EDF = [
  { key: 'aerienne',       label: 'Aérienne' },
  { key: 'souterrain',     label: 'Souterrain' },
  { key: 'aero_souterrain', label: 'Aéro-souterrain' },
]

// ── Main component ────────────────────────────────────────────
export default function VTFormTech({ initialData, clientName, onSave, onSubmit, onCancel }) {
  const [section, setSection] = useState(0)
  const [form, setForm] = useState(() => ({ ...DEFAULT_FORM, ...(initialData || {}) }))

  const set = (key) => (val) => setForm((prev) => ({ ...prev, [key]: val }))
  const setInput = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const SECTION_TITLES = ['Bâtiment', 'Toiture & Couverture', 'Réseau & Photos', 'Résultats']

  // ── Section 0 : Bâtiment ─────────────────────────────────
  const renderSection0 = () => (
    <>
      <div className="vtf-section-title">{SECTION_TITLES[0]}</div>

      <PillGroup label="Plans disponibles" options={PLAN_OPTIONS}
        value={form.plans} onChange={set('plans')} multi />
    </>
  )

  // ── Section 1 : Toiture & Couverture ────────────────────
  const renderSection1 = () => (
    <>
      <div className="vtf-section-title">{SECTION_TITLES[1]}</div>

      <PillGroup label="Type de toiture" options={OPTS_TOITURE}
        value={form.type_toiture} onChange={set('type_toiture')} multi />
      {form.type_toiture.includes('autre') && (
        <FormField label="Préciser type toiture">
          <input className="vtf-input" value={form.autre_toiture_texte}
            onChange={setInput('autre_toiture_texte')} placeholder="Préciser..." />
        </FormField>
      )}

      <PillGroup label="Accessibilité" options={OPTS_OUI_NON}
        value={form.accessibilite} onChange={set('accessibilite')} />

      <PillGroup label="Type de couverture" options={OPTS_COUVERTURE}
        value={form.type_couverture} onChange={set('type_couverture')} multi />
      {form.type_couverture.includes('autre') && (
        <FormField label="Préciser type couverture">
          <input className="vtf-input" value={form.autre_couverture_texte}
            onChange={setInput('autre_couverture_texte')} placeholder="Préciser..." />
        </FormField>
      )}

      <PillGroup label="État couverture" options={OPTS_ETAT}
        value={form.etat_couverture} onChange={set('etat_couverture')} />
      {form.etat_couverture === 'age' && (
        <FormField label="Préciser l'âge / état couverture">
          <input className="vtf-input" value={form.age_couverture_texte}
            onChange={setInput('age_couverture_texte')} placeholder="Ex : 30 ans" />
        </FormField>
      )}

      <PillGroup label="État des vis" options={OPTS_ETAT}
        value={form.etat_vis} onChange={set('etat_vis')} />
      {form.etat_vis === 'age' && (
        <FormField label="Préciser l'âge / état vis">
          <input className="vtf-input" value={form.age_vis_texte}
            onChange={setInput('age_vis_texte')} placeholder="Ex : très oxydées" />
        </FormField>
      )}
      <FormField label="Type de vis">
        <input className="vtf-input" value={form.type_de_vis}
          onChange={setInput('type_de_vis')} placeholder="Ex : autoperceuses" />
      </FormField>

      <PillGroup label="Type de charpente" options={OPTS_CHARPENTE}
        value={form.type_charpente} onChange={set('type_charpente')} multi />
      {form.type_charpente.includes('autre') && (
        <FormField label="Préciser type charpente">
          <input className="vtf-input" value={form.autre_charpente_texte}
            onChange={setInput('autre_charpente_texte')} placeholder="Préciser..." />
        </FormField>
      )}

      <PillGroup label="État charpente" options={OPTS_ETAT}
        value={form.etat_charpente} onChange={set('etat_charpente')} />
      {form.etat_charpente === 'age' && (
        <FormField label="Préciser l'âge / état charpente">
          <input className="vtf-input" value={form.age_etat_charpente_texte}
            onChange={setInput('age_etat_charpente_texte')} placeholder="Ex : 40 ans" />
        </FormField>
      )}

      <FormField label="Entraxe de pannes">
        <input className="vtf-input" value={form.entraxe_de_pannes}
          onChange={setInput('entraxe_de_pannes')} placeholder="Ex : 1.20 m" />
      </FormField>

      <PillGroup label="Zone d'ombre" options={OPTS_OUI_NON}
        value={form.zone_ombre} onChange={set('zone_ombre')} />
    </>
  )

  // ── Section 2 : Réseau & Photos ──────────────────────────
  const renderSection2 = () => (
    <>
      <div className="vtf-section-title">{SECTION_TITLES[2]}</div>

      <PillGroup label="Compteur" options={OPTS_COMPTEUR}
        value={form.compteur} onChange={set('compteur')} />
      <PillGroup label="Disjoncteur" options={OPTS_COMPTEUR}
        value={form.disjoncteur} onChange={set('disjoncteur')} />
      <PillGroup label="Arrivée EDF" options={OPTS_EDF}
        value={form.arrivee_edf} onChange={set('arrivee_edf')} />

      <div className="vtf-group">
        <span className="vtf-label">Cheminement retenu</span>
        <button
          type="button"
          className={`vtf-pill${form.cheminement_retenu ? ' vtf-pill--active' : ''}`}
          onClick={() => set('cheminement_retenu')(!form.cheminement_retenu)}
        >
          {form.cheminement_retenu ? 'Oui' : 'Non'}
        </button>
      </div>

      <FormField label="Photos réalisées">
        <div className="vtf-photos-grid">
          {PHOTO_OPTIONS.map(({ key, label }) => {
            const active = form.photos.includes(key)
            return (
              <button
                key={key}
                type="button"
                className={`vtf-photo-item${active ? ' vtf-photo-item--active' : ''}`}
                onClick={() =>
                  set('photos')(
                    active ? form.photos.filter((p) => p !== key) : [...form.photos, key]
                  )
                }
              >
                {label}
              </button>
            )
          })}
        </div>
      </FormField>
    </>
  )

  // ── Section 3 : Résultats ────────────────────────────────
  const renderSection3 = () => (
    <>
      <div className="vtf-section-title">{SECTION_TITLES[3]}</div>

      <div className="vtf-grid-2">
        <FormField label="Inclinaison">
          <input className="vtf-input" value={form.commentaires_inclinaison}
            onChange={setInput('commentaires_inclinaison')} placeholder="Ex : 30°" />
        </FormField>
        <FormField label="Orientation">
          <input className="vtf-input" value={form.commentaires_orientation}
            onChange={setInput('commentaires_orientation')} placeholder="Ex : Sud" />
        </FormField>
        <FormField label="Latitude">
          <input className="vtf-input" value={form.commentaires_latitude}
            onChange={setInput('commentaires_latitude')} placeholder="Ex : 14.6928" />
        </FormField>
        <FormField label="Longitude">
          <input className="vtf-input" value={form.commentaires_longitude}
            onChange={setInput('commentaires_longitude')} placeholder="Ex : -61.0093" />
        </FormField>
        <FormField label="Connexion Internet">
          <input className="vtf-input" value={form.commentaires_connexion_internet}
            onChange={setInput('commentaires_connexion_internet')} placeholder="Ex : 4G / Fibre" />
        </FormField>
        <FormField label="Prise sécurisée">
          <input className="vtf-input" value={form.prise_securisee_text}
            onChange={setInput('prise_securisee_text')} placeholder="Ex : Oui / Non" />
        </FormField>
        <FormField label="Productible (kWh/an)">
          <input className="vtf-input" value={form.productible}
            onChange={setInput('productible')} placeholder="Ex : 12 500" />
        </FormField>
        <FormField label="Production annuelle (kWh)">
          <input className="vtf-input" value={form.production_annuelle}
            onChange={setInput('production_annuelle')} placeholder="Ex : 11 800" />
        </FormField>
        <FormField label="Date de retour">
          <input type="date" className="vtf-input" value={form.dateRetour}
            onChange={setInput('dateRetour')} />
        </FormField>
      </div>

      <FormField label="Commentaires techniques">
        <textarea className="vtf-textarea" value={form.commentaires_technique}
          onChange={setInput('commentaires_technique')} placeholder="Observations générales..." />
      </FormField>
    </>
  )

  const sections = [renderSection0, renderSection1, renderSection2, renderSection3]
  const isFirst = section === 0
  const isLast  = section === sections.length - 1

  return (
    <div className="vtf-container">
      {clientName && (
        <div style={{ padding: '10px 24px 0', fontSize: 13, color: '#6b7280', flexShrink: 0 }}>
          Client : <strong style={{ color: '#111827' }}>{clientName}</strong>
        </div>
      )}

      <ProgressDots current={section} total={sections.length} />

      <div className="vtf-section">{sections[section]()}</div>

      <div className="vtf-footer">
        <button type="button" className="vtf-btn-neutral"
          onClick={isFirst ? onCancel : () => setSection((s) => s - 1)}>
          Retour
        </button>

        <div className="vtf-footer-spacer" />

        <button type="button" className="vtf-btn-neutral" onClick={() => onSave(form)}>
          Enregistrer pour plus tard
        </button>

        {isLast ? (
          <button type="button" className="vtf-btn-primary" onClick={() => onSubmit(form)}>
            Envoyer la visite technique
          </button>
        ) : (
          <button type="button" className="vtf-btn-neutral" onClick={() => setSection((s) => s + 1)}>
            Suivant
          </button>
        )}
      </div>
    </div>
  )
}
