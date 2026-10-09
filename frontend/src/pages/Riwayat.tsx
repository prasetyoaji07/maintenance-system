import { useEffect, useState } from 'react'
import { ambil } from '../api'
import type { Mesin, RiwayatMesin } from '../types'

// Database menyimpan waktu UTC, tampilannya dikonversi ke WIB
function tampilWaktu(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function tampilDurasi(menit: number | null): string {
  if (menit === null) return 'Belum selesai'
  if (menit < 60) return `${menit} menit`
  const jam = Math.floor(menit / 60)
  const sisa = menit % 60
  return sisa === 0 ? `${jam} jam` : `${jam} jam ${sisa} menit`
}

const WARNA_STATUS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  diproses: 'bg-blue-100 text-blue-800',
  menunggu_approval: 'bg-orange-100 text-orange-800',
  selesai: 'bg-green-100 text-green-800',
}

function Riwayat() {
  const [daftarMesin, setDaftarMesin] = useState<Mesin[]>([])
  const [mesinId, setMesinId] = useState<number | null>(null)
  const [data, setData] = useState<RiwayatMesin | null>(null)
  const [error, setError] = useState('')
  const [memuat, setMemuat] = useState(false)

  useEffect(() => {
    ambil<Mesin[]>('/mesin')
      .then((m) => {
        setDaftarMesin(m)
        if (m.length > 0) setMesinId(m[0].id)
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    if (mesinId === null) return
    setMemuat(true)
    setError('')
    ambil<RiwayatMesin>(`/mesin/${mesinId}/riwayat`)
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setMemuat(false))
  }, [mesinId])

  const selesai = data?.tiket.filter((t) => t.downtime_menit !== null) ?? []
  const totalDowntime = selesai.reduce((s, t) => s + (t.downtime_menit ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-bold text-slate-800">
          Riwayat Kerusakan per Mesin
        </h2>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Mesin:
          <select
            className="rounded-lg border border-slate-300 px-3 py-1.5"
            value={mesinId ?? ''}
            onChange={(e) => setMesinId(Number(e.target.value))}
          >
            {daftarMesin.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nama} ({m.lokasi})
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="rounded-lg bg-red-100 p-4 text-red-700">
          Gagal memuat: {error}
        </p>
      )}
      {memuat && <p className="text-slate-500">Memuat...</p>}

      {data && !memuat && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-white p-4 shadow">
              <p className="text-xs text-slate-500">Jumlah kerusakan</p>
              <p className="text-2xl font-bold text-slate-800">
                {data.tiket.length}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow">
              <p className="text-xs text-slate-500">Total downtime</p>
              <p className="text-2xl font-bold text-slate-800">
                {tampilDurasi(totalDowntime)}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow">
              <p className="text-xs text-slate-500">Status sekarang</p>
              <p className="text-2xl font-bold text-slate-800">
                {data.mesin.status}
              </p>
            </div>
          </div>

          {data.tiket.length === 0 && (
            <p className="rounded-lg bg-white p-6 text-slate-500 shadow">
              Mesin ini belum pernah rusak.
            </p>
          )}

          {data.tiket.map((t) => (
            <div key={t.id} className="rounded-xl bg-white p-5 shadow">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-bold text-slate-800">Tiket #{t.id}</p>
                <span
                  className={
                    'rounded-full px-3 py-1 text-xs font-semibold ' +
                    (WARNA_STATUS[t.status] ?? 'bg-slate-100 text-slate-700')
                  }
                >
                  {t.status}
                </span>
              </div>
              <p className="mb-3 text-slate-700">{t.keluhan}</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-600">
                <p>Operator: {t.operator}</p>
                <p>Teknisi: {t.teknisi ?? '-'}</p>
                <p>Dilaporkan: {tampilWaktu(t.created_at)}</p>
                <p>Selesai: {tampilWaktu(t.selesai_at)}</p>
                <p className="col-span-2 font-semibold text-slate-800">
                  Downtime: {tampilDurasi(t.downtime_menit)}
                </p>
              </div>
              {t.parts.length > 0 && (
                <p className="mt-3 text-sm text-slate-600">
                  Part dipakai:{' '}
                  {t.parts
                    .map((p) => `${p.part} (${p.qty_dipakai} ${p.satuan})`)
                    .join(', ')}
                </p>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  )
}

export default Riwayat