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