import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ambil, kirim } from '../api'
import type { JadwalPM as Jadwal, Mesin, User } from '../types'

interface Props {
  user: User
}

// Tanggal "YYYY-MM-DD" dari backend ditampilkan apa adanya (tanpa Date, supaya tidak bergeser zona waktu)
function tampilTanggal(s: string): string {
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

function JadwalPM({ user }: Props) {
  const supervisor = user.role === 'supervisor'
  const [jadwal, setJadwal] = useState<Jadwal[]>([])
  const [mesin, setMesin] = useState<Mesin[]>([])
  const [mesinId, setMesinId] = useState('')
  const [nama, setNama] = useState('')
  const [interval, setInterval_] = useState('')
  const [tempo, setTempo] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [sibuk, setSibuk] = useState(false)

  const muat = useCallback(async () => {
    try {
      const [j, m] = await Promise.all([
        ambil<Jadwal[]>('/pm'),
        ambil<Mesin[]>('/mesin'),
      ])
      setJadwal(j)
      setMesin(m)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat jadwal PM')
    }
  }, [])

  useEffect(() => {
    void muat()
  }, [muat])

  async function tambah(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setSibuk(true)
    try {
      await kirim('/pm', 'POST', {
        mesin_id: Number(mesinId),
        nama_tugas: nama,
        interval_hari: Number(interval),
        jatuh_tempo_berikutnya: tempo,
      })
      setNama('')
      setInterval_('')
      setTempo('')
      setInfo('Jadwal PM ditambahkan.')
      await muat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menambah jadwal')
    } finally {
      setSibuk(false)
    }
  }

  async function ubahAktif(j: Jadwal) {
    setError('')
    setInfo('')
    setSibuk(true)
    try {
      await kirim(`/pm/${j.id}`, 'PATCH', { aktif: !j.aktif })
      await muat()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengubah jadwal')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">
        Jadwal Preventive Maintenance
      </h2>

      {info && (
        <p className="rounded-lg bg-green-100 p-3 text-green-800">{info}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-100 p-3 text-red-700">{error}</p>
      )}

      {supervisor && (
        <form
          onSubmit={(e) => void tambah(e)}
          className="grid gap-3 rounded-xl bg-white p-6 shadow sm:grid-cols-2"
        >
          <label className="text-sm text-slate-600">
            Mesin
            <select
              required
              value={mesinId}
              onChange={(e) => setMesinId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            >
              <option value="">Pilih mesin</option>
              {mesin.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nama} ({m.lokasi})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Nama tugas
            <input
              required
              maxLength={150}
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              placeholder="Contoh: Ganti oli"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-600">
            Interval (hari)
            <input
              required
              type="number"
              min={1}
              max={3650}
              value={interval}
              onChange={(e) => setInterval_(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="text-sm text-slate-600">
            Jatuh tempo pertama
            <input
              required
              type="date"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={sibuk}
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400"
            >
              Tambah Jadwal
            </button>
          </div>
        </form>
      )}

      {jadwal.length === 0 && !error && (
        <p className="rounded-xl bg-white p-6 text-slate-600 shadow">
          Belum ada jadwal PM.
        </p>
      )}

      {jadwal.map((j) => (
        <div
          key={j.id}
          className={
            'rounded-xl bg-white p-5 shadow ' + (j.aktif ? '' : 'opacity-60')
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-slate-800">
              {j.nama_tugas} - {j.mesin_nama}
            </p>
            <div className="flex gap-2">
              {j.terlambat && (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800">
                  Terlambat
                </span>
              )}
              <span
                className={
                  'rounded-full px-3 py-1 text-xs font-semibold ' +
                  (j.aktif
                    ? 'bg-green-100 text-green-800'
                    : 'bg-slate-200 text-slate-700')
                }
              >
                {j.aktif ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Setiap {j.interval_hari} hari | Jatuh tempo berikutnya:{' '}
            {tampilTanggal(j.jatuh_tempo_berikutnya)}
          </p>
          {supervisor && (
            <button
              onClick={() => void ubahAktif(j)}
              disabled={sibuk}
              className="mt-3 rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-60"
            >
              {j.aktif ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

export default JadwalPM