import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { http, tokenStorage } from '../api/http'

const USERNAME_KEY = 'auth.username'

interface AuthState {
  username: string | null
  isAuthenticated: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

interface TokenResponse {
  access: string
  refresh: string
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(USERNAME_KEY))
  const [hasToken, setHasToken] = useState<boolean>(() => !!tokenStorage.getAccess())

  useEffect(() => {
    const onLogout = () => {
      localStorage.removeItem(USERNAME_KEY)
      setUsername(null)
      setHasToken(false)
    }
    window.addEventListener('auth:logout', onLogout)
    return () => window.removeEventListener('auth:logout', onLogout)
  }, [])

  const login = useCallback(async (u: string, p: string) => {
    const data = await http.post<TokenResponse>('/auth/token/', { username: u, password: p })
    tokenStorage.set(data.access, data.refresh)
    localStorage.setItem(USERNAME_KEY, u)
    setUsername(u)
    setHasToken(true)
  }, [])

  const logout = useCallback(() => {
    tokenStorage.clear()
    localStorage.removeItem(USERNAME_KEY)
    setUsername(null)
    setHasToken(false)
  }, [])

  const value = useMemo<AuthState>(
    () => ({ username, isAuthenticated: hasToken, login, logout }),
    [username, hasToken, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
