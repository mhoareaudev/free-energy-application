import { useMemo, useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import { useAuth } from '../context/AuthContext'
import { getColumnIdToLetterMap } from '../data/sheetsConfig'
import { ilioSupabase } from '../lib/ilioSupabase'
import { supabase } from '../lib/supabase'
import './Calendrier.css'

const EVENT_COLORS = ['#8b5cf6','#f97316','#10b981','#ef4444','#3b82f6','#f59e0b','#ec4899','#0ea5e9']

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const DAYS   = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim']

const EVENT_TYPES = {
  vt_prevue:    { label: 'VT prévue',         color: '#f59e0b', bg: '#fffbeb' },
  pose_prevue:  { label: 'Pose prévue',       color: '#f97316', bg: '#fff7ed' },
  intervention: { label: 'Intervention Ilio', color: '#6366f1', bg: '#eef2ff' },
  custom:       { label: 'Rendez-vous',       color: '#8b5cf6', bg: '#f5f3ff' },
}

function parseFR(str) {
  if (!str) return null
  const p = str.split('/')
  if (p.length !== 3) return null
  const d = new Date(+p[2], +p[1] - 1, +p[0])
  return isNaN(d) ? null : d
}

function toKey(date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function useCalendarEvents() {
  const { sheets } = useSpreadsheet()

  return useMemo(() => {
    const eventMap = {}

    const addEvent = (dateStr, type, label, client) => {
      const d = parseFR(dateStr)
      if (!d) return
      const key = toKey(d)
      if (!eventMap[key]) eventMap[key] = []
      eventMap[key].push({ type, label: `${EVENT_TYPES[type].label} — ${client}` })
    }

    const sheetDefs = [
      { id: 'btoc-comptant',   nameCol: 'Colonne1' },
      { id: 'btoc-abonnement', nameCol: 'NOM_PRENOM' },
      { id: 'btob',            nameCol: 'NOM_PRENOM' },
    ]

    for (const def of sheetDefs) {
      const colMap = getColumnIdToLetterMap(def.id)
      const cells  = sheets[def.id]?.cells || {}
      const rowSet = new Set()
      Object.keys(cells).forEach(k => {
        if (k.startsWith('__') || !cells[k]) return
        const m = k.match(/^[A-Z]+(\d+)$/)
        if (m) { const r = parseInt(m[1]); if (r >= 2) rowSet.add(r) }
      })

      rowSet.forEach(r => {
        if (cells[`__cancelled:${r}`]) return
        const get = id => { const l = colMap[id]; return l ? (cells[`${l}${r}`] || '') : '' }
        const client = get(def.nameCol) || get('COMMERCIAL') || '—'
        if (!client || client === '—') return

        addEvent(get('DATE_PREV_VT'),   'vt_prevue',   '', client)
        addEvent(get('DATE_PREV_POSE'), 'pose_prevue', '', client)
      })
    }

    return eventMap
  }, [sheets])
}

function useTicketEvents() {
  const [ticketEvents, setTicketEvents] = useState({})

  useEffect(() => {
    ilioSupabase
      .from('tickets')
      .select('id, client_name, client_firstname, intervention_date')
      .not('intervention_date', 'is', null)
      .then(({ data }) => {
        if (!data) return
        const map = {}
        data.forEach(t => {
          const d = new Date(t.intervention_date)
          if (isNaN(d)) return
          const key = toKey(d)
          if (!map[key]) map[key] = []
          const name = [t.client_firstname, t.client_name].filter(Boolean).join(' ') || '—'
          map[key].push({ type: 'intervention', label: `Intervention Ilio — ${name}` })
        })
        setTicketEvents(map)
      })
  }, [])

  return ticketEvents
}

function useCustomEvents() {
  const [events, setEvents] = useState([])

  const load = useCallback(async () => {
    const { data } = await supabase.from('calendar_events').select('*').order('date')
    if (data) setEvents(data)
  }, [])

  useEffect(() => { load() }, [load])

  const add = async (event) => {
    await supabase.from('calendar_events').insert([event])
    await load()
  }

  const remove = async (id) => {
    await supabase.from('calendar_events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  return { events, add, remove }
}

export default function Calendrier() {
  const today  = new Date()
  const { userProfile } = useAuth()
  const [year,    setYear]    = useState(today.getFullYear())
  const [month,   setMonth]   = useState(today.getMonth())
  const [selected, setSelected] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form,    setForm]    = useState({ title: '', time: '', color: '#8b5cf6' })
  const [saving,  setSaving]  = useState(false)

  const sheetEvents  = useCalendarEvents()
  const ticketEvents = useTicketEvents()
  const { events: customEventsRaw, add: addCustom, remove: removeCustom } = useCustomEvents()

  const customEventMap = useMemo(() => {
    const map = {}
    customEventsRaw.forEach(e => {
      const d = new Date(e.date)
      const key = toKey(d)
      if (!map[key]) map[key] = []
      map[key].push({ type: 'custom', label: e.title, id: e.id, color: e.color, time: e.time, created_by: e.created_by })
    })
    return map
  }, [customEventsRaw])

  const events = useMemo(() => {
    const merged = { ...sheetEvents }
    Object.entries(ticketEvents).forEach(([key, evs]) => {
      merged[key] = [...(merged[key] || []), ...evs]
    })
    Object.entries(customEventMap).forEach(([key, evs]) => {
      merged[key] = [...(merged[key] || []), ...evs]
    })
    return merged
  }, [sheetEvents, ticketEvents, customEventMap])

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y-1) } else setMonth(m => m-1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y+1) } else setMonth(m => m+1) }
  const goToday   = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); setSelected(null) }

  const handleAddEvent = async () => {
    if (!form.title.trim() || !selected) return
    setSaving(true)
    const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(selected).padStart(2,'0')}`
    await addCustom({
      title: form.title.trim(),
      date:  dateStr,
      time:  form.time || null,
      color: form.color,
      created_by: [userProfile?.prenom, userProfile?.nom].filter(Boolean).join(' ') || 'Inconnu',
    })
    setForm({ title: '', time: '', color: '#8b5cf6' })
    setShowForm(false)
    setSaving(false)
  }

  // Construire la grille du mois (lundi en premier)
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)
  const startDow = (firstDay.getDay() + 6) % 7 // 0=lun
  const totalDays = lastDay.getDate()

  const cells = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const isToday = d => d && year === today.getFullYear() && month === today.getMonth() && d === today.getDate()
  const getKey  = d => d ? `${year}-${month}-${d}` : null
  const getDayEvents = d => (getKey(d) ? events[getKey(d)] || [] : [])

  const selectedEvents = selected ? getDayEvents(selected) : []

  // Compter les events du mois pour la légende
  const monthEventCount = {}
  for (let d = 1; d <= totalDays; d++) {
    const evs = getDayEvents(d)
    evs.forEach(e => { monthEventCount[e.type] = (monthEventCount[e.type] || 0) + 1 })
  }

  return (
    <div className="cal-page">
      {/* Header */}
      <div className="cal-header">
        <div className="cal-nav">
          <button className="cal-nav-btn" onClick={prevMonth}><ChevronLeft size={18} /></button>
          <h1 className="cal-title">{MONTHS[month]} {year}</h1>
          <button className="cal-nav-btn" onClick={nextMonth}><ChevronRight size={18} /></button>
        </div>
        <div className="cal-header-right">
          {Object.entries(monthEventCount).map(([type, count]) => (
            <span key={type} className="cal-legend-chip" style={{ background: EVENT_TYPES[type]?.bg, color: EVENT_TYPES[type]?.color }}>
              {EVENT_TYPES[type]?.label} · {count}
            </span>
          ))}
          <button className="cal-today-btn" onClick={goToday}>Aujourd'hui</button>
        </div>
      </div>

      {/* Grille */}
      <div className="cal-grid-wrap">
        {/* Jours de la semaine */}
        <div className="cal-weekdays">
          {DAYS.map(d => <div key={d} className="cal-weekday">{d}</div>)}
        </div>

        {/* Semaines */}
        <div className="cal-weeks">
          {weeks.map((week, wi) => (
            <div key={wi} className="cal-week">
              {week.map((day, di) => {
                const dayEvents = getDayEvents(day)
                const active    = selected === day
                const todayCls  = isToday(day) ? ' cal-day--today' : ''
                const activeCls = active ? ' cal-day--active' : ''
                const emptyCls  = !day ? ' cal-day--empty' : ''
                return (
                  <div
                    key={di}
                    className={`cal-day${todayCls}${activeCls}${emptyCls}`}
                    onClick={() => day && setSelected(active ? null : day)}
                  >
                    {day && (
                      <>
                        <span className="cal-day-num">{day}</span>
                        <div className="cal-day-events">
                          {dayEvents.slice(0, 3).map((ev, i) => {
                            const color = ev.color || EVENT_TYPES[ev.type]?.color
                            const bg    = ev.type === 'custom' ? (ev.color + '22') : EVENT_TYPES[ev.type]?.bg
                            return (
                              <div key={i} className="cal-event" style={{ background: bg, color }}>
                                <span className="cal-event-title">{ev.label}</span>
                                {ev.type === 'custom' && ev.created_by && (
                                  <span className="cal-event-sub">{ev.created_by}</span>
                                )}
                              </div>
                            )
                          })}
                          {dayEvents.length > 3 && (
                            <div className="cal-event-more">+{dayEvents.length - 3} autres</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Panel latéral si jour sélectionné */}
      {selected && (
        <div className="cal-side">
          <div className="cal-side-header">
            <span className="cal-side-date">{selected} {MONTHS[month]} {year}</span>
            <div style={{ display:'flex', gap:6 }}>
              <button className="cal-side-add" onClick={() => setShowForm(p => !p)} title="Ajouter un RDV">
                <Plus size={14} />
              </button>
              <button className="cal-side-close" onClick={() => { setSelected(null); setShowForm(false) }}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Formulaire d'ajout */}
          {showForm && (
            <div className="cal-form">
              <input
                className="cal-form-input"
                placeholder="Titre du rendez-vous…"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleAddEvent()}
                autoFocus
              />
              <div className="cal-form-row">
                <input
                  type="time"
                  className="cal-form-input cal-form-time"
                  value={form.time}
                  onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                />
                <div className="cal-form-colors">
                  {EVENT_COLORS.map(c => (
                    <button
                      key={c}
                      className={`cal-color-dot${form.color === c ? ' cal-color-dot--active' : ''}`}
                      style={{ background: c }}
                      onClick={() => setForm(p => ({ ...p, color: c }))}
                    />
                  ))}
                </div>
              </div>
              <button className="cal-form-save" onClick={handleAddEvent} disabled={!form.title.trim() || saving}>
                {saving ? 'Enregistrement…' : 'Ajouter'}
              </button>
            </div>
          )}

          {/* Liste des événements */}
          {selectedEvents.length === 0 && !showForm ? (
            <div className="cal-side-empty">Aucun événement ce jour.<br/>Clique sur + pour en ajouter.</div>
          ) : (
            <div className="cal-side-list">
              {selectedEvents.map((ev, i) => {
                const color = ev.color || EVENT_TYPES[ev.type]?.color || '#64748b'
                return (
                  <div key={i} className="cal-side-event" style={{ borderLeftColor: color }}>
                    <div className="cal-side-event-top">
                      <span className="cal-side-event-type" style={{ color }}>
                        {ev.type === 'custom' ? (ev.time ? `${ev.time} — RDV` : 'Rendez-vous') : EVENT_TYPES[ev.type]?.label}
                      </span>
                      {ev.type === 'custom' && (
                        <button className="cal-side-del" onClick={() => removeCustom(ev.id)} title="Supprimer">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                    <span className="cal-side-event-label">{ev.label}</span>
                    {ev.type === 'custom' && ev.created_by && (
                      <span className="cal-side-event-author">{ev.created_by}</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
