import { useCallback, useEffect, useState } from 'react'
import { ambil, kirim } from '../api'
import type { SparePart, Tiket, TiketDetail, User } from '../types'

interface Props {
  user: User
}

function waktu(iso: string | null): string {
  if (!iso) return '-'
  return (
    new Date(iso).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' WIB'
  )
}

function Approval({ user }: Props) {
  const [tiket, setTiket] = useState<TiketDetail[]>([])
  const [parts, setParts] = useState<SparePart[]>([])
  const [pilihPart, setPilihPart] = useState('')
  const [qty, setQty] = useState('')
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [sibuk, setSibuk] = useState(false)

  const muat = useCallback(async () => {
    try {
      const [daftar, sp] = await Promise.all([
        ambil<Tiket[]>('/tiket?status=aktif'),
        ambil<SparePart[]>('/spare-parts'),
      ])
      const menunggu = daftar.filter((t) => t.status === 'menunggu_approval')
      const detail = await Promise.all(
        menunggu.map((t) => ambil<TiketDetail>(`/tiket/${t.id}`))
      )
      setTiket(detail)
      setParts(sp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data')
    }
  }, [])

  useEffect(() => {
    void muat()
  }, [muat])

  async function jalankan(aksi: () => Promise<string>) {
    setError('')
    setInfo('')
    setSibuk(true)
    try {
      setInfo(await aksi())
      await muat()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aksi gagal')
    } finally {
      setSibuk(false)
    }
  }

  function setujui(t: TiketDetail) {
    void jalankan(async () => {
      await kirim(`/tiket/${t.id}/setujui`, 'PATCH', {
        supervisor_id: user.id,
      })
      return `Part pada tiket #${t.id} disetujui. Teknisi bisa menekan Lanjut setelah stok cukup.`
    })
  }

  function tambahStok() {
    const partId = Number(pilihPart)
    const jumlah = Number(qty)
    if (!partId || !Number.isInteger(jumlah) || jumlah < 1) {
      setInfo('')
      setError('Pilih part dan isi jumlah (angka bulat, minimal 1).')
      return
    }
    void jalankan(async () => {
      const hasil = await kirim<{
        nama: string
        stok_sebelum: number
        stok_sekarang: number
      }>(`/spare-parts/${partId}/stok`, 'POST', {
        supervisor_id: user.id,
        qty: jumlah,
      })
      setPilihPart('')
      setQty('')
      return `Stok ${hasil.nama}: ${hasil.stok_sebelum} menjadi ${hasil.stok_sekarang}.`
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">
        Approval ({user.nama})
      </h2>

      {info && (
        <p className="rounded-lg bg-green-100 p-3 text-green-800">{info}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-100 p-3 text-red-700">{error}</p>
      )}

      <div className="rounded-xl bg-white p-6 shadow">
        <h3 className="font-semibold text-slate-800">Tambah Stok</h3>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={pilihPart}
            onChange={(e) => setPilihPart(e.target.value)}
          >
            <option value="">-- pilih part --</option>
            {parts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama} (stok {p.stok} {p.satuan})
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            placeholder="Jumlah"
            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
          />
          <button
            onClick={tambahStok}
            disabled={sibuk}
            className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
          >
            Tambah Stok
          </button>
        </div>
      </div>

      {tiket.length === 0 && !error && (
        <p className="rounded-xl bg-white p-6 text-slate-600 shadow">
          Tidak ada tiket yang menunggu approval.
        </p>
      )}

      {tiket.map((t) => {
        const adaMenunggu = t.parts.some((p) => p.status === 'menunggu_approval')
        return (
          <div key={t.id} className="rounded-xl bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                #{t.id} - {t.mesin}
              </h3>
              <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                {t.status}
              </span>
            </div>
            <p className="mt-2 text-slate-700">{t.keluhan}</p>
            <p className="mt-1 text-sm text-slate-500">
              Dilapor {t.operator} pada {waktu(t.created_at)}
            </p>
            <p className="text-sm text-slate-500">Teknisi: {t.teknisi ?? '-'}</p>

            <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">
              {t.parts.map((p) => {
                const stok = parts.find((x) => x.id === p.part_id)?.stok
                return (
                  <li key={p.id}>
                    {p.part} x {p.qty_dipakai} ({p.status}) | stok saat ini:{' '}
                    {stok ?? '-'}
                    {p.status !== 'dipakai' &&
                      stok !== undefined &&
                      stok < p.qty_dipakai && (
                        <span className="ml-2 font-semibold text-red-600">
                          stok belum cukup
                        </span>
                      )}
                  </li>
                )
              })}
            </ul>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              {adaMenunggu ? (
                <button
                  onClick={() => setujui(t)}
                  disabled={sibuk}
                  className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:bg-slate-400"
                >
                  Setujui
                </button>
              ) : (
                <p className="text-sm text-slate-500">
                  Part sudah disetujui. Menunggu teknisi menekan Lanjut.
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default Approval