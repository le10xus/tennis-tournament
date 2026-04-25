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
  gender_display: string
  rating: number
  rating_type_display: string
}

export interface Registration {
  id: number
  tournament: number
  tournament_detail: TournamentNested
  player: number
  player_detail: PlayerInReg
  registered_at: string
  seed: number | null
}

export const registrationsApi = {
  listForPlayer: (playerId: number) =>
    http.get<Paginated<Registration>>(`/registrations/?player=${playerId}&page_size=200`),

  listForTournament: (tournamentId: number) =>
    http.get<Paginated<Registration>>(`/registrations/?tournament=${tournamentId}&page_size=200`),

  add: (tournamentId: number, playerId: number) =>
    http.post<Registration>('/registrations/', { tournament: tournamentId, player: playerId }),

  remove: (registrationId: number) =>
    http.delete(`/registrations/${registrationId}/`),

  updateSeed: (registrationId: number, seed: number | null) =>
    http.patch<Registration>(`/registrations/${registrationId}/`, { seed }),
}
