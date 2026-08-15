import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, clearToken, getToken, setToken } from './api'
import type { AuthResponse, AuthUser } from './types'

interface AuthContextValue {
  user: AuthUser | null
  ready: boolean
  signIn: (identifier: string, password: string) => Promise<void>
  signUp: (name: string, identifier: string, password: string, shopName: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const USER_KEY = 'sb_billing_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const token = getToken()
    const storedUser = localStorage.getItem(USER_KEY)
    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch {
        clearToken()
      }
    }
    setReady(true)
  }, [])

  function applyAuth(res: AuthResponse) {
    setToken(res.jwt)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
    setUser(res.user)
  }

  async function signIn(identifier: string, password: string) {
    const res = await api.post<AuthResponse>('/auth/signin', { identifier, password })
    applyAuth(res)
  }

  async function signUp(name: string, identifier: string, password: string, shopName: string) {
    const isEmail = identifier.includes('@')
    const body: Record<string, string> = { name, password, tenantName: shopName }
    body[isEmail ? 'email' : 'phone'] = identifier
    const res = await api.post<AuthResponse>('/auth/signup', body)
    // The first-time-setup signup is always the shop owner; /auth/signup can't
    // set custom fields, so promote them right after account creation (now
    // authenticated, since applyAuth just stored the token). Best-effort: if
    // this fails, the account still exists and can sign in normally.
    applyAuth(res)
    try {
      const owner = await api.patch<AuthUser>(`/users/${res.user.id}`, { role: 'owner' })
      applyAuth({ jwt: res.jwt, user: { ...res.user, ...owner } })
    } catch {
      // ignored — missing role defaults to owner access anyway (see isOwner)
    }
  }

  function signOut() {
    clearToken()
    localStorage.removeItem(USER_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, ready, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
