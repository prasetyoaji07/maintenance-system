import { useCallback, useEffect, useState } from 'react'
import { ambil, kirim } from '../api'
import PartPicker from '../components/PartPicker'
import type { SparePart, Tiket, TiketDetail, User } from '../types'

interface Props {
  user: User
}

interface RiwayatStok {
  id: number
  qty_tambah: number
  stok_sebelum: number
  stok_sesudah: number
  created_at: string
  supervisor_nama: string
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

  const [riwayatPart, setRiwayatPart] = useState('')
  const [riwayat, setRiwayat] = useState<RiwayatStok[]>([])
  const [riwayatError, setRiwayatError] = useState('')
  const [versi, setVersi] = useState(0)

  // Kalau belum memilih, tampilkan riwayat part pertama
  const idRiwayat = riwayatPart || (parts[0] ? String(parts[0].id) : '')
  const partRiwayat = parts.find((p) => String(p.id) === idRiwayat)

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

  useEffect(() => {
    if (!idRiwayat) return
    let batal = false
    async function muatRiwayat() {
      try {
        const data = await ambil<RiwayatStok[]>(
          `/spare-parts/${idRiwayat}/riwayat`
        )
        if (!batal) {
          setRiwayat(data)
          setRiwayatError('')
        }
      } catch (e) {
        if (!batal) {
          setRiwayatError(
            e instanceof Error ? e.message : 'Gagal memuat riwayat stok'
          )
        }
      }
    }
    void muatRiwayat()
    return () => {
      batal = true
    }
  }, [idRiwayat, versi])

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
      setVersi((v) => v + 1)
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
        <div className="mt-3 flex flex-wrap items-start gap-3">
          <PartPicker
            key={`stok-${versi}`}
            parts={parts}
            onChange={(id) => setPilihPart(id ? String(id) : '')}
            wrapperClassName="w-96 max-w-full"
          />
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

      <div className="rounded-xl bg-white p-6 shadow">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h3 className="font-semibold text-slate-800">
            Riwayat Penambahan Stok
          </h3>
          <PartPicker
            key="riwayat"
            parts={parts}
            onChange={(id) => {
              if (id !== null) setRiwayatPart(String(id))
            }}
            placeholder="Ketik untuk mencari part..."
            wrapperClassName="w-96 max-w-full"
          />
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Menampilkan:{' '}
          {partRiwayat
            ? `${partRiwayat.part_number} — ${partRiwayat.nama}`
            : '-'}
        </p>

        {riwayatError && (
          <p className="mt-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">
            {riwayatError}
          </p>
        )}

        {!riwayatError && riwayat.length === 0 && (
          <p className="mt-3 text-sm text-slate-600">
            Belum ada penambahan stok untuk part ini.
          </p>
        )}

        {riwayat.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-4 font-medium">Waktu</th>
                  <th className="py-2 pr-4 font-medium">Supervisor</th>
                  <th className="py-2 pr-4 font-medium">Tambah</th>
                  <th className="py-2 font-medium">Stok</th>
                </tr>
              </thead>
              <tbody>
                {riwayat.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4">{waktu(r.created_at)}</td>
                    <td className="py-2 pr-4">{r.supervisor_nama}</td>
                    <td className="py-2 pr-4 font-semibold text-green-700">
                      +{r.qty_tambah}
                    </td>
                    <td className="py-2">
                      {r.stok_sebelum} menjadi {r.stok_sesudah}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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