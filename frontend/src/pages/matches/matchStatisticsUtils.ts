import type { MatchStatistics, MatchSideStatKey, MatchSideStats } from '../../types'

export function emptyMatchStatistics(): MatchStatistics {
  return { home: {}, away: {} }
}

function sideHasValue(side: MatchSideStats | undefined): boolean {
  if (!side) return false
  for (const [key, val] of Object.entries(side)) {
    if (key === 'players') {
      if (val && typeof val === 'object' && Object.keys(val).length > 0) return true
      continue
    }
    if (val !== null && val !== undefined) return true
  }
  return false
}

export function hasMatchStatistics(stats: MatchStatistics | null | undefined): boolean {
  if (!stats) return false
  return sideHasValue(stats.home) || sideHasValue(stats.away)
}

export function getSideStat(
  side: MatchSideStats | undefined,
  key: MatchSideStatKey,
): number | null {
  const val = side?.[key]
  return val === null || val === undefined ? null : val
}

export function formatStatValue(
  key: MatchSideStatKey,
  home: number | null,
  away: number | null,
  sideStats?: { home?: MatchSideStats; away?: MatchSideStats },
): { home: string; away: string } {
  if (key === 'first_serve_pct') {
    return {
      home: home === null ? '—' : `${home}%`,
      away: away === null ? '—' : `${away}%`,
    }
  }
  if (key === 'first_serve_won' || key === 'second_serve_won') {
    const totalKey = key === 'first_serve_won' ? 'first_serve_total' : 'second_serve_total'
    const hWon = home
    const aWon = away
    const hTotal = getSideStat(sideStats?.home, totalKey)
    const aTotal = getSideStat(sideStats?.away, totalKey)
    const hPct = hWon !== null && hTotal ? Math.round((hWon / hTotal) * 100) : null
    const aPct = aWon !== null && aTotal ? Math.round((aWon / aTotal) * 100) : null
    return {
      home: hWon === null || hTotal === null ? '—' : `${hWon}/${hTotal}${hPct !== null ? ` (${hPct}%)` : ''}`,
      away: aWon === null || aTotal === null ? '—' : `${aWon}/${aTotal}${aPct !== null ? ` (${aPct}%)` : ''}`,
    }
  }
  if (key === 'points_won') {
    const hTotal = getSideStat(sideStats?.home, 'points_total')
    const aTotal = getSideStat(sideStats?.away, 'points_total')
    return {
      home: home === null || hTotal === null ? '—' : `${home}/${hTotal}`,
      away: away === null || aTotal === null ? '—' : `${away}/${aTotal}`,
    }
  }
  if (key === 'break_points_won') {
    const hTotal = getSideStat(sideStats?.home, 'break_points_total')
    const aTotal = getSideStat(sideStats?.away, 'break_points_total')
    return {
      home: home === null || hTotal === null ? '—' : `${home}/${hTotal}`,
      away: away === null || aTotal === null ? '—' : `${away}/${aTotal}`,
    }
  }
  return {
    home: home === null ? '—' : String(home),
    away: away === null ? '—' : String(away),
  }
}

/** Доля полосы 0–100 для сравнительной шкалы (сумма двух сторон или %). */
export function barShares(
  key: MatchSideStatKey,
  home: number | null,
  away: number | null,
  sideStats?: { home?: MatchSideStats; away?: MatchSideStats },
): { home: number; away: number } {
  if (home === null && away === null) return { home: 0, away: 0 }

  if (key === 'first_serve_pct') {
    return { home: home ?? 0, away: away ?? 0 }
  }

  let h = home ?? 0
  let a = away ?? 0

  if (key === 'first_serve_won' || key === 'second_serve_won') {
    const totalKey = key === 'first_serve_won' ? 'first_serve_total' : 'second_serve_total'
    const hTotal = getSideStat(sideStats?.home, totalKey) ?? 0
    const aTotal = getSideStat(sideStats?.away, totalKey) ?? 0
    h = hTotal ? Math.round((h / hTotal) * 100) : 0
    a = aTotal ? Math.round((a / aTotal) * 100) : 0
    return { home: h, away: a }
  }

  const sum = h + a
  if (sum === 0) return { home: 0, away: 0 }
  return { home: Math.round((h / sum) * 100), away: Math.round((a / sum) * 100) }
}

export const SERVE_STAT_ROWS: { key: MatchSideStatKey; label: string; perPlayer?: boolean }[] = [
  { key: 'aces', label: 'Эйсы' },
  { key: 'double_faults', label: 'Двойные ошибки', perPlayer: true },
  { key: 'first_serve_pct', label: '% первой подачи', perPlayer: true },
  { key: 'unreturned_serves', label: 'Не принятая подача' },
  { key: 'first_serve_won', label: 'Очки выигр. на 1-й подаче', perPlayer: true },
  { key: 'second_serve_won', label: 'Очки выигр. на 2-й подаче', perPlayer: true },
]

export const POINTS_STAT_ROWS: { key: MatchSideStatKey; label: string }[] = [
  { key: 'winners', label: 'Активные удары (Winner)' },
  { key: 'unforced_errors', label: 'Невынужденные ошибки' },
  { key: 'forced_errors', label: 'Вынужденные ошибки' },
  { key: 'points_won', label: 'Всего выиграно очков' },
  { key: 'break_points_won', label: 'Реализация брейк-поинтов' },
]

export function rowHasData(
  stats: MatchStatistics,
  key: MatchSideStatKey,
): boolean {
  const h = getSideStat(stats.home, key)
  const a = getSideStat(stats.away, key)
  if (h !== null || a !== null) return true
  if (key === 'first_serve_won' || key === 'second_serve_won') {
    const totalKey = key === 'first_serve_won' ? 'first_serve_total' : 'second_serve_total'
    return (
      getSideStat(stats.home, totalKey) !== null
      || getSideStat(stats.away, totalKey) !== null
    )
  }
  if (key === 'points_won') {
    return getSideStat(stats.home, 'points_total') !== null
      || getSideStat(stats.away, 'points_total') !== null
  }
  if (key === 'break_points_won') {
    return getSideStat(stats.home, 'break_points_total') !== null
      || getSideStat(stats.away, 'break_points_total') !== null
  }
  return false
}
