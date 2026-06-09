import { useMemo, useState, useEffect, useCallback } from 'react'
import {
  FolderOpen, TrendingUp, Zap, Euro, Users, BarChart2, Activity,
  Mail, CheckCircle, XCircle, RefreshCw, MailOpen, Wrench, Clock,
  FileCheck, Calendar, AlertTriangle, Target, Hammer, ClipboardList,
  CreditCard, ShieldCheck, Package,
} from 'lucide-react'
import { useSpreadsheet } from '../context/SpreadsheetContext'
import { useAuth, ROLES } from '../context/AuthContext'
import { getColumnIdToLetterMap } from '../data/sheetsConfig'
import { STAGE_COLOR_MAP } from '../data/stagesConfig'
import { supabaseInvoke } from '../lib/supabase'
import './Dashboard.css'

// ── Helpers ──────────────────────────────────────────────────
const parseDateFR = str => {
  if (!str) return null
  const p = str.split('/')
  if (p.length !== 3) return null
  const d = new Date(+p[2], +p[1] - 1, +p[0])
  return isNaN(d) ? null : d
}
const fmtEUR = n =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)} M€`
  : n >= 1_000   ? `${(n / 1_000).toFixed(0)} k€`
  : `${Math.round(n)} €`

// ── Data hook (all 3 sheets) ─────────────────────────────────
function useDashboardData(loggedInName, role) {
  const { sheets } = useSpreadsheet()

  return useMemo(() => {
    const sheetDefs = [
      { id: 'btoc-comptant',   nameCol: 'Colonne1',   prefix: 'c', type: 'Comptant'   },
      { id: 'btoc-abonnement', nameCol: 'NOM_PRENOM', prefix: 'a', type: 'Abonnement' },
      { id: 'btob',            nameCol: 'NOM_PRENOM', prefix: 'b', type: 'BtoB'       },
    ]

    const allRows = []
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
        const get = id => { const l = colMap[id]; return l ? (cells[`${l}${r}`] || '') : '' }
        const nom = get(def.nameCol)
        const commercial = get('COMMERCIAL')
        if (!nom && !commercial) return
        const cancelled = !!cells[`__cancelled:${r}`]
        allRows.push({
          id: `${def.prefix}:${r}`, sheetId: def.id, type: def.type, nom, commercial, cancelled,
          signeLe:              get('SIGNE_LE'),
          rdvPris:              get('RDV_PRIS_LE'),
          rdvPerdu:             get('RDV_PERDU'),
          puissanceRealisee:    parseFloat(get('PUISSANCE_REALISEE')) || 0,
          puissancePrevi:       parseFloat(get('PUISSANCE_PREVI'))    || 0,
          totalTTC:             parseFloat(String(get('TOTAL_TTC')).replace(/[^\d.-]/g, ''))          || 0,
          montantAbt:           parseFloat(String(get('MONTANT_TTC_VENTE')).replace(/[^\d.-]/g, '')) || 0,
          resteEncaisser:       parseFloat(String(get('RESTE_ENCAISSER')).replace(/[^\d.-]/g, ''))   || 0,
          financement:          get('FINANCEMENT'),
          typeContact:          get('TYPE_CONTACT'),
          dateDdeVT:            get('DATE_DDE_VT'),
          datePrevVT:           get('DATE_PREV_VT'),
          dateRetourVT:         get('DATE_RETOUR_VT'),
          chargesAffaires:      get('CHARGES_AFFAIRES'),
          demandeDP:            get('DEMANDE_DP'),
          nDP:                  get('N_DP'),
          receptionCNO:         get('RECEPTION_CNO'),
          datePrevPose:         get('DATE_PREV_POSE'),
          dateReellePose:       get('DATE_REELLE_POSE') || get('DATE_POSE'),
          poseur:               get('POSEUR'),
          etatDossier:          get('ETAT_DOSSIER'),
          receptionBDC:         get('RECEPTION_BDC'),
        })
      })
    }

    const isCommercial = role === ROLES.COMMERCIAL && !!loggedInName
    const rows = isCommercial
      ? allRows.filter(r => r.commercial?.toLowerCase().trim() === loggedInName.toLowerCase().trim())
      : allRows

    // ── KPIs — toutes les lignes = clients signés ──
    // Chaque dossier dans l'app est déjà post-signature : l'app est l'outil de suivi après signature.
    const totalDossiers = rows.length
    const activeRows    = rows.filter(r => !r.cancelled)
    const totalCA       = activeRows.reduce((s, r) => s + (r.totalTTC || r.montantAbt), 0)
    const totalKWc      = activeRows.reduce((s, r) => s + r.puissanceRealisee, 0)
    const posesDone     = activeRows.filter(r => r.dateReellePose).length
    const tauxPoses     = activeRows.length > 0 ? Math.round((posesDone / activeRows.length) * 100) : 0

    // Monthly new dossiers — use SIGNE_LE as date d'ouverture, fallback to DATE_DDE_VT
    const now = new Date()
    const monthlyMap = {}
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      monthlyMap[`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`] = 0
    }
    rows.forEach(r => {
      const dateStr = r.signeLe || r.dateDdeVT
      const d = parseDateFR(dateStr); if (!d) return
      const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
      if (k in monthlyMap) monthlyMap[k]++
    })
    const monthly = Object.entries(monthlyMap).map(([k, count]) => {
      const [y, m] = k.split('-')
      return { label: new Date(+y, +m-1, 1).toLocaleDateString('fr-FR', { month: 'short' }), count }
    })

    // Daily — 30 derniers jours (label tous les 7 jours)
    const daily30 = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const label = (i % 7 === 0 || i === 0) ? `${d.getDate()}/${d.getMonth()+1}` : ''
      daily30.push({ iso, label, count: 0 })
    }
    allRows.forEach(r => {
      const dateStr = r.signeLe || r.dateDdeVT
      const d = parseDateFR(dateStr); if (!d) return
      const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const entry = daily30.find(e => e.iso === iso)
      if (entry) entry.count++
    })
    const daily = daily30.map(({ label, count }) => ({ label, count }))

    // Pipeline de suivi technique (progression post-signature)
    const pipeline = [
      { label: 'Dossiers ouverts', count: totalDossiers,                                          color: '#6366f1' },
      { label: 'VT demandée',      count: rows.filter(r => r.dateDdeVT).length,                   color: '#f59e0b' },
      { label: 'VT reçue',         count: rows.filter(r => r.dateRetourVT).length,                color: '#10b981' },
      { label: 'DP lancée',        count: rows.filter(r => r.demandeDP || r.nDP).length,          color: '#f97316' },
      { label: 'CNO reçu',         count: rows.filter(r => r.receptionCNO).length,                color: '#ef4444' },
      { label: 'Posé',             count: posesDone,                                              color: '#8b5cf6' },
    ]

    // Commerciaux performance (tous les dossiers leur sont attribués)
    const commSource = isCommercial ? rows : allRows
    const commMap = {}
    commSource.forEach(r => {
      const n = r.commercial || 'Inconnu'
      if (!commMap[n]) commMap[n] = { total: 0, ca: 0, poses: 0 }
      commMap[n].total++
      commMap[n].ca += r.totalTTC || r.montantAbt
      if (r.dateReellePose) commMap[n].poses++
    })
    const commerciaux = Object.entries(commMap)
      .sort((a, b) => b[1].total - a[1].total).slice(0, 8)
      .map(([name, d]) => ({ name, count: d.total, ca: d.ca, poses: d.poses,
        conv: d.total > 0 ? Math.round((d.poses / d.total) * 100) : 0 }))

    // Type contact
    const contactMap = {}
    rows.forEach(r => { const t = r.typeContact || 'N/A'; contactMap[t]=(contactMap[t]||0)+1 })
    const contacts = Object.entries(contactMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([label,count])=>({label,count}))

    // ── Technique ──
    const today = new Date(); today.setHours(0,0,0,0)
    const awaitingVTList = allRows.filter(r => r.dateDdeVT && !r.dateRetourVT)
    const vtThisWeek     = awaitingVTList.filter(r => {
      const d = parseDateFR(r.datePrevVT); if (!d) return false
      const diff = (d - today) / 86400000; return diff >= 0 && diff <= 7
    })
    const vtOverdueList  = awaitingVTList.filter(r => {
      const d = parseDateFR(r.dateDdeVT); return d && (today - d) / 86400000 > 21
    })
    const dpPendingList  = allRows.filter(r => r.dateDdeVT && r.dateRetourVT && !r.nDP)
    const posesToPlan    = allRows.filter(r => r.receptionCNO && !r.dateReellePose)
    const nextPoses      = allRows
      .filter(r => { const d = parseDateFR(r.datePrevPose); return d && d >= today })
      .sort((a,b) => parseDateFR(a.datePrevPose) - parseDateFR(b.datePrevPose))
      .slice(0, 8)

    const etatMap = {}
    allRows.forEach(r => {
      const e = r.etatDossier || 'Demande de VT'; etatMap[e]=(etatMap[e]||0)+1
    })
    const etatBreakdown = Object.entries(etatMap).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([label,count])=>({label,count}))

    const techMap = {}
    allRows.filter(r => r.chargesAffaires).forEach(r => {
      const n = r.chargesAffaires
      if (!techMap[n]) techMap[n] = { total: 0, done: 0 }
      techMap[n].total++; if (r.dateReellePose) techMap[n].done++
    })
    const techniciens = Object.entries(techMap).sort((a,b)=>b[1].total-a[1].total).slice(0,6)
      .map(([name,d])=>({ name, count: d.total, done: d.done }))

    // ── Temps moyen par dossier (DATE_DDE_VT → DATE_REELLE_POSE) ──
    const durations = allRows
      .filter(r => r.dateDdeVT && r.dateReellePose)
      .map(r => {
        const d1 = parseDateFR(r.dateDdeVT)
        const d2 = parseDateFR(r.dateReellePose)
        return d1 && d2 ? Math.round((d2 - d1) / 86400000) : null
      })
      .filter(d => d !== null && d >= 0)
    const avgDays = durations.length > 0
      ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length)
      : null

    // ── Admin/Finance ──
    const totalResteEncaisser  = allRows.reduce((s,r) => s + r.resteEncaisser, 0)
    const dossiersAvecFin      = allRows.filter(r => r.financement).length
    const dossiersAttenteAdmin = allRows.filter(r => !r.receptionBDC).length
    const caEnCours            = allRows.filter(r => !r.dateReellePose)
                                        .reduce((s,r) => s + (r.totalTTC || r.montantAbt), 0)

    // Mini table pour le tableau de bord technique (5 dossiers en cours)
    const miniRows = allRows
      .filter(r => !r.dateReellePose)
      .slice(0, 5)

    return {
      totalDossiers, posesDone, tauxPoses, totalCA, totalKWc,
      pipeline, monthly, commerciaux, contacts,
      miniRows,
      awaitingVT: awaitingVTList.length, awaitingVTList: awaitingVTList.slice(0,8),
      vtThisWeek: vtThisWeek.length,
      vtOverdue: vtOverdueList.length, vtOverdueList: vtOverdueList.slice(0,5),
      dpPending: dpPendingList.length,
      posesToPlan: posesToPlan.length,
      nextPoses,
      etatBreakdown, techniciens,
      avgDays,
      totalResteEncaisser, dossiersAvecFin, dossiersAttenteAdmin, caEnCours,
      daily,
    }
  }, [sheets, loggedInName, role])
}

// ── Charts ───────────────────────────────────────────────────
function LineChart({ data }) {
  const max = Math.max(...data.map(d => d.count), 1)
  const W=600, H=200, PAD={top:20,right:12,bottom:0,left:8}
  const pts = data.map((d,i) => ({
    x: PAD.left + (i/(data.length-1||1))*(W-PAD.left-PAD.right),
    y: PAD.top + (1-d.count/max)*(H-PAD.top-PAD.bottom),
    count: d.count, label: d.label,
  }))
  const pathD = pts.map((p,i)=>`${i===0?'M':'L'}${p.x},${p.y}`).join(' ')
  const areaD = `${pathD} L${pts[pts.length-1].x},${H-PAD.bottom} L${pts[0].x},${H-PAD.bottom} Z`
  return (
    <div className="dash-line-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="dash-line-svg" preserveAspectRatio="none">
        <defs><linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </linearGradient></defs>
        <path d={areaD} fill="url(#lg1)" />
        <path d={pathD} fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p,i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#f97316" />)}
      </svg>
      <div className="dash-line-labels">
        {data.map((d,i) => <span key={i} className="dash-line-label">{d.label}</span>)}
      </div>
    </div>
  )
}

function BarChart({ data, color='#f97316' }) {
  const max = Math.max(...data.map(d=>d.count),1)
  return (
    <div className="dash-bar-chart">
      {data.map((d,i) => (
        <div key={i} className="dash-bar-col">
          <div className="dash-bar-track">
            <div className="dash-bar-fill" style={{ height:`${(d.count/max)*100}%`, background:color }} />
            {d.count>0 && <span className="dash-bar-val">{d.count}</span>}
          </div>
          <span className="dash-bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function EtatPills({ data }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (!total) return null

  const SIZE = 160, cx = SIZE / 2, cy = SIZE / 2, R = 68, r = 44

  // Convertir en segments de cercle (coordonnées polaires → cartésiennes)
  const toXY = (angle, radius) => ({
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  })

  const segments = []
  let startAngle = -Math.PI / 2

  data.forEach((d, i) => {
    const color = STAGE_COLOR_MAP[d.label] || '#64748b'
    const sweep = (d.count / total) * 2 * Math.PI
    const endAngle = startAngle + sweep

    if (data.length === 1) {
      // Cas dégénéré : un seul segment = cercle complet
      segments.push({ color, count: d.count, label: d.label,
        path: `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.001} ${cy - R} Z` })
    } else {
      const s = toXY(startAngle, R)
      const e = toXY(endAngle, R)
      const large = sweep > Math.PI ? 1 : 0
      segments.push({ color, count: d.count, label: d.label,
        path: `M ${cx} ${cy} L ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y} Z` })
    }
    startAngle += sweep
  })

  return (
    <div className="dash-camembert">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="dash-camembert-svg">
        {segments.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth="2" />
        ))}
        <circle cx={cx} cy={cy} r={r} fill="#fff" />
        <text x={cx} y={cy - 5} textAnchor="middle" dominantBaseline="middle"
          fontSize="20" fontWeight="800" fill="#0f172a">{total}</text>
        <text x={cx} y={cy + 14} textAnchor="middle"
          fontSize="9" fill="#94a3b8">dossiers</text>
      </svg>
      <div className="dash-camembert-legend">
        {segments.map((s, i) => (
          <div key={i} className="dash-camembert-item">
            <span className="dash-camembert-dot" style={{ background: s.color }} />
            <span className="dash-camembert-lbl">{s.label}</span>
            <span className="dash-camembert-val" style={{ color: s.color }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HBarChart({ data, color='#f97316' }) {
  const max = Math.max(...data.map(d=>d.count),1)
  return (
    <div className="dash-hbar-chart">
      {data.map((d,i) => (
        <div key={i} className="dash-hbar-row">
          <span className="dash-hbar-name">{d.name||d.label}</span>
          <div className="dash-hbar-track">
            <div className="dash-hbar-fill" style={{ width:`${(d.count/max)*100}%`, background:color }} />
          </div>
          <span className="dash-hbar-val">{d.count}</span>
        </div>
      ))}
    </div>
  )
}

function FunnelChart({ data }) {
  const max = Math.max(...data.map(d=>d.count),1)
  return (
    <div className="dash-funnel">
      {data.map((d,i) => (
        <div key={i} className="dash-funnel-row">
          <div className="dash-funnel-meta">
            <span className="dash-funnel-label">{d.label}</span>
            <span className="dash-funnel-count">{d.count}</span>
          </div>
          <div className="dash-funnel-track">
            <div className="dash-funnel-fill" style={{ width:`${(d.count/max)*100}%`, background:d.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color, alert }) {
  return (
    <div className={`dash-kpi-card${alert ? ' dash-kpi-card--alert' : ''}`}>
      <div className="dash-kpi-icon" style={{ background: color+'18', color }}>
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <div className="dash-kpi-body">
        <span className="dash-kpi-label">{label}</span>
        <span className="dash-kpi-value" style={alert ? { color:'#ef4444' } : undefined}>{value}</span>
        {sub && <span className="dash-kpi-sub">{sub}</span>}
      </div>
    </div>
  )
}

function MiniList({ rows, emptyText }) {
  if (!rows?.length) return <div className="dash-empty">{emptyText}</div>
  return (
    <div className="dash-mini-list">
      {rows.map((row, i) => (
        <div key={i} className="dash-mini-row">
          <span className="dash-mini-name">{row.nom}</span>
          <span className="dash-mini-meta">{row.meta}</span>
          {row.badge && (
            <span className="dash-mini-badge" style={{ background:row.badgeColor+'20', color:row.badgeColor }}>
              {row.badge}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Email stats ───────────────────────────────────────────────
function useEmailStats() {
  const [stats, setStats]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRef]  = useState(false)
  const fetch = useCallback(async (spin=false) => {
    if (spin) setRef(true)
    try { const d = await supabaseInvoke('email-stats', {}); if (d) setStats(d) } catch {}
    finally { setLoading(false); setRef(false) }
  }, [])
  useEffect(() => { fetch() }, [fetch])
  return { stats, loading, refresh: () => fetch(true), refreshing }
}

function EmailCard({ icon: Icon, label, value, sub, color, loading }) {
  return (
    <div className="dash-email-card">
      <div className="dash-email-icon" style={{ background: color+'18', color }}>
        <Icon size={18} strokeWidth={1.75} />
      </div>
      <div className="dash-kpi-body">
        <span className="dash-kpi-label">{label}</span>
        <span className="dash-kpi-value">
          {loading ? <span className="dash-email-skeleton" /> : (value ?? '—')}
        </span>
        {sub && <span className="dash-kpi-sub">{sub}</span>}
      </div>
    </div>
  )
}


// ── Dashboard ─────────────────────────────────────────────────
export default function Dashboard({ onNavigate }) {
  const { userProfile } = useAuth()
  const role         = userProfile?.role || ''
  const loggedInName = [userProfile?.prenom, userProfile?.nom].filter(Boolean).join(' ')

  const data = useDashboardData(loggedInName, role)
  const { stats: emailStats, loading: emailLoading, refresh: emailRefresh, refreshing } = useEmailStats()

  const isCommercial   = role === ROLES.COMMERCIAL
  const isTechnique    = role === ROLES.TECHNIQUE
  const isAdministratif = role === ROLES.ADMINISTRATIF || role === ROLES.ADMINISTRATEUR
  const useTechView    = isTechnique
  const today = new Date().toLocaleDateString('fr-FR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })

  // ── Section: Administratif ───────────────────────────────────
  const renderAdministratif = () => (
    <>
      {/* KPIs */}
      <div className="dash-kpi-grid">
        <KpiCard icon={FolderOpen}  label="Total contacts"      value={data.totalDossiers}
          sub="Tous sheets confondus" color="#6366f1" />
        <KpiCard icon={Zap}         label="Puissance réalisée"  value={data.totalKWc > 0 ? `${data.totalKWc.toFixed(1)} kWc` : '—'}
          sub="Cumulée tous dossiers" color="#f97316" />
        <KpiCard icon={TrendingUp}  label="Avancée globale"     value={`${data.tauxPoses} %`}
          sub="Dossiers posés / total" color="#10b981" />
        <KpiCard icon={Hammer}      label="Posés"               value={data.posesDone}
          sub={`sur ${data.totalDossiers} dossier${data.totalDossiers !== 1 ? 's' : ''}`} color="#8b5cf6" />
      </div>

      {/* Performance commerciaux + État dossiers */}
      <div className="dash-charts-row">
        <div className="dash-card dash-card--wide">
          <div className="dash-card-header">
            <Users size={15} /><span>Performance commerciaux</span><span className="dash-card-sub">nombre de dossiers</span>
          </div>
          {data.commerciaux.length === 0
            ? <div className="dash-empty">Aucune donnée</div>
            : <BarChart data={data.commerciaux.map(c => ({ label: c.name.split(' ')[0], count: c.count }))} />}
        </div>
        <div className="dash-card">
          <div className="dash-card-header"><ClipboardList size={15} /><span>État des dossiers</span></div>
          {data.etatBreakdown.length === 0
            ? <div className="dash-empty">Aucun dossier en cours</div>
            : <EtatPills data={data.etatBreakdown} />}
        </div>
      </div>

      {/* Dossiers par jour + (espace) */}
      <div className="dash-charts-row">
        <div className="dash-card dash-card--wide">
          <div className="dash-card-header">
            <Activity size={15} /><span>Dossiers ouverts par jour</span><span className="dash-card-sub">30 derniers jours</span>
          </div>
          {data.daily.every(d => d.count === 0)
            ? <div className="dash-empty">Aucun dossier sur les 30 derniers jours</div>
            : <LineChart data={data.daily} />}
        </div>
        <div className="dash-card">
          <div className="dash-card-header"><Calendar size={15} /><span>Prochaines poses</span></div>
          <MiniList
            rows={data.nextPoses.map(r => ({ nom: r.nom, meta: r.datePrevPose, badge: r.chargesAffaires || undefined, badgeColor: '#6366f1' }))}
            emptyText="Aucune pose planifiée"
          />
        </div>
      </div>

      {/* Suivi technique + Prochaines poses */}
      <div className="dash-charts-row">
        <div className="dash-card">
          <div className="dash-card-header"><Wrench size={15} /><span>Suivi technique</span></div>
          <div className="dash-stat-list">
            <div className="dash-stat-row"><span className="dash-stat-label">En attente de VT</span><span className="dash-stat-val" style={data.vtOverdue > 0 ? { color:'#ef4444' } : {}}>{data.awaitingVT}</span></div>
            <div className="dash-stat-row"><span className="dash-stat-label">VTs cette semaine</span><span className="dash-stat-val">{data.vtThisWeek}</span></div>
            <div className="dash-stat-row"><span className="dash-stat-label">DP à lancer</span><span className="dash-stat-val">{data.dpPending}</span></div>
            <div className="dash-stat-row"><span className="dash-stat-label">Poses à planifier</span><span className="dash-stat-val">{data.posesToPlan}</span></div>
            <div className="dash-stat-row"><span className="dash-stat-label">VTs en retard (+21j)</span><span className="dash-stat-val" style={{ color:'#ef4444' }}>{data.vtOverdue}</span></div>
          </div>
        </div>
        <div className="dash-card dash-card--wide">
          <div className="dash-card-header"><Calendar size={15} /><span>Prochaines poses planifiées</span></div>
          <MiniList
            rows={data.nextPoses.map(r => ({ nom: r.nom, meta: r.datePrevPose, badge: r.chargesAffaires || undefined, badgeColor: '#6366f1' }))}
            emptyText="Aucune pose planifiée"
          />
        </div>
      </div>
    </>
  )

  // ── Section: Commercial ──────────────────────────────────────
  const renderCommercial = () => (
    <>
      <div className="dash-kpi-grid">
        <KpiCard icon={FolderOpen} label="Clients"         value={data.totalDossiers}
          sub={isCommercial ? 'Mes dossiers' : 'Tous sheets confondus'} color="#6366f1" />
        <KpiCard icon={Hammer}    label="Posés"           value={data.posesDone}
          sub={`${data.tauxPoses} % des dossiers`} color="#10b981" />
        {!useTechView && <KpiCard icon={Euro} label="CA total" value={data.totalCA > 0 ? fmtEUR(data.totalCA) : '—'}
          sub="Total TTC" color="#8b5cf6" />}
        <KpiCard icon={Zap}       label="kWc installés"   value={data.totalKWc > 0 ? `${data.totalKWc.toFixed(1)} kWc` : '—'}
          sub="Puissance réalisée" color="#f97316" />
      </div>

      <div className="dash-charts-row">
        {!useTechView && (
          <div className="dash-card dash-card--wide">
            <div className="dash-card-header">
              <Activity size={15} /><span>Dossiers ouverts par mois</span><span className="dash-card-sub">12 derniers mois</span>
            </div>
            {data.monthly.every(m=>m.count===0)
              ? <div className="dash-empty">Aucune signature enregistrée</div>
              : <LineChart data={data.monthly} />}
          </div>
        )}
        <div className={`dash-card${useTechView ? ' dash-card--wide' : ''}`}>
          <div className="dash-card-header"><BarChart2 size={15} /><span>Pipeline</span></div>
          {data.pipeline.every(p=>p.count===0)
            ? <div className="dash-empty">Aucun dossier</div>
            : <FunnelChart data={data.pipeline} />}
        </div>
      </div>

      {!isCommercial && !useTechView && (
        <div className="dash-charts-row">
          <div className="dash-card dash-card--wide">
            <div className="dash-card-header">
              <Users size={15} /><span>Performance commerciaux</span><span className="dash-card-sub">dossiers · % posés · CA</span>
            </div>
            {data.commerciaux.length === 0 ? <div className="dash-empty">Aucune donnée</div> : (
              <div className="dash-hbar-chart">
                {data.commerciaux.map((d,i) => {
                  const maxC = Math.max(...data.commerciaux.map(x=>x.count),1)
                  return (
                    <div key={i} className="dash-hbar-row dash-hbar-row--wide">
                      <span className="dash-hbar-name">{d.name}</span>
                      <div className="dash-hbar-track">
                        <div className="dash-hbar-fill" style={{ width:`${(d.count/maxC)*100}%`, background:'#f97316' }} />
                      </div>
                      <span className="dash-hbar-val">{d.count}</span>
                      <span className="dash-hbar-conv">{d.conv}%</span>
                      <span className="dash-hbar-ca">{d.ca > 0 ? fmtEUR(d.ca) : '—'}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div className="dash-card">
            <div className="dash-card-header"><BarChart2 size={15} /><span>Dossiers ouverts / mois</span></div>
            {data.monthly.every(m=>m.count===0)
              ? <div className="dash-empty">Aucune donnée</div>
              : <BarChart data={data.monthly} />}
          </div>
        </div>
      )}

      {data.contacts.length > 0 && (
        <div className="dash-charts-row">
          <div className="dash-card">
            <div className="dash-card-header"><Target size={15} /><span>Origine des clients</span></div>
            <HBarChart data={data.contacts} color="#6366f1" />
          </div>
          {isCommercial && (
            <div className="dash-card">
              <div className="dash-card-header"><BarChart2 size={15} /><span>Mes signatures / mois</span></div>
              {data.monthly.every(m=>m.count===0)
                ? <div className="dash-empty">Aucune signature</div>
                : <BarChart data={data.monthly} />}
            </div>
          )}
        </div>
      )}
    </>
  )

  // ── Section: Technique ───────────────────────────────────────
  const renderTechnique = () => (
    <>
      <div className="dash-kpi-grid">
        <KpiCard icon={Clock}         label="En attente de VT"      value={data.awaitingVT}
          sub="VT demandée sans retour" color="#f59e0b" alert={data.vtOverdue > 0} />
        <KpiCard icon={Calendar}      label="VTs cette semaine"     value={data.vtThisWeek}
          sub="Prévues dans les 7 jours" color="#6366f1" />
        <KpiCard icon={FileCheck}     label="DP à lancer"           value={data.dpPending}
          sub="VT reçue, DP non démarrée" color="#f97316" />
        <KpiCard icon={Hammer}        label="Poses à planifier"     value={data.posesToPlan}
          sub="CNO reçu, pose non datée" color="#8b5cf6" />
      </div>

      {data.vtOverdue > 0 && (
        <div className="dash-alert-banner">
          <AlertTriangle size={15} />
          <strong>{data.vtOverdue} dossier{data.vtOverdue>1?'s':''}</strong>&nbsp;en attente de VT depuis plus de 21 jours
          <div className="dash-alert-chips">
            {data.vtOverdueList.map((r,i) => (
              <span key={i} className="dash-alert-chip">
                {r.nom}{r.chargesAffaires ? ` · ${r.chargesAffaires}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="dash-charts-row">
        <div className="dash-card dash-card--wide">
          <div className="dash-card-header"><Calendar size={15} /><span>Prochaines poses planifiées</span></div>
          <MiniList
            rows={data.nextPoses.map(r => ({
              nom: r.nom, meta: r.datePrevPose,
              badge: r.poseur || r.chargesAffaires || undefined,
              badgeColor: '#6366f1',
            }))}
            emptyText="Aucune pose planifiée"
          />
        </div>
        <div className="dash-card">
          <div className="dash-card-header"><ClipboardList size={15} /><span>État des dossiers</span></div>
          {data.etatBreakdown.length === 0
            ? <div className="dash-empty">Aucun dossier en cours</div>
            : <EtatPills data={data.etatBreakdown} />}
        </div>
      </div>

      <div className="dash-charts-row">
        <div className="dash-card dash-card--wide">
          <div className="dash-card-header"><Wrench size={15} /><span>Dossiers en attente de VT</span></div>
          <MiniList
            rows={data.awaitingVTList.map(r => ({
              nom: r.nom, meta: r.dateDdeVT,
              badge: r.chargesAffaires || undefined,
              badgeColor: '#f97316',
            }))}
            emptyText="Aucun dossier en attente de VT"
          />
        </div>
        {data.techniciens.length > 0 && (
          <div className="dash-card">
            <div className="dash-card-header"><Users size={15} /><span>Charge par technicien</span></div>
            <div className="dash-hbar-chart">
              {data.techniciens.map((d,i) => {
                const maxT = Math.max(...data.techniciens.map(x=>x.count),1)
                return (
                  <div key={i} className="dash-hbar-row">
                    <span className="dash-hbar-name">{d.name}</span>
                    <div className="dash-hbar-track">
                      <div className="dash-hbar-fill" style={{ width:`${(d.count/maxT)*100}%`, background:'#8b5cf6' }} />
                    </div>
                    <span className="dash-hbar-val">{d.count}</span>
                    <span className="dash-hbar-conv" style={{ color:'#10b981' }}>{d.done} posés</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )

  // ── Section: Marketing ───────────────────────────────────────
  const renderMarketing = () => (
    <>
      <div className="dash-section-header">
        <Mail size={14} />
        <span>Emails — Demandes de VT</span>
        <button
          className={`dash-refresh-btn${refreshing?' dash-refresh-btn--spinning':''}`}
          onClick={emailRefresh} disabled={refreshing}
        >
          <RefreshCw size={13} />
          {refreshing ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>
      <div className="dash-email-grid">
        <EmailCard icon={Mail}        label="Emails envoyés"    loading={emailLoading}
          value={emailStats?.total}
          sub={emailStats ? `${emailStats.totalRecipients} destinataire${emailStats.totalRecipients!==1?'s':''} touchés` : null}
          color="#6366f1" />
        <EmailCard icon={CheckCircle} label="Délivrés"          loading={emailLoading}
          value={emailStats?.delivered}
          sub={emailStats?.total > 0 ? `${Math.round((emailStats.delivered/emailStats.total)*100)} % des envois` : null}
          color="#10b981" />
        <EmailCard icon={XCircle}     label="Non délivrés"      loading={emailLoading}
          value={emailStats?.bounced}
          sub={emailStats?.total > 0 ? `${Math.round((emailStats.bounced/emailStats.total)*100)} % des envois` : null}
          color="#ef4444" />
        <EmailCard icon={MailOpen}    label="Ouverts"           loading={emailLoading}
          value={emailStats?.opened}
          sub={emailStats?.delivered > 0 ? `${Math.round((emailStats.opened/emailStats.delivered)*100)} % des délivrés` : null}
          color="#f97316" />
        <EmailCard icon={TrendingUp}  label="Taux délivraison"  loading={emailLoading}
          value={emailStats?.total > 0 ? `${Math.round((emailStats.delivered/emailStats.total)*100)} %` : emailStats ? '—' : null}
          sub="Délivrés / envoyés" color="#0ea5e9" />
      </div>
    </>
  )

  // ── Section: Admin & Finance ─────────────────────────────────
  const renderAdmin = () => (
    <>
      <div className="dash-kpi-grid">
        <KpiCard icon={CreditCard}    label="Reste à encaisser"        value={data.totalResteEncaisser > 0 ? fmtEUR(data.totalResteEncaisser) : '—'}
          sub="Tous dossiers" color="#ef4444" />
        <KpiCard icon={Package}       label="CA dossiers en cours"     value={data.caEnCours > 0 ? fmtEUR(data.caEnCours) : '—'}
          sub="Dossiers non encore posés" color="#f97316" />
        <KpiCard icon={ShieldCheck}   label="Avec financement"         value={data.dossiersAvecFin}
          sub="Avec financement" color="#6366f1" />
        <KpiCard icon={ClipboardList} label="En attente d'admin"       value={data.dossiersAttenteAdmin}
          sub="BDC non reçu" color="#f59e0b" alert={data.dossiersAttenteAdmin > 5} />
      </div>

      <div className="dash-charts-row">
        <div className="dash-card dash-card--wide">
          <div className="dash-card-header"><BarChart2 size={15} /><span>Volume signé par mois</span></div>
          {data.monthly.every(m=>m.count===0)
            ? <div className="dash-empty">Aucune donnée</div>
            : <BarChart data={data.monthly} color="#8b5cf6" />}
        </div>
        <div className="dash-card">
          <div className="dash-card-header"><Users size={15} /><span>CA par commercial</span></div>
          {data.commerciaux.filter(d=>d.ca>0).length === 0
            ? <div className="dash-empty">Aucune donnée</div>
            : (
              <div className="dash-hbar-chart">
                {data.commerciaux.filter(d=>d.ca>0).map((d,i) => {
                  const maxCA = Math.max(...data.commerciaux.map(x=>x.ca),1)
                  return (
                    <div key={i} className="dash-hbar-row">
                      <span className="dash-hbar-name">{d.name}</span>
                      <div className="dash-hbar-track">
                        <div className="dash-hbar-fill" style={{ width:`${(d.ca/maxCA)*100}%`, background:'#8b5cf6' }} />
                      </div>
                      <span className="dash-hbar-val" style={{ fontSize:'11px', minWidth:52 }}>{fmtEUR(d.ca)}</span>
                    </div>
                  )
                })}
              </div>
            )}
        </div>
      </div>
    </>
  )

  // ── Section: Vue globale (marketing role) ──────────────────
  const renderOverview = () => (
    <>
      {/* Alertes en haut si problèmes */}
      {data.vtOverdue > 0 && (
        <div className="dash-alert-banner">
          <AlertTriangle size={15} />
          <strong>{data.vtOverdue} dossier{data.vtOverdue>1?'s':''}</strong>&nbsp;en attente de VT depuis plus de 21 jours
          <div className="dash-alert-chips">
            {data.vtOverdueList.map((r,i) => <span key={i} className="dash-alert-chip">{r.nom}</span>)}
          </div>
        </div>
      )}

      {/* Ligne 1 : KPIs clés — tout en un */}
      <div className={`dash-kpi-grid${useTechView ? ' dash-kpi-grid--4' : ' dash-kpi-grid--5'}`}>
        <KpiCard icon={FolderOpen}  label="Clients"           value={data.totalDossiers}
          sub="Tous dossiers confondus" color="#6366f1" />
        <KpiCard icon={Hammer}      label="Posés"             value={data.posesDone}
          sub={`${data.tauxPoses} % des dossiers terminés`} color="#10b981" />
        {!useTechView && <KpiCard icon={Euro} label="CA total" value={data.totalCA > 0 ? fmtEUR(data.totalCA) : '—'} sub="Total TTC" color="#8b5cf6" />}
        {useTechView && <KpiCard icon={Clock} label="Temps moyen / dossier" value={data.avgDays !== null ? `${data.avgDays} j` : '—'} sub="De la demande VT à la pose" color="#8b5cf6" />}
        <KpiCard icon={Clock}       label="En attente de VT"  value={data.awaitingVT}
          sub={`${data.vtThisWeek} prévues cette semaine`} color="#f59e0b" alert={data.vtOverdue>0} />
      </div>

      {/* ── Vue TECHNIQUE ── */}
      {useTechView && <>
        {/* T-Ligne 2 : État des dossiers + Charge techniciens + Prochaines poses */}
        <div className="dash-charts-row dash-charts-row--3">
          <div className="dash-card">
            <div className="dash-card-header"><ClipboardList size={15} /><span>État des dossiers</span></div>
            {data.etatBreakdown.length===0 ? <div className="dash-empty">Aucun dossier en cours</div> : <EtatPills data={data.etatBreakdown} />}
          </div>
          <div className="dash-card">
            <div className="dash-card-header"><Users size={15} /><span>Charge par technicien</span></div>
            {data.techniciens.length === 0 ? (
              <div className="dash-empty">Aucun technicien assigné</div>
            ) : (
              <div className="dash-hbar-chart">
                {data.techniciens.map((t, i) => (
                  <div key={i} className="dash-hbar-row">
                    <span className="dash-hbar-name">{t.name}</span>
                    <div className="dash-hbar-track">
                      <div className="dash-hbar-fill" style={{ width:`${(t.count/Math.max(...data.techniciens.map(x=>x.count),1))*100}%`, background:'#6366f1' }} />
                    </div>
                    <span className="dash-hbar-val">{t.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="dash-card">
            <div className="dash-card-header"><Calendar size={15} /><span>Prochaines poses</span></div>
            <MiniList rows={data.nextPoses.map(r=>({ nom:r.nom, meta:r.datePrevPose, badge:r.poseur||r.chargesAffaires||undefined, badgeColor:'#6366f1' }))} emptyText="Aucune pose planifiée" />
          </div>
        </div>
        {/* T-Ligne 3 : Mini table des transactions en cours */}
        <div className="dash-card">
          <div className="dash-card-header" style={{ justifyContent: 'space-between' }}>
            <span style={{ display:'flex', alignItems:'center', gap:7 }}><Wrench size={15} /><span>Dossiers en cours</span></span>
            <button
              className="dash-mini-tx-btn"
              onClick={() => onNavigate?.('transactions')}
            >
              Voir tous les dossiers →
            </button>
          </div>
          {data.miniRows.length === 0 ? (
            <div className="dash-empty">Aucun dossier en cours</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="dash-mini-tx-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Type</th>
                    <th>Commercial</th>
                    <th>Date demande VT</th>
                    <th>Date fermeture</th>
                    <th>Étape</th>
                    <th>Chargé d'affaires</th>
                  </tr>
                </thead>
                <tbody>
                  {data.miniRows.map((r, i) => (
                    <tr key={i} style={{ cursor: 'pointer' }} onClick={() => {
                      sessionStorage.setItem('pendingTxId', r.id)
                      onNavigate?.('transactions')
                    }}>
                      <td className="dash-mini-tx-name">{r.nom || '—'}</td>
                      <td className="dash-mini-tx-ca">{r.type || '—'}</td>
                      <td className="dash-mini-tx-ca">{r.commercial || '—'}</td>
                      <td className="dash-mini-tx-ca">{r.dateDdeVT || '—'}</td>
                      <td className="dash-mini-tx-ca">{r.signeLe || '—'}</td>
                      <td>
                        <span className="dash-mini-tx-stage" style={{
                          background: (STAGE_COLOR_MAP[r.etatDossier] || '#64748b') + '20',
                          color: STAGE_COLOR_MAP[r.etatDossier] || '#64748b',
                        }}>
                          {r.etatDossier || 'Demande de VT'}
                        </span>
                      </td>
                      <td className="dash-mini-tx-ca">{r.chargesAffaires || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>}

      {/* ── Vue NON-TECHNIQUE ── */}
      {!useTechView && <>
        {/* Ligne 2 : courbe + pipeline */}
        <div className="dash-charts-row">
          <div className="dash-card dash-card--wide">
            <div className="dash-card-header"><Activity size={15} /><span>Dossiers ouverts par mois</span><span className="dash-card-sub">12 derniers mois</span></div>
            {data.monthly.every(m=>m.count===0) ? <div className="dash-empty">Aucune signature</div> : <LineChart data={data.monthly} />}
          </div>
          <div className="dash-card">
            <div className="dash-card-header"><BarChart2 size={15} /><span>Pipeline global</span></div>
            {data.pipeline.every(p=>p.count===0) ? <div className="dash-empty">Aucun dossier</div> : <FunnelChart data={data.pipeline} />}
          </div>
        </div>
        {/* Ligne 3 : commerciaux + état */}
        <div className="dash-charts-row">
          <div className="dash-card dash-card--wide">
            <div className="dash-card-header"><Users size={15} /><span>Performance commerciaux</span><span className="dash-card-sub">dossiers · % posés · CA</span></div>
            {data.commerciaux.length === 0 ? <div className="dash-empty">Aucune donnée</div> : (
              <div className="dash-hbar-chart">
                {data.commerciaux.map((d,i) => {
                  const maxC = Math.max(...data.commerciaux.map(x=>x.count),1)
                  return (
                    <div key={i} className="dash-hbar-row dash-hbar-row--wide">
                      <span className="dash-hbar-name">{d.name}</span>
                      <div className="dash-hbar-track"><div className="dash-hbar-fill" style={{ width:`${(d.count/maxC)*100}%`, background:'#f97316' }} /></div>
                      <span className="dash-hbar-val">{d.count}</span>
                      <span className="dash-hbar-conv">{d.conv}%</span>
                      <span className="dash-hbar-ca">{d.ca>0?fmtEUR(d.ca):'—'}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          <div className="dash-card">
            <div className="dash-card-header"><ClipboardList size={15} /><span>État des dossiers</span></div>
            {data.etatBreakdown.length===0 ? <div className="dash-empty">Aucun dossier en cours</div> : <EtatPills data={data.etatBreakdown} />}
          </div>
        </div>
        {/* Ligne 4 : suivi technique + finance + origine */}
        <div className="dash-charts-row">
          <div className="dash-card">
            <div className="dash-card-header"><Wrench size={15} /><span>Suivi technique</span></div>
            <div className="dash-stat-list">
              <div className="dash-stat-row"><span className="dash-stat-label">En attente de VT</span><span className="dash-stat-val" style={data.vtOverdue>0?{color:'#ef4444'}:{}}>{data.awaitingVT}</span></div>
              <div className="dash-stat-row"><span className="dash-stat-label">VTs cette semaine</span><span className="dash-stat-val">{data.vtThisWeek}</span></div>
              <div className="dash-stat-row"><span className="dash-stat-label">DP à lancer</span><span className="dash-stat-val">{data.dpPending}</span></div>
              <div className="dash-stat-row"><span className="dash-stat-label">Poses à planifier</span><span className="dash-stat-val">{data.posesToPlan}</span></div>
              <div className="dash-stat-row"><span className="dash-stat-label">VTs en retard (+21j)</span><span className="dash-stat-val" style={{color:'#ef4444'}}>{data.vtOverdue}</span></div>
            </div>
          </div>
          <div className="dash-card">
            <div className="dash-card-header"><CreditCard size={15} /><span>Finance</span></div>
            <div className="dash-stat-list">
              <div className="dash-stat-row"><span className="dash-stat-label">CA signé total</span><span className="dash-stat-val">{data.totalCA>0?fmtEUR(data.totalCA):'—'}</span></div>
              <div className="dash-stat-row"><span className="dash-stat-label">CA en cours (non posés)</span><span className="dash-stat-val">{data.caEnCours>0?fmtEUR(data.caEnCours):'—'}</span></div>
              <div className="dash-stat-row"><span className="dash-stat-label">Reste à encaisser</span><span className="dash-stat-val" style={{color:'#ef4444'}}>{data.totalResteEncaisser>0?fmtEUR(data.totalResteEncaisser):'—'}</span></div>
              <div className="dash-stat-row"><span className="dash-stat-label">Avec financement</span><span className="dash-stat-val">{data.dossiersAvecFin}</span></div>
              <div className="dash-stat-row"><span className="dash-stat-label">En attente d'admin (BDC)</span><span className="dash-stat-val" style={data.dossiersAttenteAdmin>5?{color:'#f59e0b'}:{}}>{data.dossiersAttenteAdmin}</span></div>
            </div>
          </div>
          <div className="dash-card">
            <div className="dash-card-header"><Target size={15} /><span>Origine des clients</span></div>
            {data.contacts.length===0 ? <div className="dash-empty">Aucune donnée</div> : <HBarChart data={data.contacts} color="#6366f1" />}
          </div>
        </div>
        {/* Ligne 5 : prochaines poses + emails */}
        <div className="dash-charts-row">
          <div className="dash-card">
            <div className="dash-card-header"><Calendar size={15} /><span>Prochaines poses</span></div>
            <MiniList rows={data.nextPoses.map(r=>({ nom:r.nom, meta:r.datePrevPose, badge:r.poseur||r.chargesAffaires||undefined, badgeColor:'#6366f1' }))} emptyText="Aucune pose planifiée" />
          </div>
          <div className="dash-card dash-card--wide">
            <div className="dash-card-header">
              <Mail size={15} /><span>Emails — Demandes de VT</span>
              <button className={`dash-refresh-btn${refreshing?' dash-refresh-btn--spinning':''}`} onClick={emailRefresh} disabled={refreshing} style={{ marginLeft:'auto' }}>
                <RefreshCw size={13} />{refreshing?'Actualisation…':'Actualiser'}
              </button>
            </div>
            <div className="dash-email-grid dash-email-grid--4">
              <EmailCard icon={Mail}        label="Emails envoyés"   loading={emailLoading} value={emailStats?.total}     sub={emailStats?`${emailStats.totalRecipients} destinataires`:null} color="#6366f1" />
              <EmailCard icon={CheckCircle} label="Délivrés"         loading={emailLoading} value={emailStats?.delivered} sub={emailStats?.total>0?`${Math.round((emailStats.delivered/emailStats.total)*100)} %`:null} color="#10b981" />
              <EmailCard icon={MailOpen}    label="Ouverts"          loading={emailLoading} value={emailStats?.opened}    sub={emailStats?.delivered>0?`${Math.round((emailStats.opened/emailStats.delivered)*100)} %`:null} color="#f97316" />
              <EmailCard icon={TrendingUp}  label="Taux délivraison" loading={emailLoading} value={emailStats?.total>0?`${Math.round((emailStats.delivered/emailStats.total)*100)} %`:emailStats?'—':null} sub="Délivrés / envoyés" color="#0ea5e9" />
            </div>
          </div>
        </div>
      </>}
    </>
  )

  return (
    <div className="dashboard">
      <div className="dash-header">
        <div>
          <h1 className="dash-title">Tableau de bord</h1>
          <p className="dash-date">{today.charAt(0).toUpperCase() + today.slice(1)}</p>
        </div>
      </div>
      {isAdministratif ? renderAdministratif() : renderOverview()}
    </div>
  )
}
