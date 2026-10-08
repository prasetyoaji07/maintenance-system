export type Role = 'operator' | 'teknisi' | 'supervisor'

export interface User {
  id: number
  nama: string
  role: Role
}