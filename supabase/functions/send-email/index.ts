import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') ?? 'Free Energy <noreply@free-energy.re>'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors })
  }

  try {
    const { to, subject, html } = await req.json()

    if (!Array.isArray(to) || to.length === 0 || !subject || !html) {
      return new Response(
        JSON.stringify({ error: 'Champs requis manquants : to, subject, html' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...cors } }
      )
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    })

    const data = await resendRes.json()
    console.log('Resend response:', resendRes.status, JSON.stringify(data))

    if (!resendRes.ok) {
      return new Response(
        JSON.stringify({ error: data.message ?? data.name ?? 'Resend error', statusCode: resendRes.status, detail: data }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...cors } }
      )
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur interne' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...cors } }
    )
  }
})
