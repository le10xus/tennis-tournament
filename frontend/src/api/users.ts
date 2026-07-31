import { http } from './http'
import type { Paginated, Profile, ProfileFormData, User, UserFormData } from '../types'

export const usersApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return http.get<Paginated<User>>(`/users/${qs}`)
  },

  get: (id: number) =>
    http.get<User>(`/users/${id}/`),

  getMe: () =>
    http.get<Profile>('/users/me/'),

  updateMe: (data: Partial<ProfileFormData>) =>
    http.patch<Profile>('/users/me/', data),

  create: (data: UserFormData) =>
    http.post<User>('/users/', data),

  update: (id: number, data: Partial<UserFormData>) =>
    http.patch<User>(`/users/${id}/`, data),

  delete: (id: number) =>
    http.delete(`/users/${id}/`),
}
