import { useEffect, useMemo, useState } from 'react'
import * as authApi from '../api/auth'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const expire = () => setUser(null)
    window.addEventListener('bookapp:session-expired', expire)
    let active = true
    authApi
      .me()
      .then((profile) => { if (active) setUser(profile) })
      .catch(() => { if (active) setUser(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false; window.removeEventListener('bookapp:session-expired', expire) }
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
