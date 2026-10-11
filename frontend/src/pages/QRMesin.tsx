import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ambil } from '../api'
import type { Mesin } from '../types'

function QRMesin() {
  const [mesin, setMesin] = useState<Mesin[]>([])
  const [alamat, setAlamat] = useState(window.location.origin)
  const [error, setError] = useState('')

  useEffect(() => {
    ambil<Mesin[]>('/mesin')
      .then(setMesin)
      .catch((e: Error) => setError(e.message))
  }, [])

  const dasar = alamat.trim().replace(/\/+$/, '')
  const pakaiLocalhost = /localhost|127\.0\.0\.1/.test(dasar)

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-6 shadow print:hidden">
        <h2 className="text-lg font-semibold text-slate-800">QR Mesin</h2>
        <p className="mt-1 text-sm text-slate-500">
          Cetak dan tempel QR di tiap mesin. Operator memindai QR, masuk, lalu
          form Lapor Kerusakan terbuka dengan mesin sudah terisi.
        </p>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Alamat aplikasi (yang dibuka HP saat QR dipindai)
          <input
            className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2"
            value={alamat}
            onChange={(e) => setAlamat(e.target.value)}
          />
        </label>

        {pakaiLocalhost && (
          <p className="mt-3 rounded-lg bg-amber-100 p-3 text-sm text-amber-800">
            sistem masih dalam jangkauan localhost
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <button
          onClick={() => window.print()}
          className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
        >
          Cetak
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 print:grid-cols-3">
        {mesin.map((m) => (
          <div
            key={m.id}
            className="break-inside-avoid rounded-xl bg-white p-4 text-center shadow print:border print:border-slate-300 print:shadow-none"
          >
            <div className="inline-block rounded-lg bg-white p-2">
              <QRCodeSVG value={`${dasar}/?mesin=${m.id}`} size={150} level="M" />
            </div>
            <p className="mt-2 font-semibold text-slate-800">{m.nama}</p>
            <p className="text-sm text-slate-500">{m.lokasi}</p>
            <p className="mt-1 break-all text-xs text-slate-400 print:hidden">
              {`${dasar}/?mesin=${m.id}`}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default QRMesin