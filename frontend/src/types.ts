export type Role = 'operator' | 'teknisi' | 'supervisor'

export interface User {
  id: number
  nama: string
  role: Role
}

export interface Mesin {
  id: number
  nama: string
  lokasi: string
  status: 'jalan' | 'rusak' | 'maintenance'
}

export interface SparePart {
  id: number
  nama: string
  stok: number
  satuan: string
  minimum_stok: number
}

export type StatusTiket =
  | 'pending'
  | 'diproses'
  | 'menunggu_approval'
  | 'selesai'

export interface Tiket {
  id: number
  mesin_id: number
  mesin: string
  keluhan: string
  status: StatusTiket
  operator: string
  teknisi_id: number | null
  teknisi: string | null
  created_at: string
  diproses_at: string | null
  selesai_at: string | null
}

export interface PartTiket {
  id: number
  part_id: number
  part: string
  qty_dipakai: number
  status: 'menunggu_approval' | 'disetujui' | 'dipakai'
}

export interface TiketDetail extends Tiket {
  parts: PartTiket[]
}