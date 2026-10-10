import { useCallback, useEffect, useRef, useState } from 'react'
import { ambil, kirim } from '../api'
import PartPicker from '../components/PartPicker'
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

const INTERVAL_MS = 8000

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

// Beep 3x lewat Web Audio API (tanpa file suara).
function bunyi(ctx: AudioContext | null) {
  if (!ctx) return
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 880
    gain.gain.value = 0.15
    osc.connect(gain)
    gain.connect(ctx.destination)
    const mulai = ctx.currentTime + i * 0.6
    osc.start(mulai)
    osc.stop(mulai + 0.4)
  }
}

function TiketSaya({ user }: Props) {
  const [tiket, setTiket] = useState<TiketDetail[]>([])
  const [parts, setParts] = useState<SparePart[]>([])
  const [pilihPart, setPilihPart] = useState<Record<number, string>>({})
  const [qty, setQty] = useState<Record<number, string>>({})
  const [resetPart, setResetPart] = useState(0)
  const [info, setInfo] = useState('')
  const [error, setError] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [aktif, setAktif] = useState(false)
  const [bannerBaru, setBannerBaru] = useState('')

  const audioRef = useRef<AudioContext | null>(null)
  const dikenal = useRef<Set<number> | null>(null)

  const muat = useCallback(
    async (diam = false) => {
      try {
        const [daftar, sp] = await Promise.all([
          ambil<Tiket[]>('/tiket?status=aktif'),
          ambil<SparePart[]>('/spare-parts'),
        ])

        // Deteksi tiket pending yang baru muncul
        const pending = daftar.filter((t) => t.status === 'pending')
        if (dikenal.current === null) {
          dikenal.current = new Set(pending.map((t) => t.id))
        } else {
          const baru = pending.filter((t) => !dikenal.current!.has(t.id))
          if (baru.length > 0) {
            const teks = baru
              .map((t) => `#${t.id} ${t.mesin}: ${t.keluhan}`)
              .join(' | ')
            setBannerBaru(`Tiket baru: ${teks}`)
            bunyi(audioRef.current)
            if (
              typeof Notification !== 'undefined' &&
              Notification.permission === 'granted'
            ) {
              new Notification('Tiket kerusakan baru', { body: teks })
            }
          }
          dikenal.current = new Set(pending.map((t) => t.id))
        }

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
        if (!diam) {
          setError(e instanceof Error ? e.message : 'Gagal memuat tiket')
        }
      }
    },
    [user.id]
  )

  useEffect(() => {
    void muat()
    const timer = setInterval(() => void muat(true), INTERVAL_MS)
    return () => clearInterval(timer)
  }, [muat])

  async function aktifkanNotifikasi() {
    const Ctx = window.AudioContext
    const ctx = new Ctx()
    await ctx.resume()
    audioRef.current = ctx
    bunyi(ctx) // beep uji sekaligus membuka izin audio
    if (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'default'
    ) {
      await Notification.requestPermission()
    }
    setAktif(true)
  }

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
      setBannerBaru('')
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
      setResetPart((v) => v + 1)
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-800">
          Tiket Saya ({user.nama})
        </h2>
        {aktif ? (
          <span className="rounded-lg bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-800">
            Notifikasi aktif (cek tiap {INTERVAL_MS / 1000} detik)
          </span>
        ) : (
          <button
            onClick={() => void aktifkanNotifikasi()}
            className="rounded-lg bg-yellow-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-yellow-600"
          >
            Aktifkan Notifikasi
          </button>
        )}
      </div>

      {bannerBaru && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-yellow-100 p-3 text-yellow-900">
          <p className="font-semibold">{bannerBaru}</p>
          <button
            onClick={() => setBannerBaru('')}
            className="text-sm font-semibold underline"
          >
            Tutup
          </button>
        </div>
      )}

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

            <div className="mt-4 flex flex-wrap items-start gap-3">
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
                  <PartPicker
                    key={`part-${t.id}-${resetPart}`}
                    parts={parts}
                    onChange={(id) =>
                      setPilihPart((s) => ({
                        ...s,
                        [t.id]: id ? String(id) : '',
                      }))
                    }
                    wrapperClassName="w-96 max-w-full"
                  />
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