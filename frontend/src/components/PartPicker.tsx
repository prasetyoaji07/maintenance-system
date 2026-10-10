import { useId, useState } from 'react'
import type { SparePart } from '../types'

const PEMISAH = ' — '

// Teks di daftar: "BRG-6205-01 — Bearing 6205 (stok 22 pcs)"
function labelPart(p: SparePart): string {
  return `${p.part_number}${PEMISAH}${p.nama} (stok ${p.stok} ${p.satuan})`
}

// Cocokkan ketikan dengan part lewat nomor part (bagian sebelum tanda "—").
// Dengan begitu pilihan tetap valid walau stok berubah setelah dipilih.
function cariPart(parts: SparePart[], teks: string): SparePart | null {
  const kode = teks.split(PEMISAH)[0].trim().toLowerCase()
  if (kode === '') return null
  return parts.find((p) => p.part_number.toLowerCase() === kode) ?? null
}

interface Props {
  parts: SparePart[]
  onChange: (id: number | null) => void
  placeholder?: string
  className?: string
  wrapperClassName?: string
}

// Untuk mengosongkan isian dari luar, ganti prop key pada komponen ini.
function PartPicker({
  parts,
  onChange,
  placeholder,
  className,
  wrapperClassName,
}: Props) {
  const listId = useId()
  const [teks, setTeks] = useState('')
  const terpilih = cariPart(parts, teks)

  return (
    <div className={wrapperClassName ?? 'w-full'}>
      <input
        list={listId}
        value={teks}
        onChange={(e) => {
          setTeks(e.target.value)
          onChange(cariPart(parts, e.target.value)?.id ?? null)
        }}
        placeholder={placeholder ?? 'Ketik nomor part atau nama...'}
        className={
          className ??
          'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm'
        }
      />
      <datalist id={listId}>
        {parts.map((p) => (
          <option key={p.id} value={labelPart(p)}>
            {p.kategori}
          </option>
        ))}
      </datalist>
      {teks.trim() !== '' && !terpilih && (
        <p className="mt-1 text-xs text-orange-600">
          Pilih salah satu part dari daftar yang muncul.
        </p>
      )}
      {terpilih && (
        <p className="mt-1 text-xs text-slate-500">
          Kategori: {terpilih.kategori}
        </p>
      )}
    </div>
  )
}

export default PartPicker