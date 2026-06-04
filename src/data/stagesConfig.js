// Étapes du suivi de dossier (partagé entre TransactionDetail et Transactions)
export const DOSSIER_STAGES = [
  { key: 'demande_vt',   label: 'Demande de VT',    color: '#f59e0b' },
  { key: 'vt',           label: 'Visite Technique',  color: '#d97706' },
  { key: 'nomenclature', label: 'Nomenclature',      color: '#06b6d4' },
  { key: 'dp',           label: 'DP',                color: '#3b82f6' },
  { key: 'rac',          label: 'RAC',               color: '#8b5cf6' },
  { key: 'vad',          label: 'VAD',               color: '#ec4899' },
  { key: 'pose',         label: 'Pose',              color: '#f97316' },
  { key: 'consuel',      label: 'Consuel',           color: '#22c55e' },
  { key: 'edf',          label: 'EDF',               color: '#0ea5e9' },
  { key: 'termine',      label: 'Terminé',           color: '#64748b' },
]

// Map label → color pour un accès rapide
export const STAGE_COLOR_MAP = Object.fromEntries(
  DOSSIER_STAGES.map(s => [s.label, s.color])
)
