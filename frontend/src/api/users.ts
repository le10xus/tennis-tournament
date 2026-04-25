import { http } from './http'
import type { Paginated, User, UserFormData } from '../types'

export const usersApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return http.get<Paginated<User>>(`/users/${qs}`)
  },

  get: (id: number) =>
    http.get<User>(`/users/${id}/`),

  create: (data: UserFormData) =>
    http.post<User>('/users/', data),

  update: (id: number, data: Partial<UserFormData>) =>
    http.patch<User>(`/users/${id}/`, data),

  delete: (id: number) =>
    http.delete(`/users/${id}/`),
}
