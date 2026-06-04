import { useState, useEffect, useCallback } from 'react'
import {
  Mail, CheckCircle, XCircle, MailOpen, TrendingUp, RefreshCw,
  Users, Clock, AlertCircle,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { supabaseInvoke } from '../lib/supabase'
import './Mailing.css'

const STATUS_CONFIG = {
  sent:              { label: 'Envoyé',      color: '#6366f1', bg: '#eef2ff' },
  delivered:         { label: 'Délivré',     color: '#10b981', bg: '#ecfdf5' },
  opened:            { label: 'Ouvert',      color: '#0ea5e9', bg: '#f0f9ff' },
  clicked:           { label: 'Cliqué',      color: '#8b5cf6', bg: '#f5f3ff' },
  bounced:           { label: 'Rejeté',      color: '#ef4444', bg: '#fef2f2' },
  complained:        { label: 'Spam',        color: '#dc2626', bg: '#fef2f2' },
  delivery_delayed:  { label: 'Retardé',     color: '#f59e0b', bg: '#fffbeb' },
  queued:            { label: 'En attente',  color: '#94a3b8', bg: '#f8fafc' },
  error:             { label: 'Erreur',      color: '#ef4444', bg: '#fef2f2' },
}

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#64748b', bg: '#f8fafc' }
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontWeight: 700,
      padding: '3px 9px', borderRadius: 99,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function KpiCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="ml-kpi-card">
      <div className="ml-kpi-icon" style={{ background: color + '18', color }}>
        <Icon size={19} strokeWidth={1.75} />
      </div>
      <div className="ml-kpi-body">
        <span className="ml-kpi-label">{label}</span>
        <span className="ml-kpi-value">{value ?? '—'}</span>
        {sub && <span className="ml-kpi-sub">{sub}</span>}
      </div>
    </div>
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function Mailing() {
  const [stats, setStats]       = useState(null)
  const [logs, setLogs]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRef]    = useState(false)
  const [page, setPage]         = useState(0)
  const PAGE_SIZE = 25

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from('email_logs')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(500)
    setLogs(data || [])
  }, [])

  const loadStats = useCallback(async (spin = false) => {
    if (spin) setRef(true)
    try {
      const data = await supabaseInvoke('email-stats', {})
      if (data) setStats(data)
    } catch {}
    finally { setRef(false) }
  }, [])

  useEffect(() => {
    Promise.all([loadLogs(), loadStats()]).finally(() => setLoading(false))
  }, [loadLogs, loadStats])

  const refresh = async () => {
    setRef(true)
    await Promise.all([loadLogs(), loadStats()])
    setRef(false)
  }

  const delivRate = stats && stats.total > 0
    ? Math.round((stats.delivered / stats.total) * 100) : null
  const openRate = stats && stats.delivered > 0
    ? Math.round((stats.opened / stats.delivered) * 100) : null

  const paged = logs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(logs.length / PAGE_SIZE)

  return (
    <div className="mailing-page">
      {/* Header */}
      <div className="ml-header">
        <div>
          <h1 className="ml-title">Mailing</h1>
          <p className="ml-sub">Historique et statistiques des emails automatiques</p>
        </div>
        <button
          className={`ml-refresh-btn${refreshing ? ' ml-refresh-btn--spin' : ''}`}
          onClick={refresh} disabled={refreshing}
        >
          <RefreshCw size={14} />
          {refreshing ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>

      {/* KPIs */}
      <div className="ml-kpi-grid">
        <KpiCard icon={Mail}       label="Emails envoyés"     value={stats?.total}            sub={stats ? `${stats.totalRecipients} destinataire${stats.totalRecipients !== 1 ? 's' : ''} au total` : null} color="#6366f1" />
        <KpiCard icon={CheckCircle} label="Délivrés"           value={stats?.delivered}         sub={delivRate !== null ? `${delivRate} % des envois` : null} color="#10b981" />
        <KpiCard icon={XCircle}    label="Non délivrés"       value={stats?.bounced}           sub={stats?.total > 0 ? `${Math.round((stats.bounced / stats.total) * 100)} % des envois` : null} color="#ef4444" />
        <KpiCard icon={MailOpen}   label="Ouverts"            value={stats?.opened}            sub={openRate !== null ? `${openRate} % des délivrés` : null} color="#0ea5e9" />
        <KpiCard icon={TrendingUp} label="Taux de délivraison" value={delivRate !== null ? `${delivRate} %` : null} sub="Délivrés / envoyés" color="#8b5cf6" />
        <KpiCard icon={Users}      label="Destinataires"      value={stats?.totalRecipients}   sub="Total cumulé" color="#f97316" />
      </div>

      {/* Automated emails config */}
      <div className="ml-card">
        <div className="ml-card-header">
          <span className="ml-card-title"><Mail size={15} />Emails automatiques configurés</span>
        </div>
        <div className="ml-auto-list">
          {[
            { trigger: 'Création dossier',           label: 'Demande de VT',               dest: 'Tous les techniciens',      status: 'active',  delay: 'Immédiat' },
            { trigger: 'Attribution chargé d\'affaires', label: 'Dossier attribué',         dest: 'Chargé d\'affaires assigné', status: 'active',  delay: 'Immédiat' },
            { trigger: 'J+2 sans CA assigné',         label: 'Rappel — CA manquant',        dest: 'Tous les techniciens',      status: 'active',  delay: 'J+2 · 8h00' },
            { trigger: 'J+1 après date VT sans retour', label: 'Rappel — Retour VT manquant', dest: 'Chargé d\'affaires',      status: 'active',  delay: 'J+1 · 8h00' },
            { trigger: 'Validation accordéon VT',     label: 'VT validée — Lancer la DP',  dest: 'Équipe administrative',     status: 'active',  delay: 'Immédiat' },
            { trigger: 'J+5 après retour VT',         label: 'Rappel — Nomenclature à valider', dest: 'Chargé d\'affaires',      status: 'active',  delay: 'J+5 · 8h00' },
            { trigger: 'À venir',                     label: 'Rappel — CNO non reçu',       dest: '—',                        status: 'planned', delay: '—' },
            { trigger: 'À venir',                     label: 'Rappel — DP non lancée',      dest: '—',                        status: 'planned', delay: '—' },
          ].map((item, i) => (
            <div key={i} className="ml-auto-row">
              <span className={`ml-auto-status ml-auto-status--${item.status}`}>
                {item.status === 'active' ? '● Actif' : '○ Prévu'}
              </span>
              <span className="ml-auto-label">{item.label}</span>
              <span className="ml-auto-trigger">{item.trigger}</span>
              <span className="ml-auto-dest">{item.dest}</span>
              <span className="ml-auto-delay">{item.delay}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Email list */}
      <div className="ml-card">
        <div className="ml-card-header">
          <span className="ml-card-title">
            <Mail size={15} />
            Liste des emails envoyés
            {logs.length > 0 && <span className="ml-card-count">({logs.length})</span>}
          </span>
        </div>

        {loading ? (
          <div className="ml-empty"><Clock size={18} color="#cbd5e1" /><p>Chargement…</p></div>
        ) : logs.length === 0 ? (
          <div className="ml-empty"><AlertCircle size={18} color="#cbd5e1" /><p>Aucun email envoyé pour le moment.</p></div>
        ) : (
          <>
            <div className="ml-table-wrap">
              <table className="ml-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Sujet</th>
                    <th>Destinataires</th>
                    <th>Statut</th>
                    <th>Resend ID</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(log => (
                    <tr key={log.id}>
                      <td className="ml-td-date">{fmtDate(log.sent_at)}</td>
                      <td className="ml-td-subject">{log.subject || '—'}</td>
                      <td className="ml-td-center">{log.recipient_count}</td>
                      <td><StatusBadge status={log.status} /></td>
                      <td className="ml-td-id">{log.resend_id
                        ? <a href={`https://resend.com/emails/${log.resend_id}`} target="_blank" rel="noreferrer" className="ml-resend-link">{log.resend_id.slice(0, 16)}…</a>
                        : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="ml-pagination">
                <button className="ml-page-btn" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Précédent</button>
                <span className="ml-page-info">Page {page + 1} / {totalPages}</span>
                <button className="ml-page-btn" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Suivant →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
