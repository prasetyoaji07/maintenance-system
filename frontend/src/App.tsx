import { useState } from 'react'
import { ambilUserTersimpan, hapusSesi } from './api'
import Approval from './pages/Approval'
import Dashboard from './pages/Dashboard'
import LaporKerusakan from './pages/LaporKerusakan'
import Login from './pages/Login'
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
  const [user, setUser] = useState<User | null>(ambilUserTersimpan)
  const [halaman, setHalaman] = useState(user ? MENU[user.role][0] : '')

  function sudahLogin(u: User) {
    setUser(u)
    setHalaman(MENU[u.role][0])
  }

  function logout() {
    hapusSesi()
    setUser(null)
    setHalaman('')
  }

  // Route guard: belum login -> halaman login
  if (!user) return <Login onLogin={sudahLogin} />

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-blue-700">
            Sistem Maintenance dan Spare Part
          </h1>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>
              {user.nama} ({user.role})
            </span>
            <button
              onClick={logout}
              className="rounded-lg bg-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-300"
            >
              Keluar
            </button>
          </div>
        </div>

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
      </header>

      <main className="mx-auto max-w-5xl p-6">
        {halaman === 'Lapor Kerusakan' && (
          <LaporKerusakan key={user.id} user={user} />
        )}
        {halaman === 'Tiket Saya' && <TiketSaya key={user.id} user={user} />}
        {halaman === 'Approval' && <Approval key={user.id} user={user} />}
        {halaman === 'Dashboard' && <Dashboard key={user.id} />}
        {halaman === 'Riwayat' && <Riwayat key={user.id} />}
        {halaman === 'Prediksi' && <Prediksi key={user.id} />}
      </main>
    </div>
  )
}

export default App