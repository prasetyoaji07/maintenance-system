export const API_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:5001'

export async function ambil<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`)
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error ?? 'Permintaan gagal')
  }
  return data as T
}

export async function kirim<T>(
  path: string,
  method: 'POST' | 'PATCH',
  body: unknown
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) {
    throw new Error(data?.error ?? 'Permintaan gagal')
  }
  return data as T
}