import { useEffect, useState } from 'react'
import { ambil, kirim } from '../api'
import type { Mesin, User } from '../types'

interface Props {
  user: User
}

function LaporKerusakan({ user }: Props) {
  const [mesin, setMesin] = useState<Mesin[]>([])
  const [line, setLine] = useState('')
  const [mesinId, setMesinId] = useState('')
  const [keluhan, setKeluhan] = useState('')
  const [sukses, setSukses] = useState('')
  const [error, setError] = useState('')
  const [mengirim, setMengirim] = useState(false)

  useEffect(() => {
    ambil<Mesin[]>('/mesin')
      .then(setMesin)
      .catch((e: Error) => setError(e.message))
  }, [])

  const daftarLine = Array.from(new Set(mesin.map((m) => m.lokasi))).sort()
  const mesinDiLine = mesin.filter((m) => m.lokasi === line)

  function gantiLine(nilai: string) {
    setLine(nilai)
    setMesinId('')
  }

  async function kirimLaporan() {
    setSukses('')
    setError('')
    if (!line || !mesinId || !keluhan.trim()) {
      setError('Pilih line, mesin, dan isi keluhan dulu.')
      return
    }
    setMengirim(true)
    try {
      const hasil = await kirim<{ id: number }>('/tiket', 'POST', {
        mesin_id: Number(mesinId),
        operator_id: user.id,
        keluhan,
      })
      setSukses(`Laporan terkirim. Nomor tiket: #${hasil.id}`)
      setLine('')
      setMesinId('')
      setKeluhan('')
      setMesin(await ambil<Mesin[]>('/mesin'))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengirim laporan')
    } finally {
      setMengirim(false)
    }
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow">
      <h2 className="text-lg font-semibold text-slate-800">Lapor Kerusakan</h2>
      <p className="mt-1 text-sm text-slate-500">Pelapor: {user.nama}</p>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Line
        <select
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
          value={line}
          onChange={(e) => gantiLine(e.target.value)}
        >
          <option value="">-- pilih line --</option>
          {daftarLine.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Mesin
        <select
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
          value={mesinId}
          onChange={(e) => setMesinId(e.target.value)}
          disabled={!line}
        >
          <option value="">
            {line ? '-- pilih mesin --' : 'Pilih line dulu'}
          </option>
          {mesinDiLine.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nama} - {m.status}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-4 block text-sm font-medium text-slate-700">
        Keluhan
        <textarea
          className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
          rows={4}
          value={keluhan}
          onChange={(e) => setKeluhan(e.target.value)}
          placeholder="Contoh: suara kasar dan panas berlebih"
        />
      </label>

      <button
        onClick={kirimLaporan}
        disabled={mengirim}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400"
      >
        {mengirim ? 'Mengirim...' : 'Kirim Laporan'}
      </button>

      {sukses && (
        <p className="mt-4 rounded-lg bg-green-100 p-3 text-green-800">{sukses}</p>
      )}
      {error && (
        <p className="mt-4 rounded-lg bg-red-100 p-3 text-red-700">{error}</p>
      )}
    </div>
  )
}

export default LaporKerusakan