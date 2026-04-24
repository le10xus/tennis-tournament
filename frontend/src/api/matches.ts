import { http } from './http'
import type { Match, MatchFormData, Paginated } from '../types'

export const matchesApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return http.get<Paginated<Match>>(`/matches/${qs}`)
  },
  get: (id: number) => http.get<Match>(`/matches/${id}/`),
  create: (data: MatchFormData) => http.post<Match>('/matches/', data),
  update: (id: number, data: Partial<MatchFormData>) => http.patch<Match>(`/matches/${id}/`, data),
  delete: (id: number) => http.delete(`/matches/${id}/`),
}
