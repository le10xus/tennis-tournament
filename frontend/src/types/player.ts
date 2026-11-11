export type Gender = 'male' | 'female'
export type RatingType = 'elo' | 'manual'

export interface Player {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string
  birth_date: string | null
  birth_year: number | null
  city: string
  gender: Gender
  gender_display: string
  rating: number
  rating_type: RatingType
  rating_type_display: string
  ntrp_singles: string
  ntrp_doubles: string
  points_singles: number
  points_doubles: number
  is_ftvo: boolean
  created_at: string
  wins?: number
  losses?: number
  prize_places?: { '1': number; '2': number; '3': number }
}

export interface PlayerFormData {
  first_name: string
  last_name: string
  email: string
  phone: string
  birth_date: string | null
  gender: Gender
  rating: number
  rating_type: RatingType
  city: string
  ntrp_singles: string
  ntrp_doubles: string
  points_singles: number
  points_doubles: number
  is_ftvo?: boolean
}

export type ApiErrors = Partial<Record<keyof PlayerFormData | 'non_field_errors', string[]>>
