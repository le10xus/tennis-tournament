import type { MatchStatus, PlayerBrief } from '../../types'

export function playerName(p: PlayerBrief | null | undefined): string {
  if (!p) return '—'
  return `${p.last_name}`
}

export function statusBadge(status: MatchStatus): string {
  switch (status) {
    case 'finished':   return 'badge--green'
    case 'in_progress': return 'badge--blue'
    case 'walkover':   return 'badge--yellow'
    default:           return 'badge--gray'
  }
}
