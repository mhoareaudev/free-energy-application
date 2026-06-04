import { useState, useEffect, useRef } from 'react'
import { X, Send, Bot, User } from 'lucide-react'
import { supabaseInvoke } from '../lib/supabase'
import './AssistantChat.css'

function renderMarkdown(text) {
  const lines = text.split('\n')
  const result = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Ligne vide
    if (!line.trim()) { result.push(<br key={i} />); i++; continue }

    // Titre ## ou ###
    if (line.startsWith('### ')) {
      result.push(<strong key={i} style={{ fontSize: 14, display: 'block', marginTop: 6 }}>{inlineFormat(line.slice(4))}</strong>)
      i++; continue
    }
    if (line.startsWith('## ')) {
      result.push(<strong key={i} style={{ fontSize: 15, display: 'block', marginTop: 8 }}>{inlineFormat(line.slice(3))}</strong>)
      i++; continue
    }

    // Liste à puces - ou *
    if (/^[-*•]\s/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) {
        items.push(<li key={i}>{inlineFormat(lines[i].replace(/^[-*•]\s/, ''))}</li>)
        i++
      }
      result.push(<ul key={`ul-${i}`} style={{ margin: '4px 0 4px 16px', padding: 0 }}>{items}</ul>)
      continue
    }

    // Ligne normale
    result.push(<span key={i} style={{ display: 'block' }}>{inlineFormat(line)}</span>)
    i++
  }

  return result
}

function inlineFormat(text) {
  // **gras**, *italique*, `code`
  const parts = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let last = 0, m

  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    if (m[2]) parts.push(<strong key={m.index}>{m[2]}</strong>)
    else if (m[3]) parts.push(<em key={m.index}>{m[3]}</em>)
    else if (m[4]) parts.push(<code key={m.index} style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4, fontSize: 12 }}>{m[4]}</code>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

export default function AssistantChat({ onClose, messages, setMessages }) {
  const [input,   setInput]   = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  const send = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')

    const newMessages = [...messages, { role: 'user', text: q }]
    setMessages(newMessages)
    setLoading(true)

    try {
      // Envoyer l'historique pour que Claude ait le contexte de la conversation
      const history = newMessages.slice(1) // Exclure le message de bienvenue

      const result = await supabaseInvoke('assistant-chat', { question: q, history })
      const answer = result?.answer || 'Désolé, je n\'ai pas pu générer une réponse.'

      setMessages(prev => [...prev, { role: 'assistant', text: answer }])
    } catch (e) {
      console.error('Assistant error:', e)
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: 'Une erreur est survenue. Veuillez réessayer.',
        error: true,
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ac-widget">
      {/* Header */}
      <div className="ac-header">
        <div className="ac-header-left">
          <div className="ac-avatar"><Bot size={16} /></div>
          <div>
            <div className="ac-name">P'tit Matthieu</div>
            <div className="ac-status"><span className="ac-dot" />IA · Disponible 24/7</div>
          </div>
        </div>
        <button className="ac-close" onClick={onClose}><X size={15} /></button>
      </div>

      {/* Messages */}
      <div className="ac-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`ac-msg ac-msg--${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="ac-msg-avatar"><Bot size={13} /></div>
            )}
            <div className={`ac-bubble${msg.error ? ' ac-bubble--warn' : ''}`}>
              {msg.role === 'assistant' ? renderMarkdown(msg.text) : msg.text}
            </div>
            {msg.role === 'user' && (
              <div className="ac-msg-avatar ac-msg-avatar--user"><User size={13} /></div>
            )}
          </div>
        ))}

        {loading && (
          <div className="ac-msg ac-msg--assistant">
            <div className="ac-msg-avatar"><Bot size={13} /></div>
            <div className="ac-bubble ac-bubble--typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="ac-input-wrap">
        <input
          ref={inputRef}
          className="ac-input"
          placeholder="Posez votre question…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          disabled={loading}
        />
        <button className="ac-send" onClick={send} disabled={!input.trim() || loading}>
          <Send size={15} />
        </button>
      </div>
    </div>
  )
}
