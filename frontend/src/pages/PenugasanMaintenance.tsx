
import { useCallback, useEffect, useState } from 'react'
import { ambil, kirim } from '../api'

interface TiketAntrean {
  id: number
  mesin_id: number
  keluhan: string
  laporan_permasalahan: string | null
  laporan_leader: string | null
  laporan_installer: string | null
  status: string
  created_at: string
  ttd_foreman_oleh: string | null
  ttd_foreman_at: string | null
  ttd_spv_oleh: string | null
  ttd_spv_at: string | null
  ditugaskan_ke: number | null
  nama_mesin: string
  lokasi: string
  divisi: string
}

interface Mekanik {
  id: number
  nama: string
}

export default function PenugasanMaintenance() {
  const [tiket, setTiket] = useState<TiketAntrean[]>([])
  const [mekanik, setMekanik] = useState<Mekanik[]>([])
  const [pilihanMekanik, setPilihanMekanik] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [menugaskan, setMenugaskan] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [pesan, setPesan] = useState('')

  const muatData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [antrean, daftarMekanik] = await Promise.all([
        ambil<TiketAntrean[]>('/penugasan-maintenance/antrean'),
        ambil<Mekanik[]>('/penugasan-maintenance/mekanik'),
      ])

      setTiket(antrean)
      setMekanik(daftarMekanik)

      setPilihanMekanik((sebelumnya) => {
        const berikutnya = { ...sebelumnya }

        for (const item of antrean) {
          if (!berikutnya[item.id] && daftarMekanik.length > 0) {
            berikutnya[item.id] = String(daftarMekanik[0].id)
          }
        }

        return berikutnya
      })
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal memuat antrean penugasan.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void muatData()
  }, [muatData])

  async function tugaskan(item: TiketAntrean) {
    const mekanikId = Number(pilihanMekanik[item.id])

    if (!Number.isSafeInteger(mekanikId) || mekanikId <= 0) {
      setError('Pilih mekanik terlebih dahulu.')
      return
    }

    setMenugaskan(item.id)
    setError('')
    setPesan('')

    try {
      const hasil = await kirim<{ message: string }>(
        `/penugasan-maintenance/${item.id}/tugaskan`,
        'PATCH',
        { mekanik_id: mekanikId }
      )

      setPesan(hasil.message)
      await muatData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal menugaskan tiket.'
      )
    } finally {
      setMenugaskan(null)
    }
  }

  function tanggal(value: string | null) {
    if (!value) return '-'

    const date = new Date(value)

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Penugasan Maintenance
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tiket yang telah menerima kedua tanda tangan dan siap ditugaskan
            kepada mekanik.
          </p>
        </div>

        <button
          onClick={() => void muatData()}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Memuat...' : 'Muat Ulang'}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {pesan && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"
        >
          {pesan}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Memuat antrean tiket...</p>
      ) : tiket.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="font-semibold text-slate-700">
            Belum ada tiket untuk ditugaskan
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Tiket akan muncul setelah tanda tangan Foreman dan SPV Divisi
            lengkap.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tiket.map((item) => (
            <article
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tiket #{item.id}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-800">
                    {item.nama_mesin}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Divisi {item.divisi} · {item.lokasi}
                  </p>
                </div>

                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  Menunggu Penugasan
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-semibold">Keluhan:</span>{' '}
                  {item.keluhan}
                </p>

                {item.laporan_leader && (
                  <p>
                    <span className="font-semibold">Laporan Leader:</span>{' '}
                    {item.laporan_leader}
                  </p>
                )}

                {item.laporan_installer && (
                  <p>
                    <span className="font-semibold">Laporan Installer:</span>{' '}
                    {item.laporan_installer}
                  </p>
                )}

                {item.laporan_permasalahan && (
                  <p>
                    <span className="font-semibold">
                      Laporan Permasalahan:
                    </span>{' '}
                    {item.laporan_permasalahan}
                  </p>
                )}

                <p>
                  <span className="font-semibold">Tanggal:</span>{' '}
                  {tanggal(item.created_at)}
                </p>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-semibold">Foreman</p>
                  <p className="text-green-700">
                    {item.ttd_foreman_oleh || 'Belum tersedia'}
                  </p>
                  {item.ttd_foreman_at && (
                    <p className="mt-1 text-xs text-slate-500">
                      {tanggal(item.ttd_foreman_at)}
                    </p>
                  )}
                </div>

                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-semibold">SPV Divisi</p>
                  <p className="text-green-700">
                    {item.ttd_spv_oleh || 'Belum tersedia'}
                  </p>
                  {item.ttd_spv_at && (
                    <p className="mt-1 text-xs text-slate-500">
                      {tanggal(item.ttd_spv_at)}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <label
                  htmlFor={`mekanik-${item.id}`}
                  className="block text-sm font-semibold text-slate-700"
                >
                  Pilih mekanik
                </label>

                <select
                  id={`mekanik-${item.id}`}
                  value={pilihanMekanik[item.id] || ''}
                  onChange={(e) =>
                    setPilihanMekanik((sebelumnya) => ({
                      ...sebelumnya,
                      [item.id]: e.target.value,
                    }))
                  }
                  disabled={menugaskan === item.id || mekanik.length === 0}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 disabled:bg-slate-100"
                >
                  <option value="">-- Pilih mekanik --</option>
                  {mekanik.map((orang) => (
                    <option key={orang.id} value={orang.id}>
                      {orang.nama} (ID {orang.id})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => void tugaskan(item)}
                  disabled={
                    menugaskan !== null ||
                    mekanik.length === 0 ||
                    !pilihanMekanik[item.id]
                  }
                  className="w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {menugaskan === item.id
                    ? 'Menugaskan...'
                    : 'Tugaskan ke Mekanik'}
                </button>

                {mekanik.length === 0 && (
                  <p className="text-xs text-amber-700">
                    Belum ada akun dengan role mekanik_mtnc.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}