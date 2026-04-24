import { http } from './http'
import type { Paginated, Player, PlayerFormData } from '../types'

export const playersApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return http.get<Paginated<Player>>(`/players/${qs}`)
  },
  get: (id: number) => http.get<Player>(`/players/${id}/`),
  create: (data: PlayerFormData) => http.post<Player>('/players/', data),
  update: (id: number, data: Partial<PlayerFormData>) => http.patch<Player>(`/players/${id}/`, data),
  delete: (id: number) => http.delete(`/players/${id}/`),
}
