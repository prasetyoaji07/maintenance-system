import { useCallback, useEffect, useState } from 'react'
import { ambil, kirim } from '../api'
import type { SparePart, StatusTiket, Tiket, TiketDetail, User } from '../types'

interface Props {
  user: User
}

const WARNA: Record<StatusTiket, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  diproses: 'bg-blue-100 text-blue-800',
  menunggu_approval: 'bg-orange-100 text-orange-800',
  selesai: 'bg-green-100 text-green-800',
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

function TiketSaya({ user }: Props) {
  const [tiket, setTiket] = useState<TiketDetail[]>([])
  const [parts, setParts] = useState<SparePart[]>([])
  const [pilihPart, setPilihPart] = useState<Record<number, string>>({})
  const [qty, setQty] = useState<Record<number, string>>({})
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [sibuk, setSibuk] = useState(false)

  const muat = useCallback(async () => {
    try {
      const [daftar, sp] = await Promise.all([
        ambil<Tiket[]>('/tiket?status=aktif'),
        ambil<SparePart[]>('/spare-parts'),
      ])
      const relevan = daftar.filter(
        (t) => t.status === 'pending' || t.teknisi_id === user.id
      )
      const detail = await Promise.all(
        relevan.map((t) =>
          t.status === 'pending'
            ? Promise.resolve({ ...t, parts: [] } as TiketDetail)
            : ambil<TiketDetail>(`/tiket/${t.id}`)
        )
      )
      setTiket(detail)
      setParts(sp)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat tiket')
    }
  }, [user.id])

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

  function terima(t: TiketDetail) {
    void jalankan(async () => {
      await kirim(`/tiket/${t.id}/terima`, 'PATCH', { teknisi_id: user.id })
      return `Tiket #${t.id} diterima.`
    })
  }

  function pakaiPart(t: TiketDetail) {
    const partId = Number(pilihPart[t.id])
    const jumlah = Number(qty[t.id])
    if (!partId || !Number.isInteger(jumlah) || jumlah < 1) {
      setInfo('')
      setError('Pilih part dan isi jumlah (angka bulat, minimal 1).')
      return
    }
    void jalankan(async () => {
      const hasil = await kirim<{
        status_part: string
        stok_sisa?: number
        stok_tersedia?: number
      }>(`/tiket/${t.id}/part`, 'POST', {
        teknisi_id: user.id,
        part_id: partId,
        qty: jumlah,
      })
      setPilihPart((s) => ({ ...s, [t.id]: '' }))
      setQty((s) => ({ ...s, [t.id]: '' }))
      return hasil.status_part === 'dipakai'
        ? `Part dipakai. Stok sisa: ${hasil.stok_sisa}.`
        : `Stok kurang (tersedia ${hasil.stok_tersedia}). Menunggu approval supervisor.`
    })
  }

  function lanjut(t: TiketDetail) {
    void jalankan(async () => {
      await kirim(`/tiket/${t.id}/lanjut`, 'PATCH', { teknisi_id: user.id })
      return `Tiket #${t.id} dilanjutkan.`
    })
  }

  function selesai(t: TiketDetail) {
    void jalankan(async () => {
      await kirim(`/tiket/${t.id}/selesai`, 'PATCH', { teknisi_id: user.id })
      return `Tiket #${t.id} selesai.`
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">
        Tiket Saya ({user.nama})
      </h2>

      {info && (
        <p className="rounded-lg bg-green-100 p-3 text-green-800">{info}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-100 p-3 text-red-700">{error}</p>
      )}

      {tiket.length === 0 && !error && (
        <p className="rounded-xl bg-white p-6 text-slate-600 shadow">
          Tidak ada tiket untuk Anda saat ini.
        </p>
      )}

      {tiket.map((t) => {
        const milik = t.teknisi_id === user.id
        return (
          <div key={t.id} className="rounded-xl bg-white p-6 shadow">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                #{t.id} - {t.mesin}
              </h3>
              <span
                className={
                  'rounded-full px-3 py-1 text-xs font-semibold ' +
                  WARNA[t.status]
                }
              >
                {t.status}
              </span>
            </div>
            <p className="mt-2 text-slate-700">{t.keluhan}</p>
            <p className="mt-1 text-sm text-slate-500">
              Dilapor {t.operator} pada {waktu(t.created_at)}
            </p>
            <p className="text-sm text-slate-500">
              Teknisi: {t.teknisi ?? '-'} | Mulai diproses:{' '}
              {waktu(t.diproses_at)}
            </p>

            {t.parts.length > 0 && (
              <ul className="mt-3 list-disc pl-5 text-sm text-slate-700">
                {t.parts.map((p) => (
                  <li key={p.id}>
                    {p.part} x {p.qty_dipakai} ({p.status})
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap items-end gap-3">
              {t.status === 'pending' && (
                <button
                  onClick={() => terima(t)}
                  disabled={sibuk}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400"
                >
                  Terima Tiket
                </button>
              )}

              {t.status === 'diproses' && milik && (
                <>
                  <select
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    value={pilihPart[t.id] ?? ''}
                    onChange={(e) =>
                      setPilihPart((s) => ({ ...s, [t.id]: e.target.value }))
                    }
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
                    value={qty[t.id] ?? ''}
                    onChange={(e) =>
                      setQty((s) => ({ ...s, [t.id]: e.target.value }))
                    }
                  />
                  <button
                    onClick={() => pakaiPart(t)}
                    disabled={sibuk}
                    className="rounded-lg bg-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-800 disabled:bg-slate-400"
                  >
                    Pakai Part
                  </button>
                  <button
                    onClick={() => selesai(t)}
                    disabled={sibuk}
                    className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:bg-slate-400"
                  >
                    Selesai
                  </button>
                </>
              )}

              {t.status === 'menunggu_approval' && milik && (
                <>
                  <button
                    onClick={() => lanjut(t)}
                    disabled={sibuk}
                    className="rounded-lg bg-orange-600 px-4 py-2 font-semibold text-white hover:bg-orange-700 disabled:bg-slate-400"
                  >
                    Lanjut
                  </button>
                  <p className="text-sm text-slate-500">
                    Menunggu supervisor menyetujui part dan stok ditambah.
                  </p>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default TiketSaya