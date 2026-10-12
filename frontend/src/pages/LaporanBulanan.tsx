import { useCallback, useEffect, useState } from 'react'
import { ambil } from '../api'

interface LaporanTiketPart {
  part: string
  qty_dipakai: number
  satuan: string
}

interface LaporanTiket {
  id: number
  jenis_tiket: 'kerusakan' | 'pm'
  mesin_id: number
  mesin_nama: string
  keluhan: string
  status: string
  teknisi: string | null
  created_at: string
  diproses_at: string | null
  selesai_at: string
  downtime_menit: number | null
  durasi_pengerjaan_menit: number | null
  parts: LaporanTiketPart[]
}

interface PenambahanStok {
  id: number
  part_number: string
  part: string
  satuan: string
  qty_tambah: number
  stok_sebelum: number
  stok_sesudah: number
  created_at: string
  supervisor: string
}

interface Ringkasan {
  jumlah_tiket_kerusakan: number
  jumlah_tiket_pm: number
  total_downtime_menit: number
  mttr_menit: number
  jumlah_penambahan_stok: number
}

interface LaporanBulananData {
  bulan: string
  ringkasan: Ringkasan
  tiket: LaporanTiket[]
  penambahan_stok: PenambahanStok[]
}

function formatTanggal(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function labelBulan(bulan: string): string {
  const [tahun, bulanAngka] = bulan.split('-')
  const nama = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
  ]
  return `${nama[Number(bulanAngka) - 1]} ${tahun}`
}

function LaporanBulanan() {
  const [bulan, setBulan] = useState('')
  const [data, setData] = useState<LaporanBulananData | null>(null)
  const [error, setError] = useState('')
  const [memuat, setMemuat] = useState(false)

  const muat = useCallback(async (bulanDipilih: string) => {
    setMemuat(true)
    setError('')
    try {
      const q = bulanDipilih ? `?bulan=${bulanDipilih}` : ''
      const hasil = await ambil<LaporanBulananData>(`/laporan/bulanan${q}`)
      setData(hasil)
      setBulan(hasil.bulan)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat laporan bulanan')
    } finally {
      setMemuat(false)
    }
  }, [])

  useEffect(() => {
    void muat('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const r = data?.ringkasan

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h2 className="text-lg font-semibold text-slate-800">Laporan Bulanan</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={bulan}
            onChange={(e) => {
              setBulan(e.target.value)
              void muat(e.target.value)
            }}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            aria-label="Pilih bulan"
          />
          <button
            onClick={() => void muat(bulan)}
            className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Muat Ulang
          </button>
          <button
            onClick={() => window.print()}
            disabled={!data}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Cetak
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-100 p-3 text-red-700">{error}</p>
      )}

      {memuat && !data && <p className="text-slate-600">Memuat laporan...</p>}

      {data && (
        <>
          <h2 className="hidden text-xl font-bold text-slate-800 print:block">
            Laporan Bulanan — {labelBulan(data.bulan)}
          </h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <div className="rounded-xl bg-white p-4 shadow">
              <p className="text-xs text-slate-500">Tiket Kerusakan</p>
              <p className="text-2xl font-bold text-blue-700">
                {r?.jumlah_tiket_kerusakan ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow">
              <p className="text-xs text-slate-500">Tiket PM</p>
              <p className="text-2xl font-bold text-blue-700">
                {r?.jumlah_tiket_pm ?? 0}
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow">
              <p className="text-xs text-slate-500">Total Downtime</p>
              <p className="text-2xl font-bold text-blue-700">
                {r?.total_downtime_menit ?? 0} mnt
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow">
              <p className="text-xs text-slate-500">MTTR</p>
              <p className="text-2xl font-bold text-blue-700">
                {r ? Number(r.mttr_menit).toFixed(1) : 0} mnt
              </p>
            </div>
            <div className="rounded-xl bg-white p-4 shadow">
              <p className="text-xs text-slate-500">Penambahan Stok</p>
              <p className="text-2xl font-bold text-blue-700">
                {r?.jumlah_penambahan_stok ?? 0}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h3 className="font-semibold text-slate-800">
              Tiket Selesai ({data.tiket.length})
            </h3>
            {data.tiket.length === 0 ? (
              <p className="mt-2 text-slate-600">
                Tidak ada tiket selesai pada bulan ini.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="py-2 pr-3">Mesin</th>
                      <th className="py-2 pr-3">Jenis</th>
                      <th className="py-2 pr-3">Keluhan</th>
                      <th className="py-2 pr-3">Teknisi</th>
                      <th className="py-2 pr-3">Selesai</th>
                      <th className="py-2 pr-3">Downtime</th>
                      <th className="py-2 pr-3">Part Dipakai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.tiket.map((t) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">{t.mesin_nama}</td>
                        <td className="py-2 pr-3">
                          {t.jenis_tiket === 'pm' ? 'PM' : 'Kerusakan'}
                        </td>
                        <td className="py-2 pr-3">{t.keluhan}</td>
                        <td className="py-2 pr-3">{t.teknisi ?? '-'}</td>
                        <td className="py-2 pr-3">{formatTanggal(t.selesai_at)}</td>
                        <td className="py-2 pr-3">
                          {t.downtime_menit !== null ? `${t.downtime_menit} mnt` : '-'}
                        </td>
                        <td className="py-2 pr-3">
                          {t.parts.length === 0
                            ? '-'
                            : t.parts
                                .map((p) => `${p.part} x${p.qty_dipakai} ${p.satuan}`)
                                .join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h3 className="font-semibold text-slate-800">
              Penambahan Stok ({data.penambahan_stok.length})
            </h3>
            {data.penambahan_stok.length === 0 ? (
              <p className="mt-2 text-slate-600">
                Tidak ada penambahan stok pada bulan ini.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="py-2 pr-3">Part</th>
                      <th className="py-2 pr-3">Nomor Part</th>
                      <th className="py-2 pr-3">Jumlah</th>
                      <th className="py-2 pr-3">Stok Sebelum → Sesudah</th>
                      <th className="py-2 pr-3">Oleh</th>
                      <th className="py-2 pr-3">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.penambahan_stok.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">{s.part}</td>
                        <td className="py-2 pr-3">{s.part_number}</td>
                        <td className="py-2 pr-3">
                          {s.qty_tambah} {s.satuan}
                        </td>
                        <td className="py-2 pr-3">
                          {s.stok_sebelum} → {s.stok_sesudah}
                        </td>
                        <td className="py-2 pr-3">{s.supervisor}</td>
                        <td className="py-2 pr-3">{formatTanggal(s.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default LaporanBulanan