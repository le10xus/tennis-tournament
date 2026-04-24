export type { Player, PlayerFormData, ApiErrors, Gender, RatingType } from './player'
export type { Match, MatchFormData, MatchApiErrors, MatchStatus, GenderType, PlayerBrief } from './match'
export type { TournamentBrief } from './tournament'

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
