export interface MatchPlayerServeStats {
  double_faults?: number | null
  first_serve_pct?: number | null
  first_serve_won?: number | null
  first_serve_total?: number | null
  second_serve_won?: number | null
  second_serve_total?: number | null
}

export interface MatchSideStats {
  aces?: number | null
  double_faults?: number | null
  first_serve_pct?: number | null
  unreturned_serves?: number | null
  first_serve_won?: number | null
  first_serve_total?: number | null
  second_serve_won?: number | null
  second_serve_total?: number | null
  winners?: number | null
  unforced_errors?: number | null
  forced_errors?: number | null
  points_won?: number | null
  points_total?: number | null
  break_points_won?: number | null
  break_points_total?: number | null
  players?: Record<string, MatchPlayerServeStats>
}

export interface MatchStatistics {
  home: MatchSideStats
  away: MatchSideStats
}

export type MatchSideStatKey = keyof Omit<MatchSideStats, 'players'>
