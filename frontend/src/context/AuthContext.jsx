import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
      async login(email, password, remember = true) {
        const data = await authApi.login(email, password, remember)
        const profile = await authApi.me()
        setUser(profile)
        return { ...data, user: profile }
      },
      async logout() {
        try { await authApi.logout() } finally { setUser(null) }
      },
      async refresh() {
        const profile = await authApi.me()
        setUser(profile)
        return profile
      },
    }),
    [user, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
