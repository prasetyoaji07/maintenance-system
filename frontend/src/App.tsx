import { useEffect, useState } from 'react'
import { ambil } from './api'
import Approval from './pages/Approval'
import Dashboard from './pages/Dashboard'
import LaporKerusakan from './pages/LaporKerusakan'
import Prediksi from './pages/Prediksi'
import Riwayat from './pages/Riwayat'
import TiketSaya from './pages/TiketSaya'
import type { Role, User } from './types'

const MENU: Record<Role, string[]> = {
  operator: ['Lapor Kerusakan'],
  teknisi: ['Tiket Saya'],
  supervisor: ['Approval', 'Dashboard', 'Riwayat', 'Prediksi'],
}

function App() {
  const [users, setUsers] = useState<User[]>([])
  const [userId, setUserId] = useState<number | null>(null)
  const [halaman, setHalaman] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    ambil<User[]>('/users')
      .then((data) => {
        setUsers(data)
        if (data.length > 0) {
          setUserId(data[0].id)
          setHalaman(MENU[data[0].role][0])
        }
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  const user = users.find((u) => u.id === userId) ?? null

  function gantiUser(id: number) {
    const baru = users.find((u) => u.id === id)
    if (!baru) return
    setUserId(id)
    setHalaman(MENU[baru.role][0])
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-blue-700">
            Sistem Maintenance dan Spare Part
          </h1>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            Login sebagai:
            <select
              className="rounded-lg border border-slate-300 px-3 py-1.5"
              value={userId ?? ''}
              onChange={(e) => gantiUser(Number(e.target.value))}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nama} ({u.role})
                </option>
              ))}
            </select>
          </label>
        </div>

        {user && (
          <nav className="mx-auto flex max-w-5xl gap-2 px-6 pb-3">
            {MENU[user.role].map((m) => (
              <button
                key={m}
                onClick={() => setHalaman(m)}
                className={
                  'rounded-lg px-4 py-2 text-sm font-semibold ' +
                  (halaman === m
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300')
                }
              >
                {m}
              </button>
            ))}
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-5xl p-6">
        {error && (
          <p className="rounded-lg bg-red-100 p-4 text-red-700">
            Gagal memuat user: {error}
          </p>
        )}
        {user && halaman === 'Lapor Kerusakan' && (
          <LaporKerusakan key={user.id} user={user} />
        )}
        {user && halaman === 'Tiket Saya' && (
          <TiketSaya key={user.id} user={user} />
        )}
        {user && halaman === 'Approval' && (
          <Approval key={user.id} user={user} />
        )}
        {user && halaman === 'Dashboard' && <Dashboard key={user.id} />}
        {user && halaman === 'Riwayat' && <Riwayat key={user.id} />}
        {user && halaman === 'Prediksi' && <Prediksi key={user.id} />}
      </main>
    </div>
  )
}

export default App