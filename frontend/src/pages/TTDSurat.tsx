
import { useCallback, useEffect, useRef, useState } from 'react'
import { ambil, kirim } from '../api'
import type { User } from '../types'

type SlotTTD = 'foreman' | 'spv'

interface TiketTTD {
  id: number
  mesin: string
  line: string | null
  divisi: string
  keluhan: string
  laporan_leader: string | null
  laporan_installer: string | null
  laporan_permasalahan: string | null
  pelapor: string
  created_at: string
  foreman_sudah: boolean
  foreman_oleh: string | null
  foreman_at: string | null
  spv_sudah: boolean
  spv_oleh: string | null
  spv_at: string | null
}

interface Props {
  user: User
}

export default function TTDSurat({ user }: Props) {
  const [tiket, setTiket] = useState<TiketTTD[]>([])
  const [pilihan, setPilihan] = useState<TiketTTD | null>(null)
  const [slot, setSlot] = useState<SlotTTD>(
    user.role === 'spv_divisi' ? 'spv' : 'foreman',
  )
  const [idPenandaTangan, setIdPenandaTangan] = useState('')
  const [loading, setLoading] = useState(true)
  const [menyimpan, setMenyimpan] = useState(false)
  const [error, setError] = useState('')
  const [pesan, setPesan] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const menggambar = useRef(false)
  const adaGambar = useRef(false)

  const modeInstaller = user.role === 'installer_divisi'

  const muatTiket = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await ambil<TiketTTD[]>('/tiket/menunggu-ttd')
      setTiket(data)
      setPilihan((sebelumnya) => {
        if (!sebelumnya) return null
        return data.find((item) => item.id === sebelumnya.id) ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat antrean TTD')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void muatTiket()
  }, [muatTiket])

  function bersihkanCanvas() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    adaGambar.current = false
  }

  function mulaiGambar(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    menggambar.current = true
    canvas.setPointerCapture(e.pointerId)

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#172554'
  }

  function lanjutGambar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!menggambar.current) return
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)

    ctx.lineTo(x, y)
    ctx.stroke()
    adaGambar.current = true
  }

  function selesaiGambar() {
    menggambar.current = false
  }

  async function simpanTTD() {
    if (!pilihan) return
    if (!adaGambar.current) {
      setError('Bubuhkan tanda tangan terlebih dahulu.')
      return
    }

    if (modeInstaller && !idPenandaTangan.trim()) {
      setError('Masukkan ID akun Foreman atau SPV yang menandatangani.')
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return

    setMenyimpan(true)
    setError('')
    setPesan('')

    try {
      const body: {
        sebagai: SlotTTD
        ttd: string
        penanda_tangan_id?: number
      } = {
        sebagai: slot,
        ttd: canvas.toDataURL('image/png'),
      }

      if (modeInstaller) {
        const id = Number(idPenandaTangan)
        if (!Number.isSafeInteger(id) || id <= 0) {
          setError('ID penanda tangan harus berupa angka yang valid.')
          return
        }
        body.penanda_tangan_id = id
      }

      const hasil = await kirim<{
        message: string
        status: string
      }>(`/tiket/${pilihan.id}/ttd`, 'POST', body)

      setPesan(`${hasil.message}. Status tiket: ${hasil.status}.`)
      setPilihan(null)
      setIdPenandaTangan('')
      bersihkanCanvas()
      await muatTiket()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan tanda tangan')
    } finally {
      setMenyimpan(false)
    }
  }

  function tanggal(value: string | null) {
    if (!value) return '-'
    const date = new Date(value)
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleString('id-ID')
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">TTD Surat Kerusakan</h1>
          <p className="mt-1 text-sm text-slate-500">
            Antrean tiket yang memerlukan tanda tangan Foreman dan SPV Divisi.
          </p>
        </div>
        <button
          onClick={() => void muatTiket()}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? 'Memuat...' : 'Muat Ulang'}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {pesan && (
        <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {pesan}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Memuat antrean tanda tangan...</p>
      ) : tiket.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
          <p className="font-semibold text-slate-700">Belum ada tiket menunggu TTD</p>
          <p className="mt-1 text-sm text-slate-500">
            Tiket yang sesuai divisi dan memerlukan tanda tangan akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {tiket.map((item) => (
            <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tiket #{item.id}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-800">{item.mesin}</h2>
                  <p className="text-sm text-slate-500">
                    Divisi {item.divisi}{item.line ? ` • Line ${item.line}` : ''}
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  Menunggu TTD
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm">
                <p><span className="font-semibold">Pelapor:</span> {item.pelapor}</p>
                <p><span className="font-semibold">Tanggal:</span> {tanggal(item.created_at)}</p>
                <p><span className="font-semibold">Keluhan:</span> {item.keluhan}</p>
                {item.laporan_leader && (
                  <p><span className="font-semibold">Laporan Leader:</span> {item.laporan_leader}</p>
                )}
                {item.laporan_installer && (
                  <p><span className="font-semibold">Laporan Installer:</span> {item.laporan_installer}</p>
                )}
                {item.laporan_permasalahan && (
                  <p><span className="font-semibold">Permasalahan:</span> {item.laporan_permasalahan}</p>
                )}
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-semibold">Foreman</p>
                  <p className={item.foreman_sudah ? 'text-green-700' : 'text-amber-700'}>
                    {item.foreman_sudah ? `Sudah: ${item.foreman_oleh}` : 'Belum tanda tangan'}
                  </p>
                  {item.foreman_at && <p className="mt-1 text-xs text-slate-500">{tanggal(item.foreman_at)}</p>}
                </div>
                <div className="rounded-lg bg-slate-50 p-3 text-sm">
                  <p className="font-semibold">SPV Divisi</p>
                  <p className={item.spv_sudah ? 'text-green-700' : 'text-amber-700'}>
                    {item.spv_sudah ? `Sudah: ${item.spv_oleh}` : 'Belum tanda tangan'}
                  </p>
                  {item.spv_at && <p className="mt-1 text-xs text-slate-500">{tanggal(item.spv_at)}</p>}
                </div>
              </div>

              <button
                onClick={() => {
                  setPilihan(item)
                  setSlot(user.role === 'spv_divisi' ? 'spv' : 'foreman')
                  setError('')
                  setPesan('')
                  setIdPenandaTangan('')
                  bersihkanCanvas()
                }}
                className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2.5 font-semibold text-white hover:bg-blue-800"
              >
                {item.foreman_sudah && item.spv_sudah ? 'Lihat Tiket' : 'Buka Form TTD'}
              </button>
            </article>
          ))}
        </div>
      )}

      {pilihan && (
        <section className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Form Tanda Tangan</h2>
              <p className="mt-1 text-sm text-slate-500">
                Tiket #{pilihan.id} • {pilihan.mesin} • Divisi {pilihan.divisi}
              </p>
            </div>
            <button
              onClick={() => setPilihan(null)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            >
              Tutup
            </button>
          </div>

          <div className="mt-5 max-w-2xl space-y-4">
            <div>
              <label htmlFor="slot-ttd" className="mb-1 block text-sm font-semibold text-slate-700">
                Tanda tangan sebagai
              </label>
              <select
                id="slot-ttd"
                value={slot}
                onChange={(e) => setSlot(e.target.value as SlotTTD)}
                disabled={!modeInstaller}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 disabled:bg-slate-100"
              >
                <option value="foreman">Foreman Divisi</option>
                <option value="spv">SPV Divisi</option>
              </select>
              {!modeInstaller && (
                <p className="mt-1 text-xs text-slate-500">
                  Pilihan tanda tangan mengikuti role akun yang sedang login.
                </p>
              )}
            </div>

            {modeInstaller && (
              <div>
                <label htmlFor="id-penanda" className="mb-1 block text-sm font-semibold text-slate-700">
                  ID akun penanda tangan
                </label>
                <input
                  id="id-penanda"
                  type="number"
                  min="1"
                  value={idPenandaTangan}
                  onChange={(e) => setIdPenandaTangan(e.target.value)}
                  placeholder="Masukkan ID akun Foreman/SPV"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Gunakan ID akun yang valid dan sesuai divisi. Backend akan memvalidasi role serta divisinya.
                </p>
              </div>
            )}

            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Area tanda tangan</p>
              <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
                <canvas
                  ref={canvasRef}
                  width={700}
                  height={200}
                  aria-label="Area untuk menggambar tanda tangan"
                  onPointerDown={mulaiGambar}
                  onPointerMove={lanjutGambar}
                  onPointerUp={selesaiGambar}
                  onPointerCancel={selesaiGambar}
                  onPointerLeave={selesaiGambar}
                  className="block h-44 w-full touch-none"
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Tanda tangani menggunakan mouse atau layar sentuh. Pastikan tanda tangan terlihat jelas.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={bersihkanCanvas}
                disabled={menyimpan}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
              >
                Hapus TTD
              </button>
              <button
                onClick={() => void simpanTTD()}
                disabled={menyimpan || (slot === 'foreman' ? pilihan.foreman_sudah : pilihan.spv_sudah)}
                className="rounded-lg bg-green-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {menyimpan ? 'Menyimpan...' : 'Simpan Tanda Tangan'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
