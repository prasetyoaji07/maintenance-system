import { useCallback, useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ambil } from '../api'

interface Downtime {
  mesin_id: number
  mesin_nama: string
  jumlah_tiket_selesai: number
  total_downtime_menit: number
}

interface PartTerpakai {
  part_id: number
  part_nama: string
  satuan: string
  total_qty_dipakai: number
}

interface Mttr {
  jumlah_tiket_selesai: number
  mttr_menit: number | null
}

interface StokMenipis {
  id: number
  nama: string
  stok: number
  satuan: string
  minimum_stok: number
}

function Dashboard() {
  const [downtime, setDowntime] = useState<Downtime[]>([])
  const [part, setPart] = useState<PartTerpakai[]>([])
  const [mttr, setMttr] = useState<Mttr | null>(null)
  const [menipis, setMenipis] = useState<StokMenipis[]>([])
  const [error, setError] = useState('')

  const muat = useCallback(async () => {
    setError('')
    try {
      const [d, p, m, s] = await Promise.all([
        ambil<Downtime[]>('/dashboard/downtime'),
        ambil<PartTerpakai[]>('/dashboard/part-terpakai'),
        ambil<Mttr>('/dashboard/mttr'),
        ambil<StokMenipis[]>('/dashboard/stok-menipis'),
      ])
      setDowntime(d)
      setPart(p)
      setMttr(m)
      setMenipis(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat dashboard')
    }
  }, [])

  useEffect(() => {
    void muat()
  }, [muat])

  const nilaiMttr =
    mttr && mttr.mttr_menit !== null
      ? Number(mttr.mttr_menit).toFixed(1) + ' menit'
      : '-'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Dashboard</h2>
        <button
          onClick={() => void muat()}
          className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Muat Ulang
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-100 p-3 text-red-700">{error}</p>
      )}

      <div className="rounded-xl bg-white p-6 shadow">
        <p className="text-sm text-slate-500">MTTR (rata-rata waktu perbaikan)</p>
        <p className="text-3xl font-bold text-blue-700">{nilaiMttr}</p>
        <p className="text-sm text-slate-500">
          dari {mttr?.jumlah_tiket_selesai ?? 0} tiket selesai
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <h3 className="font-semibold text-slate-800">
          Total Downtime per Mesin (menit)
        </h3>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={downtime}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mesin_nama" />
              <YAxis />
              <Tooltip />
              <Bar
                dataKey="total_downtime_menit"
                name="Downtime (menit)"
                fill="#2563eb"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <h3 className="font-semibold text-slate-800">
          Spare Part Terpakai
        </h3>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={part}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="part_nama" />
              <YAxis />
              <Tooltip />
              <Bar
                dataKey="total_qty_dipakai"
                name="Jumlah dipakai"
                fill="#ea580c"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <h3 className="font-semibold text-slate-800">Stok Menipis</h3>
        {menipis.length === 0 ? (
          <p className="mt-2 text-slate-600">Semua stok di atas minimum.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {menipis.map((s) => (
              <li
                key={s.id}
                className="rounded-lg bg-red-50 p-3 text-sm text-red-800"
              >
                <span className="font-semibold">{s.nama}</span>: stok {s.stok}{' '}
                {s.satuan} (minimum {s.minimum_stok})
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export default Dashboard