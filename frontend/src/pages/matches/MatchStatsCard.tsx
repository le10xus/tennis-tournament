import type { Match, MatchSideStatKey, MatchStatistics } from '../../types'
import {
  POINTS_STAT_ROWS,
  SERVE_STAT_ROWS,
  barShares,
  formatStatValue,
  getSideStat,
  rowHasData,
} from './matchStatisticsUtils'
import './MatchStatsCard.css'

interface MatchStatsCardProps {
  statistics: MatchStatistics
  match: Match
}

type SidePlayers = { id: number; name: string }[]

function sideLabel(match: Match, side: 'home' | 'away'): string {
  const names: string[] = []
  if (side === 'home') {
    if (match.player1_detail) names.push(match.player1_detail.last_name)
    if (match.pair1_player2_detail) names.push(match.pair1_player2_detail.last_name)
  } else {
    if (match.player2_detail) names.push(match.player2_detail.last_name)
    if (match.pair2_player2_detail) names.push(match.pair2_player2_detail.last_name)
  }
  return names.length ? names.join(' / ') : '—'
}

function sidePlayerList(match: Match, side: 'home' | 'away'): SidePlayers {
  if (side === 'home') {
    const list: SidePlayers = []
    if (match.player1_detail && match.player1 !== null) {
      list.push({ id: match.player1, name: match.player1_detail.last_name })
    }
    if (match.pair1_player2_detail && match.pair1_player2) {
      list.push({ id: match.pair1_player2, name: match.pair1_player2_detail.last_name })
    }
    return list
  }
  const list: SidePlayers = []
  if (match.player2_detail && match.player2 !== null) {
    list.push({ id: match.player2, name: match.player2_detail.last_name })
  }
  if (match.pair2_player2_detail && match.pair2_player2) {
    list.push({ id: match.pair2_player2, name: match.pair2_player2_detail.last_name })
  }
  return list
}

export function MatchStatsCard({ statistics, match }: MatchStatsCardProps) {
  const isDoubles = match.kind === 'doubles'
  const homePlayers = sidePlayerList(match, 'home')
  const awayPlayers = sidePlayerList(match, 'away')

  const serveRows = SERVE_STAT_ROWS.filter(row => rowHasData(statistics, row.key))
  const pointRows = POINTS_STAT_ROWS.filter(row => rowHasData(statistics, row.key))

  if (serveRows.length === 0 && pointRows.length === 0) return null

  return (
    <div className="fs-stats">
      <div className="fs-stats__teams">
        <span>{sideLabel(match, 'home')}</span>
        <span className="fs-stats__teams-title">Статистика</span>
        <span>{sideLabel(match, 'away')}</span>
      </div>

      {serveRows.length > 0 && (
        <section>
          <h2 className="fs-stats__section-title">Подача</h2>
          {serveRows.map(row => (
            <StatBlock
              key={row.key}
              statKey={row.key}
              label={row.label}
              statistics={statistics}
              perPlayer={Boolean(row.perPlayer && isDoubles)}
              homePlayers={homePlayers}
              awayPlayers={awayPlayers}
            />
          ))}
        </section>
      )}
      {pointRows.length > 0 && (
        <section>
          <h2 className="fs-stats__section-title">Очки</h2>
          {pointRows.map(row => (
            <StatBlock
              key={row.key}
              statKey={row.key}
              label={row.label}
              statistics={statistics}
              perPlayer={false}
              homePlayers={homePlayers}
              awayPlayers={awayPlayers}
            />
          ))}
        </section>
      )}
    </div>
  )
}

function StatBlock({
  statKey,
  label,
  statistics,
  perPlayer,
  homePlayers,
  awayPlayers,
}: {
  statKey: MatchSideStatKey
  label: string
  statistics: MatchStatistics
  perPlayer: boolean
  homePlayers: SidePlayers
  awayPlayers: SidePlayers
}) {
  const home = getSideStat(statistics.home, statKey)
  const away = getSideStat(statistics.away, statKey)
  const formatted = formatStatValue(statKey, home, away, {
    home: statistics.home,
    away: statistics.away,
  })
  const shares = barShares(statKey, home, away, {
    home: statistics.home,
    away: statistics.away,
  })

  const showBar = home !== null || away !== null
    || statKey === 'first_serve_won'
    || statKey === 'second_serve_won'
    || statKey === 'points_won'
    || statKey === 'break_points_won'

  return (
    <>
      <FlashscoreRow
        label={label}
        homeText={formatted.home}
        awayText={formatted.away}
        homeShare={shares.home}
        awayShare={shares.away}
        showBar={showBar}
        percentScale={statKey === 'first_serve_pct'}
      />
      {perPlayer && (
        <>
          {homePlayers.map(player => (
            <PlayerStatRow
              key={`h-${player.id}`}
              playerName={player.name}
              side="home"
              playerId={String(player.id)}
              statKey={statKey}
              statistics={statistics}
            />
          ))}
          {awayPlayers.map(player => (
            <PlayerStatRow
              key={`a-${player.id}`}
              playerName={player.name}
              side="away"
              playerId={String(player.id)}
              statKey={statKey}
              statistics={statistics}
            />
          ))}
        </>
      )}
    </>
  )
}

function FlashscoreRow({
  label,
  homeText,
  awayText,
  homeShare,
  awayShare,
  showBar,
  percentScale = false,
  sub = false,
}: {
  label: string
  homeText: string
  awayText: string
  homeShare: number
  awayShare: number
  showBar: boolean
  percentScale?: boolean
  sub?: boolean
}) {
  const { homeW, awayW } = percentScale
    ? { homeW: Math.min(100, homeShare), awayW: Math.min(100, awayShare) }
    : (() => {
        const sum = homeShare + awayShare || 1
        return {
          homeW: Math.round((homeShare / sum) * 100),
          awayW: Math.round((awayShare / sum) * 100),
        }
      })()

  return (
    <div className={`fs-stat${sub ? ' fs-stat--sub' : ''}`}>
      <div className="fs-stat__values">
        <span className="fs-stat__val fs-stat__val--home">{homeText}</span>
        <span className="fs-stat__label">{label}</span>
        <span className="fs-stat__val fs-stat__val--away">{awayText}</span>
      </div>
      {showBar && (
        <div className="fs-stat__bars">
          <div className="fs-stat__half fs-stat__half--home">
            <div className="fs-stat__fill fs-stat__fill--home" style={{ width: `${homeW}%` }} />
          </div>
          <div className="fs-stat__half fs-stat__half--away">
            <div className="fs-stat__fill fs-stat__fill--away" style={{ width: `${awayW}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

function PlayerStatRow({
  playerName,
  side,
  playerId,
  statKey,
  statistics,
}: {
  playerName: string
  side: 'home' | 'away'
  playerId: string
  statKey: MatchSideStatKey
  statistics: MatchStatistics
}) {
  const playerStats = statistics[side].players?.[playerId]
  if (!playerStats) return null

  const playerKey = playerFieldKey(statKey)
  if (!playerKey) return null

  const raw = playerStats[playerKey]
  if (raw === null || raw === undefined) return null

  let displayHome = '—'
  let displayAway = '—'
  let homeShare = 0
  let awayShare = 0
  let percentScale = false

  if (playerKey === 'first_serve_pct') {
    percentScale = true
    if (side === 'home') {
      displayHome = `${raw}%`
      homeShare = Number(raw)
    } else {
      displayAway = `${raw}%`
      awayShare = Number(raw)
    }
  } else if (playerKey === 'first_serve_won' || playerKey === 'second_serve_won') {
    const totalKey = playerKey === 'first_serve_won' ? 'first_serve_total' : 'second_serve_total'
    const total = playerStats[totalKey]
    const pct = total ? Math.round((Number(raw) / Number(total)) * 100) : null
    const text = total ? `${raw}/${total}${pct !== null ? ` (${pct}%)` : ''}` : String(raw)
    if (side === 'home') displayHome = text
    else displayAway = text
    if (total) {
      const share = Math.round((Number(raw) / Number(total)) * 100)
      if (side === 'home') homeShare = share
      else awayShare = share
    }
  } else {
    if (side === 'home') {
      displayHome = String(raw)
      homeShare = Number(raw)
    } else {
      displayAway = String(raw)
      awayShare = Number(raw)
    }
  }

  return (
    <FlashscoreRow
      label={playerName}
      homeText={displayHome}
      awayText={displayAway}
      homeShare={homeShare}
      awayShare={awayShare}
      showBar={homeShare > 0 || awayShare > 0}
      percentScale={percentScale}
      sub
    />
  )
}

function playerFieldKey(statKey: MatchSideStatKey) {
  if (statKey === 'double_faults') return 'double_faults' as const
  if (statKey === 'first_serve_pct') return 'first_serve_pct' as const
  if (statKey === 'first_serve_won') return 'first_serve_won' as const
  if (statKey === 'second_serve_won') return 'second_serve_won' as const
  return null
}
