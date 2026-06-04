import { createContext, useContext, useState, useEffect } from 'react'
import { supabase, getFreshToken, supabaseUrl, supabaseAnonKey } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

// Role constants
export const ROLES = {
  ADMINISTRATIF: 'administratif',
  TECHNIQUE: 'technique',
  COMMERCIAL: 'commercial',
  ADMINISTRATEUR: 'administrateur',
  MARKETING: 'marketing',
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ready = false

    // onAuthStateChange envoie INITIAL_SESSION au démarrage (session persistée ou null)
    // C'est le seul endroit où on gère tout — pas besoin d'un getSession() séparé
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)

        if (session?.user) {
          await fetchUserProfile(session.user.id)
        } else {
          setUserProfile(null)
        }

        // Premier événement = état initial connu → fin du chargement
        if (!ready) {
          ready = true
          setLoading(false)
        }
      }
    )

    // Failsafe : si onAuthStateChange ne répond pas en 3s, on débloque quand même
    const failsafe = setTimeout(() => { if (!ready) { ready = true; setLoading(false) } }, 3000)

    return () => { subscription.unsubscribe(); clearTimeout(failsafe) }
  }, [])

  const fetchUserProfile = async (userId) => {
    try {
      // Utiliser getFreshToken + fetch direct pour éviter les blocages du client JS
      const token = await getFreshToken()
      const res = await fetch(
        `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*&limit=1`,
        {
          headers: {
            'apikey':        supabaseAnonKey,
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
          },
        }
      )
      if (!res.ok) throw new Error(`Profile fetch failed: ${res.status}`)
      const data = await res.json()
      if (data?.[0]) {
        setUserProfile(data[0])
      } else {
        console.warn('Profil introuvable pour userId:', userId)
        setUserProfile(null)
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
      setUserProfile(null) // Ne pas forcer un rôle arbitraire
    }
  }

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  }

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (!error) {
      setUser(null)
      setUserProfile(null)
    }
    return { error }
  }

  // Role check helpers
  const hasRole = (role) => userProfile?.role === role
  const isAdmin = () => hasRole(ROLES.ADMINISTRATEUR)
  const isAdministratif = () => hasRole(ROLES.ADMINISTRATIF)
  const isTechnique = () => hasRole(ROLES.TECHNIQUE)
  const isCommercial = () => hasRole(ROLES.COMMERCIAL)

  const value = {
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
    hasRole,
    isAdmin,
    isAdministratif,
    isTechnique,
    isCommercial,
    ROLES,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
