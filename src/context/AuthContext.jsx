import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

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
    // No persistent session - start with loading false
    setLoading(false)

    // Listen for auth changes (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchUserProfile(session.user.id)
        } else {
          setUserProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUserProfile(data)
    } catch (error) {
      console.error('Error fetching user profile:', error)
      // Set default profile for demo purposes
      setUserProfile({
        id: userId,
        nom: 'Demo',
        prenom: 'User',
        role: ROLES.ADMINISTRATEUR,
        identifiant: 'demo@free-energy.fr',
      })
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
