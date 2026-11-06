import type { PlayerBrief } from './match'

export interface TournamentPhoto {
  id: number
  image: string
  caption: string
  order: number
}

export interface TournamentPointsAward {
  id: number
  player: number
  player_detail: PlayerBrief
  place: string
  points: number
}

export interface TournamentVideo {
  id: number
  title: string
  url: string
  embed_url: string
  order: number
}

export interface TournamentResult {
  id: number
  place: number
  name: string
  player: number | null
  player_detail: PlayerBrief | null
}

export interface Tournament {
  id: number
  name: string
  kind: string
  kind_display: string
  gender_type: string
  gender_type_display: string
  format: string
  format_display: string
  status: string
  status_display: string
  start_date: string
  end_date: string | null
  location: string
  description: string
  max_players: number
  courts: number
  match_duration_minutes: number
  saturday_start_time: string
  sunday_start_time: string
  set_games: number
  third_set_super_tiebreak: boolean
  regulation: string | null
  regulation_url: string
  summary_text: string
  photos: TournamentPhoto[]
  videos: TournamentVideo[]
  results: TournamentResult[]
  source_url: string
  points_category: string
  points_category_display: string
  points_table: Record<string, number>
  points_awarded_at: string | null
  points_awards: TournamentPointsAward[]
  age_min: number | null
  pair_age_sum_min: number | null
  min_rating: number | null
  max_rating: number | null
  players_count: number
  created_at: string
}

export type TournamentListItem = Omit<
  Tournament,
  | 'summary_text'
  | 'regulation'
  | 'regulation_url'
  | 'source_url'
  | 'results'
  | 'videos'
  | 'photos'
  | 'points_awarded_at'
  | 'points_awards'
>

export interface TournamentBrief {
  id: number
  name: string
  kind: string
  status: string
  status_display: string
  gender_type: string
  gender_type_display: string
}

export interface TournamentFormData {
  name: string
  kind: string
  gender_type: string
  format: string
  status: string
  start_date: string
  end_date: string
  location: string
  description: string
  max_players: number
  courts: number
  match_duration_minutes: number
  saturday_start_time: string
  sunday_start_time: string
  set_games: number
  third_set_super_tiebreak: boolean
  summary_text?: string
  source_url?: string
  regulation_url?: string
  points_category?: string
  points_table?: Record<string, number> | null
  age_min: number | null
  pair_age_sum_min: number | null
  min_rating: number | null
  max_rating: number | null
}

export type TournamentApiErrors = Partial<
  Record<keyof TournamentFormData | 'non_field_errors', string[]>
>
