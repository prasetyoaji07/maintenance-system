import { useCallback, useEffect, useState } from 'react'
import { ambil } from '../api'

interface Backtest {
  jendela: number
  wape: number | null
  jumlah_uji: number
}

interface Prakiraan {
  part_id: number
  part_number: string
  nama: string
  kategori: string
  satuan: string
  stok: number
  minimum_stok: number
  prakiraan_qty: number
  kebutuhan_tambahan: number
  status: 'aman' | 'menipis' | 'kurang'
}

interface Prediksi {
  bulan_target: string
  bulan_riwayat_awal?: string
  bulan_riwayat_akhir?: string
  jumlah_bulan_riwayat: number
  jendela_terbaik: number | null
  jendela_dipakai: number | null
  backtest: Backtest[]
  prakiraan: Prakiraan[]
  pesan?: string
}

type PilihanJendela = 'otomatis' | '3' | '6' | '12'

const PILIHAN: { nilai: PilihanJendela; label: string }[] = [
  { nilai: 'otomatis', label: 'Otomatis (terbaik)' },
  { nilai: '3', label: '3 bulan' },
  { nilai: '6', label: '6 bulan' },
  { nilai: '12', label: '12 bulan' },
]

const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const BADGE: Record<Prakiraan['status'], string> = {
  aman: 'bg-green-100 text-green-800',
  menipis: 'bg-amber-100 text-amber-800',
  kurang: 'bg-red-100 text-red-700',
}

const LABEL_STATUS: Record<Prakiraan['status'], string> = {
  aman: 'Aman',
  menipis: 'Menipis',
  kurang: 'Kurang',
}

const URUTAN: Record<Prakiraan['status'], number> = {
  kurang: 0,
  menipis: 1,
  aman: 2,
}

function namaBulan(kunci: string): string {
  const [tahun, bulan] = kunci.split('-')
  return `${NAMA_BULAN[Number(bulan) - 1]} ${tahun}`
}

function persen(wape: number | null): string {
  return wape === null ? '-' : (wape * 100).toFixed(1) + '%'
}

function Prediksi() {
  const [jendela, setJendela] = useState<PilihanJendela>('otomatis')
  const [semua, setSemua] = useState(false)
  const [data, setData] = useState<Prediksi | null>(null)
  const [error, setError] = useState('')
  const [memuatData, setMemuatData] = useState(false)

  const muat = useCallback(async () => {
    setError('')
    setMemuatData(true)
    try {
      const q = jendela === 'otomatis' ? '' : `?jendela=${jendela}`
      setData(await ambil<Prediksi>(`/prediksi/part${q}`))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat prediksi')
    } finally {
      setMemuatData(false)
    }
  }, [jendela])

  useEffect(() => {
    void muat()
  }, [muat])

  const daftar = (data?.prakiraan ?? [])
    .filter((p) => semua || p.status !== 'aman')
    .sort(
      (a, b) =>
        URUTAN[a.status] - URUTAN[b.status] ||
        b.kebutuhan_tambahan - a.kebutuhan_tambahan,
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Prediksi Kebutuhan Part
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {PILIHAN.map((p) => (
            <button
              key={p.nilai}
              onClick={() => setJendela(p.nilai)}
              className={
                'rounded-lg px-3 py-1.5 text-sm font-semibold ' +
                (jendela === p.nilai
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300')
              }
            >
              {p.label}
            </button>
          ))}
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
      {memuatData && !data && <p className="text-slate-600">Memuat...</p>}

      {data?.pesan && (
        <p className="rounded-lg bg-amber-100 p-3 text-amber-800">
          {data.pesan}
        </p>
      )}

      {data && data.jendela_dipakai !== null && (
        <>
          <div className="rounded-xl bg-white p-6 shadow">
            <p className="text-sm text-slate-500">
              Prakiraan kebutuhan untuk
            </p>
            <p className="text-3xl font-bold text-blue-700">
              {namaBulan(data.bulan_target)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Metode WMA jendela {data.jendela_dipakai} bulan
              {data.jendela_terbaik === data.jendela_dipakai
                ? ' (terbaik menurut backtest)'
                : ` (jendela terbaik menurut backtest: ${data.jendela_terbaik} bulan)`}
              . Riwayat {data.jumlah_bulan_riwayat} bulan
              {data.bulan_riwayat_awal && data.bulan_riwayat_akhir
                ? `, ${namaBulan(data.bulan_riwayat_awal)} sampai ${namaBulan(data.bulan_riwayat_akhir)}`
                : ''}
              .
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h3 className="font-semibold text-slate-800">
              Hasil Backtest per Jendela
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="py-2 pr-4">Jendela</th>
                    <th className="py-2 pr-4">Galat (WAPE)</th>
                    <th className="py-2">Jumlah uji</th>
                  </tr>
                </thead>
                <tbody>
                  {data.backtest.map((b) => (
                    <tr
                      key={b.jendela}
                      className={
                        'border-b ' +
                        (b.jendela === data.jendela_terbaik
                          ? 'bg-blue-50 font-semibold'
                          : '')
                      }
                    >
                      <td className="py-2 pr-4">{b.jendela} bulan</td>
                      <td className="py-2 pr-4">{persen(b.wape)}</td>
                      <td className="py-2">{b.jumlah_uji}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              WAPE = total selisih absolut prakiraan dan pemakaian aktual dibagi
              total pemakaian aktual, makin kecil makin baik. Data riwayat
              adalah simulasi, jadi angka ini bukan akurasi di dunia nyata.
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-800">
                Prakiraan per Part
              </h3>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={semua}
                  onChange={(e) => setSemua(e.target.checked)}
                />
                Tampilkan semua part ({data.prakiraan.length})
              </label>
            </div>

            {daftar.length === 0 ? (
              <p className="mt-2 text-slate-600">
                Semua stok aman untuk bulan ini.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="py-2 pr-4">Part</th>
                      <th className="py-2 pr-4">Kategori</th>
                      <th className="py-2 pr-4">Stok</th>
                      <th className="py-2 pr-4">Minimum</th>
                      <th className="py-2 pr-4">Prakiraan</th>
                      <th className="py-2 pr-4">Perlu ditambah</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {daftar.map((p) => (
                      <tr key={p.part_id} className="border-b">
                        <td className="py-2 pr-4">
                          <span className="font-semibold">{p.part_number}</span>
                          <br />
                          <span className="text-slate-500">{p.nama}</span>
                        </td>
                        <td className="py-2 pr-4">{p.kategori}</td>
                        <td className="py-2 pr-4">
                          {p.stok} {p.satuan}
                        </td>
                        <td className="py-2 pr-4">{p.minimum_stok}</td>
                        <td className="py-2 pr-4">{p.prakiraan_qty}</td>
                        <td className="py-2 pr-4">
                          {p.kebutuhan_tambahan > 0
                            ? `+${p.kebutuhan_tambahan} ${p.satuan}`
                            : '-'}
                        </td>
                        <td className="py-2">
                          <span
                            className={
                              'rounded-full px-2 py-0.5 text-xs font-semibold ' +
                              BADGE[p.status]
                            }
                          >
                            {LABEL_STATUS[p.status]}
                          </span>
                        </td>
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

export default Prediksi