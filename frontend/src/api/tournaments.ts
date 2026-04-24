import { http } from './http'
import type { Paginated, TournamentBrief } from '../types'

export const tournamentsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return http.get<Paginated<TournamentBrief>>(`/tournaments/${qs}`)
  },
}
