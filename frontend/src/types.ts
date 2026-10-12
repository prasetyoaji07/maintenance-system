export type Role = 'operator' | 'teknisi' | 'supervisor' | 'leader_divisi' | 'installer_divisi' | 'foreman_divisi' | 'spv_divisi' | 'mekanik_mtnc' | 'spv_mtnc' 

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
  part_number: string
  nama: string
  kategori: string
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
  jenis_tiket: 'kerusakan' | 'pm'
  pm_jadwal_id: number | null
  jatuh_tempo: string | null
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

export interface PartRiwayat {
  part: string
  qty_dipakai: number
  satuan: string
}

export interface TiketRiwayat {
  id: number
  keluhan: string
  status: StatusTiket
  jenis_tiket: 'kerusakan' | 'pm'
  operator: string
  teknisi: string | null
  created_at: string
  diproses_at: string | null
  selesai_at: string | null
  downtime_menit: number | null
  parts: PartRiwayat[]
}

export interface RiwayatMesin {
  mesin: Mesin
  tiket: TiketRiwayat[]
}

export interface JadwalPM {
  id: number
  mesin_id: number
  mesin_nama: string
  nama_tugas: string
  interval_hari: number
  jatuh_tempo_berikutnya: string
  aktif: boolean
  terlambat: boolean
  dibuat_oleh_nama: string
}