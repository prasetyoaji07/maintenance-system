import { useState } from 'react'
import { ambilUserTersimpan, hapusSesi } from './api'
import Approval from './pages/Approval'
import Dashboard from './pages/Dashboard'
import JadwalPM from './pages/JadwalPM'
import LaporKerusakan from './pages/LaporKerusakan'
import Login from './pages/Login'
import Prediksi from './pages/Prediksi'
import QRMesin from './pages/QRMesin'
import Riwayat from './pages/Riwayat'
import TiketSaya from './pages/TiketSaya'
import type { Role, User } from './types'

const MENU: Record<Role, string[]> = {
  operator: ['Lapor Kerusakan'],
  leader_divisi: ['Lapor Kerusakan', 'Riwayat'],
  installer_divisi: ['Riwayat'],
  foreman_divisi: ['Riwayat'],
  spv_divisi: ['Riwayat'],
  teknisi: ['Tiket Saya', 'Riwayat', 'Jadwal PM'],
  mekanik_mtnc: ['Tiket Saya', 'Riwayat', 'Jadwal PM'],
  supervisor: ['Approval', 'Dashboard', 'Riwayat', 'Prediksi', 'Jadwal PM', 'QR Mesin'],
  spv_mtnc: ['Approval', 'Dashboard', 'Riwayat', 'Prediksi', 'Jadwal PM', 'QR Mesin'],
}

function bacaMesinQR(): string | null {
  return new URLSearchParams(window.location.search).get('mesin')
}

function halamanAwal(u: User, mesinQR: string | null): string {
  if (mesinQR!== null &&!['operator','leader_divisi','installer_divisi'].includes(u.role)) return 'Riwayat'
  return MENU[u.role]?.[0] || 'Riwayat'
}

function App() {
  const [user, setUser] = useState<User | null>(ambilUserTersimpan)
  const [mesinQR] = useState<string | null>(bacaMesinQR)
  const [halaman, setHalaman] = useState(user? halamanAwal(user, mesinQR) : '')

  function sudahLogin(u: User) {
    setUser(u)
    setHalaman(halamanAwal(u, mesinQR))
  }

  function logout() {
    hapusSesi()
    setUser(null)
    setHalaman('')
  }

  if (!user) return <Login onLogin={sudahLogin} />

  const menuUser = MENU[user.role] || MENU['operator']

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white shadow print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-bold text-blue-700">
            Sistem Maintenance dan Spare Part
          </h1>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{user.nama} ({user.role})</span>
            <button onClick={logout} className="rounded-lg bg-slate-200 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-300">Keluar</button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-5xl flex-wrap gap-2 px-6 pb-3">
          {menuUser.map((m) => (
            <button key={m} onClick={() => setHalaman(m)}
              className={'rounded-lg px-4 py-2 text-sm font-semibold ' + (halaman === m? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300')}>
              {m}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl p-6">
        {halaman === 'Lapor Kerusakan' && <LaporKerusakan key={user.id} user={user} mesinAwal={mesinQR} />}
        {halaman === 'Tiket Saya' && <TiketSaya key={user.id} user={user} />}
        {halaman === 'Approval' && <Approval key={user.id} user={user} />}
        {halaman === 'Dashboard' && <Dashboard key={user.id} />}
        {halaman === 'Riwayat' && <Riwayat key={user.id} mesinAwal={mesinQR} />}
        {halaman === 'Prediksi' && <Prediksi key={user.id} />}
        {halaman === 'Jadwal PM' && <JadwalPM key={user.id} user={user} />}
        {halaman === 'QR Mesin' && <QRMesin key={user.id} />}
      </main>
    </div>
  )
}

export default App