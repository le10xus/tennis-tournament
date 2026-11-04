import { http } from './http'
import type { Match, Paginated, Tournament, TournamentBrief, TournamentFormData, TournamentListItem, TournamentPhoto, TournamentPointsAward } from '../types'

export interface ScheduleResult {
  message: string
  day: string
  scheduled_count: number
  remaining: number
  cleared: number
  matches: Match[]
}

export interface ScheduleTemplateMatch {
  id: number
  time: string
  court: number
  round_number: number
  bracket: string
  group: string
  player1: string
  pair1_player2: string
  player2: string
  pair2_player2: string
}

export interface ScheduleTemplateDay {
  date: string
  start: string
  capacity: number
  matches: ScheduleTemplateMatch[]
}

export interface ScheduleTemplate {
  target_date: string
  days: ScheduleTemplateDay[]
}

export const tournamentsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return http.get<Paginated<TournamentListItem>>(`/tournaments/${qs}`)
  },

  get: (id: number) =>
    http.get<Tournament>(`/tournaments/${id}/`),

  create: (data: TournamentFormData) =>
    http.post<Tournament>('/tournaments/', data),

  update: (id: number, data: Partial<TournamentFormData>) =>
    http.patch<Tournament>(`/tournaments/${id}/`, data),

  delete: (id: number) =>
    http.delete(`/tournaments/${id}/`),

  generateBracket: (id: number, options?: { only_seeded?: boolean }) =>
    http.post<Match[]>(`/tournaments/${id}/generate_bracket/`, options ?? {}),

  generateSchedule: (id: number, options?: { reset?: boolean }) =>
    http.post<ScheduleResult>(
      `/tournaments/${id}/generate_schedule/`,
      options ?? {},
    ),

  scheduleTemplate: (id: number, days = 3) =>
    http.get<ScheduleTemplate>(`/tournaments/${id}/schedule_template/?days=${days}`),

  uploadPhoto: (id: number, file: File, caption = '') => {
    const form = new FormData()
    form.append('image', file)
    if (caption) form.append('caption', caption)
    return http.postForm<TournamentPhoto>(`/tournaments/${id}/photos/`, form)
  },

  deletePhoto: (id: number, photoId: number) =>
    http.delete(`/tournaments/${id}/photos/${photoId}/`),

  uploadRegulation: (id: number, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return http.postForm<Tournament>(`/tournaments/${id}/regulation/`, form)
  },

  awardPoints: (id: number) =>
    http.post<{ awards: TournamentPointsAward[]; points_category: string; points_category_display: string }>(
      `/tournaments/${id}/award_points/`,
      {},
    ),
}

// Re-export TournamentBrief usage for backward compatibility
export type { TournamentBrief }
