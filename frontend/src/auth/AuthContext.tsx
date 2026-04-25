import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { http, tokenStorage } from '../api/http'

const USERNAME_KEY = 'auth.username'
const ROLE_KEY = 'auth.role'
const IS_STAFF_KEY = 'auth.is_staff'

export type UserRole = 'player' | 'organizer'

export interface RegisterPayload {
  username: string
  password: string
  email?: string
  first_name?: string
  last_name?: string
}

interface AuthState {
  username: string | null
  role: UserRole | null
  isStaff: boolean
  isAuthenticated: boolean
  canEdit: boolean   // organizer или admin
  canDelete: boolean // только admin
  login: (username: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

interface AuthResponse {
  access: string
  refresh: string
  username: string
  role: UserRole
  is_staff: boolean
}

function saveSession(data: AuthResponse) {
  tokenStorage.set(data.access, data.refresh)
  localStorage.setItem(USERNAME_KEY, data.username)
  localStorage.setItem(ROLE_KEY, data.role)
  localStorage.setItem(IS_STAFF_KEY, String(data.is_staff))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem(USERNAME_KEY))
  const [role, setRole] = useState<UserRole | null>(() => localStorage.getItem(ROLE_KEY) as UserRole | null)
  const [isStaff, setIsStaff] = useState<boolean>(() => localStorage.getItem(IS_STAFF_KEY) === 'true')
  const [hasToken, setHasToken] = useState<boolean>(() => !!tokenStorage.getAccess())

  useEffect(() => {
    const onLogout = () => {
      localStorage.removeItem(USERNAME_KEY)
      localStorage.removeItem(ROLE_KEY)
      localStorage.removeItem(IS_STAFF_KEY)
      setUsername(null)
      setRole(null)
      setIsStaff(false)
      setHasToken(false)
    }
    window.addEventListener('auth:logout', onLogout)
    return () => window.removeEventListener('auth:logout', onLogout)
  }, [])

  const applySession = useCallback((data: AuthResponse) => {
    saveSession(data)
    setUsername(data.username)
    setRole(data.role)
    setIsStaff(data.is_staff)
    setHasToken(true)
  }, [])

  const login = useCallback(async (u: string, p: string) => {
    const data = await http.post<AuthResponse>('/auth/token/', { username: u, password: p })
    applySession(data)
  }, [applySession])

  const register = useCallback(async (payload: RegisterPayload) => {
    const data = await http.post<AuthResponse>('/auth/register/', payload)
    applySession(data)
  }, [applySession])

  const logout = useCallback(() => {
    tokenStorage.clear()
    localStorage.removeItem(USERNAME_KEY)
    localStorage.removeItem(ROLE_KEY)
    localStorage.removeItem(IS_STAFF_KEY)
    setUsername(null)
    setRole(null)
    setIsStaff(false)
    setHasToken(false)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      username,
      role,
      isStaff,
      isAuthenticated: hasToken,
      canEdit: isStaff || role === 'organizer',
      canDelete: isStaff,
      login,
      register,
      logout,
    }),
    [username, role, isStaff, hasToken, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
