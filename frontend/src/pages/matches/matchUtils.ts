import type { PlayerBrief } from '../../types'

export function playerName(p: PlayerBrief | null | undefined): string {
  if (!p) return '—'
  return `${p.last_name}`
}
