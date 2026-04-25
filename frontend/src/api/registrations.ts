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

export interface Registration {
  id: number
  tournament: number
  tournament_detail: TournamentNested
  player: number
  registered_at: string
  seed: number | null
}

export const registrationsApi = {
  listForPlayer: (playerId: number) =>
    http.get<Paginated<Registration>>(`/registrations/?player=${playerId}&page_size=200`),
}
