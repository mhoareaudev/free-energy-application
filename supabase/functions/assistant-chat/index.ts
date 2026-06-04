import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const { question, history = [] } = await req.json()
    if (!question?.trim()) {
      return new Response(JSON.stringify({ error: 'Question vide' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // ── Récupérer la base de connaissances ──
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    const { data: qaList } = await supabase.from('assistant_qa').select('question, answer, keywords')

    // ── Construire le contexte RAG ──
    const context = (qaList || []).map((qa: any) =>
      `Q: ${qa.question}\nR: ${qa.answer}`
    ).join('\n\n')

    // ── System prompt focalisé sur l'application ──
    const systemPrompt = `Tu es l'assistant IA de l'application Free Energy, un CRM de gestion de dossiers d'installation solaire (photovoltaïque) à La Réunion.

Tu aides les utilisateurs (commerciaux, techniciens, administratifs) à utiliser l'application.

RÈGLES ABSOLUES :
- Tu réponds UNIQUEMENT aux questions liées à l'application Free Energy ou à son domaine métier (solar, dossiers, CRM).
- Si une question ne concerne pas l'application ou le solaire, réponds : "Je suis uniquement là pour vous aider avec l'application Free Energy."
- Sois concis, précis et professionnel.
- Réponds en français.
- Si la réponse n'est pas dans le contexte fourni, dis-le honnêtement plutôt qu'inventer.
- Utilise au maximum 1 ou 2 emojis par message, uniquement des emojis simples et positifs (😊 👍 etc.). N'utilise pas d'emojis techniques ou décoratifs (📋 🔧 ✅ etc.).

CONTEXTE — Base de connaissances de l'application :
${context || 'Aucune documentation disponible pour le moment.'}

Si le contexte ne contient pas la réponse, oriente l'utilisateur vers son administrateur.`

    // ── Construire les messages pour Claude ──
    const messages = [
      // Historique de la conversation
      ...history.map((m: any) => ({
        role:    m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
      // Nouvelle question
      { role: 'user', content: question },
    ]

    // ── Appel Claude (Haiku = rapide et économique) ──
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system:     systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic error:', response.status, err)
      return new Response(
        JSON.stringify({ answer: 'Une erreur est survenue. Veuillez réessayer.' }),
        { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()
    const answer = data.content?.[0]?.text ?? 'Désolé, je n\'ai pas pu générer une réponse.'

    return new Response(
      JSON.stringify({ answer }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('assistant-chat error:', err)
    return new Response(
      JSON.stringify({ answer: 'Une erreur est survenue. Veuillez réessayer.' }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }
})
