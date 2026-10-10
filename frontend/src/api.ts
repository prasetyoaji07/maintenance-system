import type { User } from './types'

export const API_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:5001'

const KUNCI_TOKEN = 'token'
const KUNCI_USER = 'user'

export function simpanSesi(token: string, user: User) {
  sessionStorage.setItem(KUNCI_TOKEN, token)
  sessionStorage.setItem(KUNCI_USER, JSON.stringify(user))
}

export function hapusSesi() {
  sessionStorage.removeItem(KUNCI_TOKEN)
  sessionStorage.removeItem(KUNCI_USER)
}

export function ambilUserTersimpan(): User | null {
  try {
    const mentah = sessionStorage.getItem(KUNCI_USER)
    if (!mentah || !sessionStorage.getItem(KUNCI_TOKEN)) return null
    return JSON.parse(mentah) as User
  } catch {
    return null
  }
}

function headerAuth(): Record<string, string> {
  const token = sessionStorage.getItem(KUNCI_TOKEN)
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Token ditolak (kedaluwarsa/tidak valid): hapus sesi, kembali ke halaman login
function tanganiRespons(res: Response, data: { error?: string } | null) {
  if (res.status === 401) {
    hapusSesi()
    window.location.reload()
  }
  if (!res.ok) {
    throw new Error(data?.error ?? 'Permintaan gagal')
  }
}

export async function ambil<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { headers: headerAuth() })
  const data = await res.json()
  tanganiRespons(res, data)
  return data as T
}

export async function kirim<T>(
  path: string,
  method: 'POST' | 'PATCH',
  body: unknown
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headerAuth() },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  tanganiRespons(res, data)
  return data as T
}

// Login tidak memakai tanganiRespons, supaya 401 "password salah" tidak me-reload halaman
export async function login(
  email: string,
  password: string
): Promise<{ token: string; user: User }> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error ?? 'Login gagal')
  }
  return data as { token: string; user: User }
}