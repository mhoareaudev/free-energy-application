/**
 * Today's date in DD/MM/YYYY format, always in Réunion time (Indian/Reunion, UTC+4).
 * Safe to call from any browser timezone.
 */
export function todayReunion() {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Indian/Reunion',
    day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(new Date())
  const map = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${map.day}/${map.month}/${map.year}`
}

/**
 * Format a Date object as DD/MM/YYYY.
 * Does NOT rely on toLocaleDateString (unreliable across environments).
 */
export function formatDateFR(date = new Date()) {
  const d = date instanceof Date ? date : new Date()
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

/**
 * Convert YYYY-MM-DD (native date input value) to DD/MM/YYYY.
 * Falls back to today if the input is empty.
 */
export function isoToDMY(isoDate) {
  if (!isoDate) return formatDateFR()
  const parts = isoDate.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return isoDate // already formatted or unknown — return as-is
}

/**
 * Add n days to a DD/MM/YYYY date string and return DD/MM/YYYY.
 */
export function addDaysToFR(ddmmyyyy, n) {
  if (!ddmmyyyy) return ''
  const parts = ddmmyyyy.split('/')
  if (parts.length !== 3) return ''
  const d = new Date(+parts[2], +parts[1] - 1, +parts[0])
  if (isNaN(d.getTime())) return ''
  d.setDate(d.getDate() + n)
  return formatDateFR(d)
}
