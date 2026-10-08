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