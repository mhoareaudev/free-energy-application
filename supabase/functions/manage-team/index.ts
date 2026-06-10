import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Non authentifié' }, 401)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // ── Vérifier que l'appelant est un administrateur ──
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token)
    if (authErr || !caller) return json({ error: 'Non authentifié' }, 401)

    const { data: callerProfile, error: profileErr } = await admin.from('profiles').select('role').eq('id', caller.id).maybeSingle()
    if (callerProfile?.role !== 'administrateur') {
      return json({
        error: 'Accès réservé aux administrateurs',
        debug: { callerId: caller.id, callerEmail: caller.email, foundRole: callerProfile?.role ?? null, profileErr: profileErr?.message ?? null },
      }, 403)
    }

    const { action, payload = {} } = await req.json()

    if (action === 'create') {
      const { prenom, nom, identifiant, password, role } = payload
      if (!prenom || !nom || !identifiant || !password) {
        return json({ error: 'Champs requis manquants' }, 400)
      }

      const { data, error } = await admin.auth.admin.createUser({
        email: identifiant,
        password,
        email_confirm: true,
        user_metadata: { nom, prenom, role },
      })
      if (error) return json({ error: error.message }, 400)

      const userId = data.user.id
      const { error: upsertErr } = await admin
        .from('profiles')
        .upsert({ id: userId, prenom, nom, role, identifiant }, { onConflict: 'id' })
      if (upsertErr) {
        // Le compte auth a été créé mais le profil a échoué : on nettoie pour éviter un compte orphelin
        await admin.auth.admin.deleteUser(userId)
        return json({ error: upsertErr.message }, 400)
      }

      return json({ ok: true, id: userId })
    }

    if (action === 'update') {
      const { id, ...fields } = payload
      if (!id) return json({ error: 'id manquant' }, 400)

      const { error } = await admin.from('profiles').update(fields).eq('id', id)
      if (error) return json({ error: error.message }, 400)

      return json({ ok: true })
    }

    if (action === 'delete') {
      const { id } = payload
      if (!id) return json({ error: 'id manquant' }, 400)

      // Supprime le compte auth (supprime aussi le profil via ON DELETE CASCADE)
      const { error } = await admin.auth.admin.deleteUser(id)
      if (error) return json({ error: error.message }, 400)

      return json({ ok: true })
    }

    return json({ error: 'Action inconnue' }, 400)
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Erreur interne' }, 500)
  }
})
