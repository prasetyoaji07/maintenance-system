import { useState } from 'react'
import { login, simpanSesi } from '../api'
import type { User } from '../types'

interface Props {
  onLogin: (user: User) => void
}

function Login({ onLogin }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [memuat, setMemuat] = useState(false)

  async function kirimLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMemuat(true)
    try {
      const hasil = await login(email.trim(), password)
      simpanSesi(hasil.token, hasil.user)
      onLogin(hasil.user)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setMemuat(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <form
        onSubmit={kirimLogin}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow"
      >
        <h1 className="mb-1 text-xl font-bold text-blue-700">
          Sistem Maintenance dan Spare Part
        </h1>
        <p className="mb-6 text-sm text-slate-500">Masuk untuk melanjutkan</p>

        <label className="mb-1 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          type="email"
          required
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-300 px-3 py-2"
        />

        {error && (
          <p className="mb-4 rounded-lg bg-red-100 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={memuat}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {memuat ? 'Memeriksa...' : 'Masuk'}
        </button>
      </form>
    </div>
  )
}

export default Login