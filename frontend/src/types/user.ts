export type UserRole = 'player' | 'organizer'

export interface User {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  role: UserRole
  role_display: string
  is_staff: boolean
  is_active: boolean
  date_joined: string
}

export interface UserFormData {
  username: string
  password: string
  email: string
  first_name: string
  last_name: string
  role: UserRole
  is_staff: boolean
  is_active: boolean
}

export type UserApiErrors = Partial<Record<keyof UserFormData | 'non_field_errors', string[]>>
