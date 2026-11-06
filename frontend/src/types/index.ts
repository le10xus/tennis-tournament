export type { Player, PlayerFormData, ApiErrors, Gender, RatingType } from './player'
export type { Match, MatchFormData, MatchApiErrors, MatchStatus, GenderType, PlayerBrief } from './match'
export type { Tournament, TournamentListItem, TournamentBrief, TournamentFormData, TournamentApiErrors, TournamentPhoto, TournamentPointsAward, TournamentResult, TournamentVideo } from './tournament'
export type { User, UserFormData, UserApiErrors, UserRole, Profile, ProfileFormData, ProfileApiErrors } from './user'

export interface Paginated<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}
