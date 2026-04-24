const BASE = '/api'

const ACCESS_KEY = 'auth.access'
const REFRESH_KEY = 'auth.refresh'

export const tokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh?: string) => {
    localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

function buildHeaders(init?: RequestInit): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  }
  const access = tokenStorage.getAccess()
  if (access) headers['Authorization'] = `Bearer ${access}`
  return headers
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh()
  if (!refresh) return null
  if (!refreshPromise) {
    refreshPromise = fetch(`${BASE}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
      .then(async (res) => {
        if (!res.ok) return null
        const data = (await res.json()) as { access: string }
        tokenStorage.set(data.access)
        return data.access
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

async function request<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: buildHeaders(init),
  })

  if (res.status === 401 && !retried && !path.startsWith('/auth/token')) {
    const newAccess = await refreshAccessToken()
    if (newAccess) return request<T>(path, init, true)
    tokenStorage.clear()
    window.dispatchEvent(new Event('auth:logout'))
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = Object.assign(new Error(`HTTP ${res.status}`), { status: res.status, data: body })
    throw err
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: 'DELETE' }),
}
