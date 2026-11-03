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
  min_rating: number | null
  max_rating: number | null
  players_count: number
  created_at: string
}

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
  min_rating: number | null
  max_rating: number | null
}

export type TournamentApiErrors = Partial<
  Record<keyof TournamentFormData | 'non_field_errors', string[]>
>
