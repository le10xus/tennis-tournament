import { http } from './http'
import type { Paginated, Tournament, TournamentBrief, TournamentFormData } from '../types'

export const tournamentsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return http.get<Paginated<Tournament>>(`/tournaments/${qs}`)
  },

  get: (id: number) =>
    http.get<Tournament>(`/tournaments/${id}/`),

  create: (data: TournamentFormData) =>
    http.post<Tournament>('/tournaments/', data),

  update: (id: number, data: Partial<TournamentFormData>) =>
    http.patch<Tournament>(`/tournaments/${id}/`, data),

  delete: (id: number) =>
    http.delete(`/tournaments/${id}/`),
}

// Re-export TournamentBrief usage for backward compatibility
export type { TournamentBrief }
