export type Gender = 'male' | 'female'
export type RatingType = 'elo' | 'manual'

export interface Player {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string
  birth_date: string | null
  gender: Gender
  gender_display: string
  rating: number
  rating_type: RatingType
  rating_type_display: string
  created_at: string
}

export interface PlayerFormData {
  first_name: string
  last_name: string
  email: string
  phone: string
  birth_date: string
  gender: Gender
  rating: number
  rating_type: RatingType
}

export type ApiErrors = Partial<Record<keyof PlayerFormData | 'non_field_errors', string[]>>
