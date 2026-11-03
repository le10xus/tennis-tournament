import { http } from './http'
import type { Paginated } from '../types'

export interface TournamentNested {
  id: number
  name: string
  kind: string
  kind_display: string
  format: string
  format_display: string
  status: string
  status_display: string
  start_date: string
  end_date: string | null
  location: string
}

export interface PlayerInReg {
  id: number
  first_name: string
  last_name: string
  gender: 'male' | 'female'
  gender_display: string
  rating: number
  rating_type_display: string
  birth_year: number | null
  birth_date: string | null
  city: string
  points_singles: number
  points_doubles: number
  ntrp_singles: string
  ntrp_doubles: string
  is_ftvo: boolean
}

export interface Registration {
  id: number
  tournament: number
  tournament_detail: TournamentNested
  player: number
  player_detail: PlayerInReg
  status: 'pending' | 'approved'
  status_display: string
  is_current_user: boolean
  registered_at: string
  seed: number | null
  pair_id: number | null
  invited_by: number | null
  invited_by_detail: PlayerInReg | null
}

export const registrationsApi = {
  listForPlayer: (playerId: number) =>
    http.get<Paginated<Registration>>(`/registrations/?player=${playerId}&page_size=200`),

  listForTournament: (tournamentId: number, status?: Registration['status']) => {
    const statusParam = status ? `&status=${status}` : ''
    return http.get<Paginated<Registration>>(
      `/registrations/?tournament=${tournamentId}&page_size=200${statusParam}`,
    )
  },

  add: (tournamentId: number, playerId: number, partnerId?: number) =>
    http.post<Registration>('/registrations/', {
      tournament: tournamentId,
      player: playerId,
      partner: partnerId,
    }),

  apply: (tournamentId: number, partnerId?: number) =>
    http.post<Registration>('/registrations/', {
      tournament: tournamentId,
      partner: partnerId,
    }),

  approve: (registrationId: number) =>
    http.post<Registration>(`/registrations/${registrationId}/approve/`, {}),

  confirm: (registrationId: number) =>
    http.post<Registration>(`/registrations/${registrationId}/confirm/`, {}),

  remove: (registrationId: number) =>
    http.delete(`/registrations/${registrationId}/`),

  updateSeed: (registrationId: number, seed: number | null) =>
    http.patch<Registration>(`/registrations/${registrationId}/`, { seed }),

  update: (registrationId: number, data: Partial<{ seed: number | null; pair_id: number | null }>) =>
    http.patch<Registration>(`/registrations/${registrationId}/`, data),
}
