import type { Match, MatchPlayerServeStats, MatchSideStatKey, MatchStatistics } from '../../types'
import { POINTS_STAT_ROWS, SERVE_STAT_ROWS } from './matchStatisticsUtils'
import './MatchStatisticsForm.css'

type Props = {
  match: Pick<Match, 'kind' | 'player1' | 'pair1_player2' | 'player2' | 'pair2_player2'
    | 'player1_detail' | 'pair1_player2_detail' | 'player2_detail' | 'pair2_player2_detail'>
  value: MatchStatistics
  onChange: (next: MatchStatistics) => void
}

function parseNum(raw: string): number | null {
  if (raw.trim() === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function MatchStatisticsForm({ match, value, onChange }: Props) {
  const isDoubles = match.kind === 'doubles'
  const homePlayers = [
    match.player1_detail && match.player1
      ? { id: match.player1, name: match.player1_detail.last_name }
      : null,
    match.pair1_player2_detail && match.pair1_player2
      ? { id: match.pair1_player2, name: match.pair1_player2_detail.last_name }
      : null,
  ].filter(Boolean) as { id: number; name: string }[]

  const awayPlayers = [
    match.player2_detail && match.player2
      ? { id: match.player2, name: match.player2_detail.last_name }
      : null,
    match.pair2_player2_detail && match.pair2_player2
      ? { id: match.pair2_player2, name: match.pair2_player2_detail.last_name }
      : null,
  ].filter(Boolean) as { id: number; name: string }[]

  function setSide(
    side: 'home' | 'away',
    key: MatchSideStatKey,
    raw: string,
  ) {
    onChange({
      ...value,
      [side]: { ...value[side], [key]: parseNum(raw) },
    })
  }

  function setPlayer(
    side: 'home' | 'away',
    playerId: number,
    field: keyof MatchPlayerServeStats,
    raw: string,
  ) {
    const pid = String(playerId)
    const sideStats = value[side]
    const players = { ...(sideStats.players ?? {}) }
    const row = { ...(players[pid] ?? {}), [field]: parseNum(raw) }
    players[pid] = row
    onChange({
      ...value,
      [side]: { ...sideStats, players },
    })
  }

  return (
    <div className="match-stats-form">
      <p className="seed-hint">
        Статистика необязательна. Пустые поля не показываются на карточке матча.
        Сторона 1 — игрок(и) слева, сторона 2 — справа (как в счёте по сетам).
      </p>

      <h3 className="match-stats-form__title">Подача</h3>
      {SERVE_STAT_ROWS.map(row => (
        <TeamStatRow
          key={row.key}
          label={row.label}
          home={value.home[row.key]}
          away={value.away[row.key]}
          onHome={v => setSide('home', row.key, v)}
          onAway={v => setSide('away', row.key, v)}
        />
      ))}

      {(SERVE_STAT_ROWS.some(r => r.perPlayer) && isDoubles) && (
        <PlayerSection
          homePlayers={homePlayers}
          awayPlayers={awayPlayers}
          value={value}
          onPlayer={setPlayer}
        />
      )}

      <h3 className="match-stats-form__title">Очки</h3>
      {POINTS_STAT_ROWS.map(row => (
        <TeamStatRow
          key={row.key}
          label={row.label}
          home={value.home[row.key]}
          away={value.away[row.key]}
          onHome={v => setSide('home', row.key, v)}
          onAway={v => setSide('away', row.key, v)}
        />
      ))}

      <DoublesTotals value={value} onChange={onChange} />
    </div>
  )
}

function PlayerSection(props: {
  homePlayers: { id: number; name: string }[]
  awayPlayers: { id: number; name: string }[]
  value: MatchStatistics
  onPlayer: (
    side: 'home' | 'away',
    playerId: number,
    field: keyof MatchPlayerServeStats,
    raw: string,
  ) => void
}) {
  const fields: { key: keyof MatchPlayerServeStats; label: string; paired?: keyof MatchPlayerServeStats }[] = [
    { key: 'double_faults', label: 'Двойные ошибки (игрок)' },
    { key: 'first_serve_pct', label: '% 1-й подачи (игрок)' },
    { key: 'first_serve_won', label: 'Очки на 1-й подаче (игрок)', paired: 'first_serve_total' },
    { key: 'second_serve_won', label: 'Очки на 2-й подаче (игрок)', paired: 'second_serve_total' },
  ]

  return (
    <div className="match-stats-form__players">
      <p className="match-stats-form__subtitle">По игрокам (парный разряд)</p>
      {fields.map(field => (
        <div key={field.key} className="match-stats-form__player-grid">
          <span className="match-stats-form__row-label">{field.label}</span>
          {[...props.homePlayers, ...props.awayPlayers].map(player => {
            const side = props.homePlayers.some(p => p.id === player.id) ? 'home' : 'away'
            const pid = String(player.id)
            const row = props.value[side].players?.[pid]
            return (
              <div key={`${side}-${player.id}-${field.key}`} className="match-stats-form__player-row">
                <span className="match-stats-form__player-tag">
                  {side === 'home' ? 'С1' : 'С2'} · {player.name}
                </span>
                <input
                  type="number"
                  min={0}
                  className="match-stats-form__input"
                  placeholder="—"
                  value={row?.[field.key] ?? ''}
                  onChange={e => props.onPlayer(side, player.id, field.key, e.target.value)}
                />
                {field.paired && (
                  <input
                    type="number"
                    min={0}
                    className="match-stats-form__input"
                    placeholder="всего"
                    title="Всего розыгрышей на этой подаче"
                    value={row?.[field.paired] ?? ''}
                    onChange={e => props.onPlayer(side, player.id, field.paired!, e.target.value)}
                  />
                )}
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}

function DoublesTotals({
  value,
  onChange,
}: {
  value: MatchStatistics
  onChange: (next: MatchStatistics) => void
}) {
  return (
    <div className="match-stats-form__extra">
      <TeamStatRow
        label="Всего очков в матче (знаменатель)"
        home={value.home.points_total}
        away={value.away.points_total}
        onHome={v => onChange({ ...value, home: { ...value.home, points_total: parseNum(v) } })}
        onAway={v => onChange({ ...value, away: { ...value.away, points_total: parseNum(v) } })}
      />
      <TeamStatRow
        label="Брейк-поинтов было"
        home={value.home.break_points_total}
        away={value.away.break_points_total}
        onHome={v => onChange({ ...value, home: { ...value.home, break_points_total: parseNum(v) } })}
        onAway={v => onChange({ ...value, away: { ...value.away, break_points_total: parseNum(v) } })}
      />
      <TeamStatRow
        label="Очков на 1-й подаче — всего"
        home={value.home.first_serve_total}
        away={value.away.first_serve_total}
        onHome={v => onChange({ ...value, home: { ...value.home, first_serve_total: parseNum(v) } })}
        onAway={v => onChange({ ...value, away: { ...value.away, first_serve_total: parseNum(v) } })}
      />
      <TeamStatRow
        label="Очков на 2-й подаче — всего"
        home={value.home.second_serve_total}
        away={value.away.second_serve_total}
        onHome={v => onChange({ ...value, home: { ...value.home, second_serve_total: parseNum(v) } })}
        onAway={v => onChange({ ...value, away: { ...value.away, second_serve_total: parseNum(v) } })}
      />
    </div>
  )
}

function TeamStatRow({
  label,
  home,
  away,
  onHome,
  onAway,
}: {
  label: string
  home?: number | null
  away?: number | null
  onHome: (v: string) => void
  onAway: (v: string) => void
}) {
  return (
    <div className="match-stats-form__row">
      <input
        type="number"
        min={0}
        className="match-stats-form__input"
        placeholder="—"
        value={home ?? ''}
        onChange={e => onHome(e.target.value)}
      />
      <span className="match-stats-form__row-label">{label}</span>
      <input
        type="number"
        min={0}
        className="match-stats-form__input"
        placeholder="—"
        value={away ?? ''}
        onChange={e => onAway(e.target.value)}
      />
    </div>
  )
}
