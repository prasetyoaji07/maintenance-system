
import { useCallback, useEffect, useState } from 'react'
import { ambil, kirim } from '../api'
import type { User } from '../types'

interface Props {
  user: User
}

interface TiketDivisi {
  id: number
  mesin_id: number
  keluhan: string
  status: string
  laporan_leader: string | null
  laporan_installer: string | null
  laporan_permasalahan: string | null
  nama_mesin: string
  lokasi: string
  divisi: string
  nama_pelapor: string | null
}

function AlurDivisi({ user }: Props) {
  const [tiket, setTiket] = useState<TiketDivisi[]>([])
  const [laporan, setLaporan] = useState<Record<number, string>>({})
  const [memuat, setMemuat] = useState(true)
  const [prosesId, setProsesId] = useState<number | null>(null)
  const [pesan, setPesan] = useState('')
  const [error, setError] = useState('')

  const leader = user.role === 'leader_divisi'

  const muatTiket = useCallback(async () => {
    setMemuat(true)
    setError('')

    try {
      const data = await ambil<TiketDivisi[]>('/tiket/alur-divisi')
      setTiket(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat tiket.')
    } finally {
      setMemuat(false)
    }
  }, [])

  useEffect(() => {
    void muatTiket()
  }, [muatTiket])

  async function jalankanAksi(
    id: number,
    aksi: 'selesai' | 'teruskan_installer' | 'menunggu_ttd',
  ) {
    setPesan('')
    setError('')

    const isiLaporan = (laporan[id] || '').trim()

    if (
      (aksi === 'teruskan_installer' || aksi === 'menunggu_ttd') &&
      !isiLaporan
    ) {
      setError('Isi laporan terlebih dahulu.')
      return
    }

    const konfirmasi =
      aksi === 'selesai'
        ? 'Yakin menyelesaikan tiket ini? Status mesin akan menjadi jalan.'
        : aksi === 'teruskan_installer'
          ? 'Teruskan tiket ini ke Installer?'
          : 'Kirim laporan ini ke antrean tanda tangan?'

    if (!window.confirm(konfirmasi)) return

    setProsesId(id)

    try {
      await kirim(
        `/tiket/alur-divisi/${id}/aksi`,
        'PATCH',
        { aksi, laporan: isiLaporan },
      )

      setPesan(`Tiket #${id} berhasil diperbarui.`)
      setLaporan((sebelumnya) => {
        const berikutnya = { ...sebelumnya }
        delete berikutnya[id]
        return berikutnya
      })

      await muatTiket()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memproses tiket.')
    } finally {
      setProsesId(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-white p-6 shadow">
        <h2 className="text-xl font-bold text-slate-800">
          Alur Penanganan Divisi
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {leader
            ? 'Tinjau laporan kerusakan dan teruskan ke Installer atau selesaikan.'
            : 'Tinjau kerusakan, isi hasil pemeriksaan, lalu selesaikan atau minta tanda tangan.'}
        </p>

        <button
          onClick={() => void muatTiket()}
          disabled={memuat}
          className="mt-4 rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-50"
        >
          {memuat ? 'Memuat...' : 'Muat Ulang'}
        </button>
      </div>

      {pesan && (
        <p className="rounded-lg bg-green-100 p-3 text-sm text-green-800">
          {pesan}
        </p>
      )}

      {error && (
        <p className="whitespace-pre-wrap rounded-lg bg-red-100 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {memuat ? (
        <p className="p-4 text-slate-500">Memuat daftar tiket...</p>
      ) : tiket.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-center text-slate-500 shadow">
          Tidak ada tiket yang menunggu penanganan.
        </div>
      ) : (
        tiket.map((item) => (
          <div key={item.id} className="space-y-4 rounded-xl bg-white p-6 shadow">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-800">
                  Tiket #{item.id} — {item.nama_mesin}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Line/lokasi: {item.lokasi} · Divisi: {item.divisi}
                </p>
                <p className="text-sm text-slate-500">
                  Pelapor: {item.nama_pelapor || '-'}
                </p>
              </div>

              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                {item.status}
              </span>
            </div>

            <div>
              <p className="text-sm font-semibold text-slate-700">Keluhan</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                {item.keluhan}
              </p>
            </div>

            {item.laporan_leader && (
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Laporan Leader
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                  {item.laporan_leader}
                </p>
              </div>
            )}

            {!leader && (
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  Laporan Installer
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                  {item.laporan_installer || 'Belum diisi'}
                </p>
              </div>
            )}

            <label className="block text-sm font-semibold text-slate-700">
              {leader ? 'Catatan penanganan Leader' : 'Hasil pemeriksaan Installer'}
              <textarea
                rows={4}
                value={laporan[item.id] || ''}
                onChange={(e) =>
                  setLaporan((sebelumnya) => ({
                    ...sebelumnya,
                    [item.id]: e.target.value,
                  }))
                }
                placeholder={
                  leader
                    ? 'Jelaskan hasil pemeriksaan atau tindakan awal...'
                    : 'Jelaskan perbaikan dan hasil pemeriksaan...'
                }
                disabled={prosesId !== null}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 font-normal disabled:bg-slate-100"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void jalankanAksi(item.id, 'selesai')}
                disabled={prosesId !== null}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                Selesaikan Tiket
              </button>

              {leader ? (
                <button
                  onClick={() =>
                    void jalankanAksi(item.id, 'teruskan_installer')
                  }
                  disabled={prosesId !== null}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Teruskan ke Installer
                </button>
              ) : (
                <button
                  onClick={() => void jalankanAksi(item.id, 'menunggu_ttd')}
                  disabled={prosesId !== null}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  Minta Tanda Tangan
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

export default AlurDivisi
