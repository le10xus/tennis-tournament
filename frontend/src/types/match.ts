export type MatchStatus = 'scheduled' | 'in_progress' | 'finished' | 'walkover'
export type GenderType = 'male' | 'female' | 'mixed'

export interface PlayerBrief {
  id: number
  first_name: string
  last_name: string
  rating: number
}

export interface Match {
  id: number
  tournament: number
  tournament_name: string
  gender_type: GenderType
  gender_type_display: string
  player1: number
  player1_detail: PlayerBrief
  pair1_player2: number | null
  pair1_player2_detail: PlayerBrief | null
  player2: number
  player2_detail: PlayerBrief
  pair2_player2: number | null
  pair2_player2_detail: PlayerBrief | null
  winner: number | null
  winner_detail: PlayerBrief | null
  status: MatchStatus
  status_display: string
  round_number: number
  scheduled_at: string | null
  score: string
}

export interface MatchFormData {
  tournament: number | ''
  gender_type: GenderType
  player1: number | ''
  pair1_player2: number | ''
  player2: number | ''
  pair2_player2: number | ''
  winner: number | null
  status: MatchStatus
  round_number: number
  scheduled_at: string
  score: string
}

export type MatchApiErrors = Partial<Record<keyof MatchFormData | 'non_field_errors', string[]>>
