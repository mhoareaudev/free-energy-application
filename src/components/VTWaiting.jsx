import './VTWaiting.css'

// Animated SVG clock
function ClockIcon() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Clock face */}
      <circle cx="22" cy="22" r="18" stroke="#f97316" strokeWidth="2.5" fill="none" />
      {/* Hour ticks */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
        const rad = (deg * Math.PI) / 180
        const x1 = 22 + 15 * Math.sin(rad)
        const y1 = 22 - 15 * Math.cos(rad)
        const x2 = 22 + 17 * Math.sin(rad)
        const y2 = 22 - 17 * Math.cos(rad)
        return (
          <line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#fed7aa"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        )
      })}
      {/* Hour hand (static, pointing ~10 o'clock) */}
      <line
        x1="22"
        y1="22"
        x2="15.5"
        y2="13"
        stroke="#f97316"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Minute hand (spinning via CSS) */}
      <line
        className="vtw-clock-svg"
        x1="22"
        y1="22"
        x2="22"
        y2="9"
        stroke="#ea580c"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Center dot */}
      <circle cx="22" cy="22" r="2.5" fill="#f97316" />
    </svg>
  )
}

export default function VTWaiting({ dateDemandeVT, chargesAffaires, clientName, title }) {
  return (
    <div className="vtw-container">
      {/* Animated icon */}
      <div className="vtw-icon-wrap">
        <ClockIcon />
      </div>

      {/* Status badge */}
      <div className="vtw-badge">
        <span className="vtw-badge-dot" />
        En cours
      </div>

      {/* Main text */}
      <p className="vtw-title">{title || 'En attente de la visite technique'}</p>

      {/* Detail card */}
      <div className="vtw-info">
        {clientName && (
          <div className="vtw-info-row">
            <span className="vtw-info-label">Client</span>
            <span className="vtw-info-value">{clientName}</span>
          </div>
        )}
        <div className="vtw-info-row">
          <span className="vtw-info-label">Date de demande</span>
          <span className={`vtw-info-value${!dateDemandeVT ? ' vtw-info-value--empty' : ''}`}>
            {dateDemandeVT || '—'}
          </span>
        </div>
        <div className="vtw-info-row">
          <span className="vtw-info-label">Technicien</span>
          <span className={`vtw-info-value${!chargesAffaires ? ' vtw-info-value--empty' : ''}`}>
            {chargesAffaires || 'Non assigné'}
          </span>
        </div>
      </div>
    </div>
  )
}
