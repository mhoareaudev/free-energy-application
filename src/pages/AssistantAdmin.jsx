import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, CheckCircle2, X, Bot, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './AssistantAdmin.css'

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AssistantAdmin() {
  const [qaList,   setQaList]   = useState([])
  const [logs,     setLogs]     = useState([])
  const [loading,  setLoading]  = useState(true)
  const [editItem, setEditItem] = useState(null) // null | qa object | 'new'
  const [form,     setForm]     = useState({ question: '', answer: '', keywords: '' })
  const [saving,   setSaving]   = useState(false)
  const [tab,      setTab]      = useState('qa') // 'qa' | 'logs'

  const load = async () => {
    const [{ data: qa }, { data: lg }] = await Promise.all([
      supabase.from('assistant_qa').select('*').order('created_at', { ascending: false }),
      supabase.from('assistant_logs').select('*').order('created_at', { ascending: false }).limit(100),
    ])
    setQaList(qa || [])
    setLogs(lg || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditItem('new')
    setForm({ question: '', answer: '' })
  }

  const openEdit = item => {
    setEditItem(item)
    setForm({ question: item.question, answer: item.answer })
  }

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) return
    setSaving(true)
    const payload = {
      question:   form.question.trim(),
      answer:     form.answer.trim(),
      updated_at: new Date().toISOString(),
    }
    if (editItem === 'new') {
      await supabase.from('assistant_qa').insert([payload])
    } else {
      await supabase.from('assistant_qa').update(payload).eq('id', editItem.id)
    }
    await load()
    setEditItem(null)
    setSaving(false)
  }

  const handleDelete = async id => {
    await supabase.from('assistant_qa').delete().eq('id', id)
    setQaList(prev => prev.filter(q => q.id !== id))
  }

  const handleAnswerLog = async log => {
    setEditItem('new')
    setForm({ question: log.question, answer: '', keywords: '' })
    await supabase.from('assistant_logs').update({ answered: true }).eq('id', log.id)
    setLogs(prev => prev.map(l => l.id === log.id ? { ...l, answered: true } : l))
  }

  const unanswered = logs.filter(l => !l.answered)

  return (
    <div className="aa-page">
      {/* Header */}
      <div className="aa-header">
        <div>
          <h1 className="aa-title">Assistant — Base de connaissances</h1>
          <p className="aa-sub">Gérez les questions/réponses que l'assistant connaît</p>
        </div>
        <button className="aa-add-btn" onClick={openNew}>
          <Plus size={14} /> Ajouter une Q&amp;R
        </button>
      </div>

      {/* Tabs */}
      <div className="aa-tabs">
        <button className={`aa-tab${tab === 'qa' ? ' aa-tab--active' : ''}`} onClick={() => setTab('qa')}>
          <Bot size={13} /> Questions/Réponses
          <span className="aa-tab-count">{qaList.length}</span>
        </button>
        <button className={`aa-tab${tab === 'logs' ? ' aa-tab--active' : ''}`} onClick={() => setTab('logs')}>
          <MessageSquare size={13} /> Questions posées
          {unanswered.length > 0 && <span className="aa-tab-badge">{unanswered.length}</span>}
        </button>
      </div>

      {/* Form */}
      {editItem && (
        <div className="aa-form-card">
          <div className="aa-form-header">
            <span className="aa-form-title">{editItem === 'new' ? 'Nouvelle Q&R' : 'Modifier la Q&R'}</span>
            <button className="aa-form-close" onClick={() => setEditItem(null)}><X size={14} /></button>
          </div>
          <div className="aa-form-body">
            <label>Question</label>
            <input
              className="aa-input"
              placeholder="Ex : Comment créer un contact ?"
              value={form.question}
              onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
            />
            <label>Réponse</label>
            <textarea
              className="aa-textarea"
              rows={5}
              placeholder="La réponse détaillée…"
              value={form.answer}
              onChange={e => setForm(p => ({ ...p, answer: e.target.value }))}
            />
          </div>
          <div className="aa-form-footer">
            <button className="aa-cancel-btn" onClick={() => setEditItem(null)}>Annuler</button>
            <button className="aa-save-btn" onClick={handleSave} disabled={saving || !form.question.trim() || !form.answer.trim()}>
              <CheckCircle2 size={13} />
              {saving ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="aa-empty">Chargement…</div>
      ) : tab === 'qa' ? (
        qaList.length === 0 ? (
          <div className="aa-empty">
            <Bot size={28} color="#cbd5e1" />
            <p>Aucune question/réponse.<br />Ajoutez-en une pour entraîner l'assistant.</p>
          </div>
        ) : (
          <div className="aa-list">
            {qaList.map(item => (
              <div key={item.id} className="aa-item">
                <div className="aa-item-body">
                  <div className="aa-item-q">{item.question}</div>
                  <div className="aa-item-a">{item.answer}</div>
                  <div className="aa-item-date">Ajouté le {fmtDate(item.created_at)}</div>
                </div>
                <div className="aa-item-actions">
                  <button className="aa-icon-btn" onClick={() => openEdit(item)} title="Modifier">
                    <Edit2 size={13} />
                  </button>
                  <button className="aa-icon-btn aa-icon-btn--del" onClick={() => handleDelete(item.id)} title="Supprimer">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        logs.length === 0 ? (
          <div className="aa-empty">
            <MessageSquare size={28} color="#cbd5e1" />
            <p>Aucune question posée pour le moment.</p>
          </div>
        ) : (
          <div className="aa-list">
            {logs.map(log => (
              <div key={log.id} className={`aa-item${log.answered ? ' aa-item--answered' : ''}`}>
                <div className="aa-item-body">
                  <div className="aa-item-q">{log.question}</div>
                  <div className="aa-item-date">{fmtDate(log.created_at)}</div>
                </div>
                <div className="aa-item-actions">
                  {!log.answered ? (
                    <button className="aa-answer-btn" onClick={() => handleAnswerLog(log)}>
                      <Plus size={12} /> Répondre
                    </button>
                  ) : (
                    <span className="aa-answered-tag"><CheckCircle2 size={12} /> Répondu</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
