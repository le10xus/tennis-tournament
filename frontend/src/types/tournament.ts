export interface Tournament {
  id: number
  name: string
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
  players_count: number
  created_at: string
}

export interface TournamentBrief {
  id: number
  name: string
  status: string
  status_display: string
  gender_type: string
  gender_type_display: string
}

export interface TournamentFormData {
  name: string
  gender_type: string
  format: string
  status: string
  start_date: string
  end_date: string
  location: string
  description: string
  max_players: number
}

export type TournamentApiErrors = Partial<
  Record<keyof TournamentFormData | 'non_field_errors', string[]>
>
