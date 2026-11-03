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
  kind: 'singles' | 'doubles'
  kind_display: string
  gender_type: GenderType
  gender_type_display: string
  player1: number | null
  player1_detail: PlayerBrief | null
  pair1_player2: number | null
  pair1_player2_detail: PlayerBrief | null
  player2: number | null
  player2_detail: PlayerBrief | null
  pair2_player2: number | null
  pair2_player2_detail: PlayerBrief | null
  winner: number | null
  winner_detail: PlayerBrief | null
  status: MatchStatus
  status_display: string
  bracket: 'winners' | 'consolation' | 'third_place'
  bracket_display: string
  group: '' | '5-8' | '9-16'
  next_match: number | null
  next_slot: number | null
  loser_next_match: number | null
  loser_next_slot: number | null
  round_number: number
  slot_index: number
  court: number | null
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
  slot_index?: number
  court?: number | null
  scheduled_at: string | null
  score: string
}

export type MatchApiErrors = Partial<Record<keyof MatchFormData | 'non_field_errors', string[]>>
