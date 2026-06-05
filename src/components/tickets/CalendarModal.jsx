import { useState, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight, CalendarDays, User } from 'lucide-react'

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

const INSTALL_LABELS = {
  chauffe_eau_solaire:      'Chauffe-eau solaire',
  borne_recharge:           'Borne de recharge',
  maintenance_pv:           'Maintenance PV',
  maintenance_industrielle: 'Maintenance industrielle',
  autre_installation:       'Autre',
}

function toLocalDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}

function formatFull(date) {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function sameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}

function getCalendarDays(year, month) {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const startOffset = (first.getDay() + 6) % 7
  const days = []
  for (let i = 0; i < startOffset; i++)
    days.push({ date: new Date(year, month, 1 - startOffset + i), current: false })
  for (let d = 1; d <= last.getDate(); d++)
    days.push({ date: new Date(year, month, d), current: true })
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++)
    days.push({ date: new Date(year, month + 1, i), current: false })
  return days
}

function techName(email, technicians) {
  const t = technicians.find(t => t.email === email)
  return t?.full_name?.trim() || email?.split('@')[0] || email
}

function initials(name = '') {
  const parts = name.trim().split(' ')
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase()
}

export function CalendarModal({ ticket, technicians = [], allTickets = [], onConfirm, onClose }) {
  const today = new Date()
  const [year, setYear]         = useState(today.getFullYear())
  const [month, setMonth]       = useState(today.getMonth())
  const [selected, setSelected] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [detailDate, setDetailDate] = useState(null)

  const interventionMap = useMemo(() => {
    const map = {}
    allTickets.forEach(t => {
      if (t.intervention_date) {
        const key = t.intervention_date.slice(0, 10)
        if (!map[key]) map[key] = []
        map[key].push(t)
      }
    })
    return map
  }, [allTickets])

  const initialAssignees = Array.isArray(ticket.assigned_to)
    ? ticket.assigned_to
    : (ticket.assigned_to ? [ticket.assigned_to] : [])
  const [selectedAssignees, setSelectedAssignees] = useState(initialAssignees)

  const toggleAssignee = (email) => {
    setSelectedAssignees(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    )
  }

  const prevMonth = () => { if (month===0){setMonth(11);setYear(y=>y-1)} else setMonth(m=>m-1) }
  const nextMonth = () => { if (month===11){setMonth(0);setYear(y=>y+1)} else setMonth(m=>m+1) }

  const days = getCalendarDays(year, month)

  const handleDayClick = (date, current) => {
    if (!current) return
    const key = toLocalDateStr(date)
    const hasEvents = interventionMap[key]?.length > 0
    setSelected(date)
    setDetailDate(hasEvents ? date : null)
  }

  const detailTickets = detailDate ? (interventionMap[toLocalDateStr(detailDate)] ?? []) : []

  if (confirming && selected) {
    return (
      <>
        <div className="tkm-overlay" onClick={onClose} />
        <div className="tkm-wrap">
          <div className="tkm-modal tkm-modal--sm" style={{ padding: '32px', alignItems: 'center', textAlign: 'center', gap: 20 }}>
            <div className="tkm-cal-confirm-icon"><CalendarDays size={28} color="#ea580c" /></div>
            <div>
              <p className="tkm-cal-confirm-title">Confirmer l'intervention</p>
              <p className="tkm-cal-confirm-ref">Ticket <span className="tkm-ref">{ticket.reference}</span></p>
            </div>
            <div className="tkm-cal-confirm-box">
              <div className="tkm-cal-confirm-date">
                <CalendarDays size={16} color="#f97316" />
                <span className="tkm-cal-confirm-date-text">{formatFull(selected)}</span>
              </div>
              <div>
                <p className="tkm-cal-confirm-tech-label">Techniciens</p>
                {technicians.length === 0 ? (
                  <p className="tkm-empty-text">Aucun technicien configuré</p>
                ) : (
                  <div className="tkm-tech-list">
                    {technicians.map(t => {
                      const checked = selectedAssignees.includes(t.email)
                      const name = t.full_name?.trim() || t.email.split('@')[0]
                      return (
                        <button
                          key={t.email} type="button" onClick={() => toggleAssignee(t.email)}
                          className={`tkm-tech-btn${checked ? ' tkm-tech-btn--checked' : ''}`}
                        >
                          <div className={`tkm-tech-check${checked ? ' tkm-tech-check--on' : ''}`}>
                            {checked && <svg className="tkm-check-icon" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l6.879-6.879a1 1 0 011.414 0z" clipRule="evenodd"/></svg>}
                          </div>
                          <div className="tkm-tech-avatar">{initials(name)}</div>
                          <span className="tkm-tech-name">{name}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="tkm-cal-confirm-footer">
              <button onClick={() => setConfirming(false)} className="tkm-btn-cancel" style={{ flex: 1 }}>Modifier</button>
              <button onClick={() => onConfirm(selected, selectedAssignees)} className="tkm-btn-primary" style={{ flex: 1 }}>Valider</button>
            </div>
          </div>
        </div>
      </>
    )
  }

  const hasDetail = detailDate && detailTickets.length > 0

  return (
    <>
      <div className="tkm-overlay" onClick={onClose} />
      <div className="tkm-wrap">
        <div className={`tkm-cal-container${hasDetail ? ' tkm-cal-container--wide' : ''}`}>

          {/* Calendrier */}
          <div className="tkm-cal-panel">
            <div className="tkm-cal-top">
              <div>
                <h2 className="tkm-header-title">Date d'intervention</h2>
                <p className="tkm-header-sub">{ticket.reference} · {ticket.client_name}</p>
              </div>
              <button className="tkm-close" onClick={onClose}><X size={18} /></button>
            </div>

            <div className="tkm-cal-nav">
              <button onClick={prevMonth} className="tkm-cal-nav-btn"><ChevronLeft size={16} /></button>
              <span className="tkm-cal-month">{MONTHS[month]} {year}</span>
              <button onClick={nextMonth} className="tkm-cal-nav-btn"><ChevronRight size={16} /></button>
            </div>

            <div className="tkm-cal-grid-wrap">
              <div className="tkm-cal-days-header">
                {DAYS.map(d => <div key={d} className="tkm-cal-day-name">{d}</div>)}
              </div>
              <div className="tkm-cal-grid">
                {days.map(({ date, current }, i) => {
                  const isToday    = sameDay(date, today)
                  const isSelected = selected && sameDay(date, selected)
                  const isDetail   = detailDate && sameDay(date, detailDate)
                  const isPast     = date < new Date(today.getFullYear(), today.getMonth(), today.getDate())
                  const key        = toLocalDateStr(date)
                  const hasEvents  = current && interventionMap[key]?.length > 0
                  const eventCount = interventionMap[key]?.length ?? 0

                  let cls = 'tkm-cal-day'
                  if (!current) cls += ' tkm-cal-day--other'
                  else if (isSelected) cls += ' tkm-cal-day--selected'
                  else if (isDetail) cls += ' tkm-cal-day--detail'
                  else if (isToday) cls += ' tkm-cal-day--today'
                  else if (isPast) cls += ' tkm-cal-day--past'
                  else cls += ' tkm-cal-day--active'

                  return (
                    <button key={i} onClick={() => handleDayClick(date, current)} disabled={!current} className={cls}>
                      <span>{date.getDate()}</span>
                      {hasEvents && (
                        <div className="tkm-cal-dots">
                          {Array.from({ length: Math.min(eventCount, 3) }).map((_, di) => (
                            <span key={di} className={`tkm-cal-dot${isSelected ? ' tkm-cal-dot--white' : ''}`} />
                          ))}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="tkm-cal-footer">
              <p className="tkm-cal-footer-text">
                {selected
                  ? <span className="tkm-cal-footer-date">{formatFull(selected)}</span>
                  : detailDate
                  ? <span className="tkm-cal-footer-date">{formatFull(detailDate)} — {detailTickets.length} intervention{detailTickets.length > 1 ? 's' : ''}</span>
                  : 'Sélectionnez une date libre'}
              </p>
              <button
                disabled={!selected} onClick={() => setConfirming(true)}
                className="tkm-btn-primary" style={{ opacity: !selected ? 0.3 : 1, cursor: !selected ? 'not-allowed' : 'pointer' }}
              >
                Suivant
              </button>
            </div>
          </div>

          {/* Panneau détail */}
          {hasDetail && (
            <div className="tkm-cal-detail">
              <div className="tkm-cal-detail-header">
                <p className="tkm-cal-detail-label">Interventions prévues</p>
                <p className="tkm-cal-detail-date">{formatFull(detailDate)}</p>
              </div>
              <div className="tkm-cal-detail-list">
                {detailTickets.map(t => {
                  const ticketAssignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : [])
                  const installLabel = INSTALL_LABELS[t.installation_type]
                  return (
                    <div key={t.id} className="tkm-cal-detail-card">
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span className="tkm-ref">{t.reference}</span>
                        {installLabel && <span style={{ fontSize: 10, color: '#94a3b8' }}>{installLabel}</span>}
                      </div>
                      <p style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{t.client_name}</p>
                      {t.description && <p style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.description}</p>}
                      {ticketAssignees.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
                          <User size={11} color="#94a3b8" />
                          <p style={{ fontSize: 11, color: '#64748b' }}>{ticketAssignees.map(e => techName(e, technicians)).join(', ')}</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  )
}
