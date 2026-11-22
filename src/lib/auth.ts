import { useSyncExternalStore } from 'react'

export interface User {
  id: number
  email: string
  name: string
  role: 'student' | 'teacher'
}

interface AuthState {
  ready: boolean
  user: User | null
  unlocked: Set<string>
}

const TOKEN_KEY = 'ai-mastery:token'

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
const setToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

let state: AuthState = { ready: false, user: null, unlocked: new Set() }
const listeners = new Set<() => void>()
const set = (s: AuthState) => {
  state = s
  listeners.forEach((l) => l())
}

export const useAuth = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )

/** Authenticated fetch helper; throws Error with the server's message. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!res.ok) {
    const detail = await res.json().then((j) => j.detail).catch(() => null)
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail) ? 'Please check the form fields' : `Error ${res.status}`)
  }
  return res.json()
}

export async function refreshAuth() {
  if (!getToken()) return set({ ready: true, user: null, unlocked: new Set() })
  try {
    const me = await api<{ user: User; unlocked: string[] }>('/api/me')
    set({ ready: true, user: me.user, unlocked: new Set(me.unlocked) })
  } catch {
    setToken(null)
    set({ ready: true, user: null, unlocked: new Set() })
  }
}

async function enter(path: string, body: object) {
  const r = await api<{ token: string }>(path, { method: 'POST', body: JSON.stringify(body) })
  setToken(r.token)
  await refreshAuth()
}

export const login = (email: string, password: string) => enter('/api/auth/login', { email, password })
export const register = (name: string, email: string, password: string) =>
  enter('/api/auth/register', { name, email, password })

export function logout() {
  setToken(null)
  set({ ready: true, user: null, unlocked: new Set() })
}

/** Teachers can open everything; students only what the teacher has opened. */
export const canOpen = (s: AuthState, id: string) => s.unlocked.has(id)
