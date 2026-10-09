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

type Periode = 'semua' | 'hari' | 'minggu' | 'bulan'

const PILIHAN_PERIODE: { nilai: Periode; label: string }[] = [
  { nilai: 'semua', label: 'Semua waktu' },
  { nilai: 'hari', label: 'Hari ini' },
  { nilai: 'minggu', label: '7 hari terakhir' },
  { nilai: 'bulan', label: 'Bulan ini' },
]

function Dashboard() {
  const [periode, setPeriode] = useState<Periode>('semua')
  const [bulan, setBulan] = useState('')
  const [downtime, setDowntime] = useState<Downtime[]>([])
  const [part, setPart] = useState<PartTerpakai[]>([])
  const [mttr, setMttr] = useState<Mttr | null>(null)
  const [menipis, setMenipis] = useState<StokMenipis[]>([])
  const [error, setError] = useState('')

  const muat = useCallback(async () => {
    setError('')
    try {
      const q = bulan ? `?bulan=${bulan}` : `?periode=${periode}`
      const [d, p, m, s] = await Promise.all([
        ambil<Downtime[]>(`/dashboard/downtime${q}`),
        ambil<PartTerpakai[]>(`/dashboard/part-terpakai${q}`),
        ambil<Mttr>(`/dashboard/mttr${q}`),
        ambil<StokMenipis[]>('/dashboard/stok-menipis'),
      ])
      setDowntime(d)
      setPart(p)
      setMttr(m)
      setMenipis(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat dashboard')
    }
 }, [periode, bulan])

  useEffect(() => {
    void muat()
  }, [muat])

  const nilaiMttr =
    mttr && mttr.jumlah_tiket_selesai > 0 && mttr.mttr_menit !== null
      ? Number(mttr.mttr_menit).toFixed(1) + ' menit'
      : '-'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800">Dashboard</h2>
        <div className="flex flex-wrap items-center gap-2">
          {PILIHAN_PERIODE.map((p) => (
            <button
              key={p.nilai}
                onClick={() => {
                setPeriode(p.nilai)
                setBulan('')
              }}
              className={
                'rounded-lg px-3 py-1.5 text-sm font-semibold ' +
                (bulan === '' && periode === p.nilai
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300')
              }
            >
              {p.label}
            </button>
          ))}
                    <input
            type="month"
            value={bulan}
            onChange={(e) => setBulan(e.target.value)}
            className={
              'rounded-lg border px-3 py-1.5 text-sm ' +
              (bulan ? 'border-blue-600 bg-blue-50' : 'border-slate-300')
            }
            aria-label="Pilih bulan"
          />
          <button
            onClick={() => void muat()}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Muat Ulang
          </button>
        </div>
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
              <YAxis allowDecimals={false} />
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
        <h3 className="font-semibold text-slate-800">Spare Part Terpakai</h3>
        {part.length === 0 ? (
          <p className="mt-2 text-slate-600">
            Belum ada part terpakai pada periode ini.
          </p>
        ) : (
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={part}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="part_nama" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar
                  dataKey="total_qty_dipakai"
                  name="Jumlah dipakai"
                  fill="#ea580c"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-white p-6 shadow">
        <h3 className="font-semibold text-slate-800">
          Stok Menipis (kondisi saat ini)
        </h3>
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