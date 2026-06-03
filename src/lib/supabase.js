import { createClient } from '@supabase/supabase-js'

// Supabase configuration - Replace with your actual Supabase URL and anon key
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // Ne pas persister la session - connexion requise à chaque visite
    autoRefreshToken: true, // Keep token fresh during active session
  },
})

// ── Module-level auth token cache ─────────────────────────────
// Never call supabase.auth.getSession() inside hot paths — it can hang
// when the browser throttles the tab. This cache is always synchronous.
let _cachedToken = null

// Prime the cache once at module load (fire-and-forget)
supabase.auth.getSession().then(({ data: { session } }) => {
  _cachedToken = session?.access_token || null
})

// Keep it up-to-date on every auth state change
supabase.auth.onAuthStateChange((_event, session) => {
  _cachedToken = session?.access_token || null
})

/** Returns the cached JWT synchronously. Falls back to anon key. */
export const getAuthToken = () => _cachedToken || supabaseAnonKey

/** Returns a fresh JWT, refreshing if expired. Races against a 4s timeout. */
const getFreshToken = async () => {
  // Check if cached token is still valid for at least 60s
  if (_cachedToken) {
    try {
      const payload = JSON.parse(atob(_cachedToken.split('.')[1]))
      if (payload.exp * 1000 > Date.now() + 60_000) return _cachedToken
    } catch {}
  }
  // Token missing or expiring — refresh with a timeout to avoid hanging
  try {
    const { data } = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
    ])
    const token = data?.session?.access_token
    if (token) { _cachedToken = token; return token }
  } catch {}
  return _cachedToken || supabaseAnonKey
}

// ── Raw REST helpers with AbortController timeout ────────────
// Use these instead of supabase.from(...) in components to avoid
// the Supabase JS client hanging after tab switches.

/**
 * GET rows from a table.
 * params: plain object, values NOT url-encoded (PostgREST handles it)
 * e.g. { select: 'id,nom,prenom', role: 'eq.technique', order: 'nom.asc' }
 */
export const supabaseGet = async (table, params = {}, timeoutMs = 6000) => {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
  const url = `${supabaseUrl}/rest/v1/${table}${qs ? `?${qs}` : ''}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    })
    clearTimeout(timer)
    if (!res.ok) return []
    return await res.json()
  } catch {
    clearTimeout(timer)
    return []
  }
}

/**
 * POST (insert) a single row and return the created record.
 * Throws on failure so the caller can handle the error.
 */
export const supabasePost = async (table, body, timeoutMs = 8000) => {
  const token = await getFreshToken()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(body),
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    return Array.isArray(json) ? json[0] : json
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

/**
 * Upsert a single row (POST with conflict resolution).
 * conflictOn: comma-separated column name(s) e.g. 'config_key' or 'sheet_id'
 */
export const supabaseUpsert = async (table, body, conflictOn, timeoutMs = 8000) => {
  const token = await getFreshToken()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=${conflictOn}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Prefer': 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(body),
    })
    clearTimeout(timer)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = await res.json()
    return Array.isArray(json) ? json[0] : json
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

/**
 * DELETE rows matching filter params.
 * e.g. supabaseDelete('contact_activities', { contact_id: 'eq.c:2' })
 */
export const supabaseDelete = async (table, params = {}, timeoutMs = 8000) => {
  const qs = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&')
  const url = `${supabaseUrl}/rest/v1/${table}${qs ? `?${qs}` : ''}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'DELETE',
      signal: controller.signal,
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${getAuthToken()}`,
      },
    })
    clearTimeout(timer)
    return res.ok
  } catch {
    clearTimeout(timer)
    return false
  }
}

/**
 * Upload a file to Supabase Storage via direct fetch (avoids JS client hang).
 * Returns { publicUrl } on success, throws on failure.
 */
export const storageUpload = async (bucket, path, file, timeoutMs = 30000) => {
  const token = await getFreshToken()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'x-upsert': 'true',
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    })
    clearTimeout(timer)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || `HTTP ${res.status}`)
    }
    return { publicUrl: `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}` }
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

/**
 * Remove files from Supabase Storage via direct fetch.
 */
export const storageRemove = async (bucket, paths, timeoutMs = 10000) => {
  const token = await getFreshToken()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
      method: 'DELETE',
      signal: controller.signal,
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: paths }),
    })
    clearTimeout(timer)
    return res.ok
  } catch {
    clearTimeout(timer)
    return false
  }
}

// Auth helpers
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  return { data, error }
}

export const signUp = async (email, password, metadata = {}) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
    },
  })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

/**
 * Invoke a Supabase Edge Function.
 * The function receives { to, subject, html } for send-email, etc.
 */
export const supabaseInvoke = async (functionName, body, timeoutMs = 12000) => {
  const token = await getFreshToken()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    clearTimeout(timer)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return await res.json().catch(() => null)
  } catch (e) {
    clearTimeout(timer)
    throw e
  }
}

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}
