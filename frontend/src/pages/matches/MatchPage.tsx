import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { matchesApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { categoryLabel } from '../../utils/categories'
import type { Match } from '../../types'
import { hasMatchStatistics } from './matchStatisticsUtils'
import { MatchStatsCard } from './MatchStatsCard'
import './MatchPage.css'

export function MatchPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canEdit } = useAuth()

  const [match, setMatch] = useState<Match | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    matchesApi.get(Number(id))
      .then(setMatch)
      .catch(() => setError('Матч не найден.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="state-msg">Загрузка…</p>
  if (error || !match) return (
    <div className="empty-state">
      <p>{error ?? 'Матч не найден.'}</p>
      <button className="btn btn-ghost" onClick={() => navigate(-1)}>← Назад</button>
    </div>
  )

  const isDoubles = match.kind === 'doubles'
  const homeWins = match.winner !== null && match.winner === match.player1
  const awayWins = match.winner !== null && match.winner === match.player2

  const sets = [
    [match.set1_home, match.set1_away],
    [match.set2_home, match.set2_away],
    [match.set3_home, match.set3_away],
  ].filter(([h, a]) => h !== null && a !== null) as [number, number][]

  const setsText = sets.map(([h, a]) => `${h}:${a}`).join(' ')
  const scoreText = match.score || setsText

  const showStats = hasMatchStatistics(match.statistics)

  return (
    <div className="match-page">
      <div className="t-page__header">
        <div>
          <h1 className="page-title">Матч · Раунд {match.round_number}</h1>
        </div>
        {canEdit && (
          <div className="match-page__actions">
            <Link to={`/matches/${match.id}/statistics/edit`} className="btn btn-ghost">
              Редактировать статистику
            </Link>
            <Link to={`/matches/${match.id}/edit`} className="btn btn-primary">
              Редактировать матч
            </Link>
          </div>
        )}
      </div>

      <article className="match-card">
        <Link to={`/tournaments/${match.tournament}`} className="match-card__tournament">
          {match.tournament_name}
        </Link>

        <div className="match-card__meta">
          <span>{categoryLabel(match.kind, match.gender_type)}</span>
          {match.scheduled_at && (
            <span>
              {new Date(match.scheduled_at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          )}
          {match.court != null && <span>Корт {match.court}</span>}
        </div>

        <div className="match-card__scoreboard">
          <SideColumn
            match={match}
            side="home"
            isDoubles={isDoubles}
            isWinner={homeWins}
          />
          <SetScoreColumn sets={sets} scoreText={scoreText} homeWins={homeWins} awayWins={awayWins} />
          <SideColumn
            match={match}
            side="away"
            isDoubles={isDoubles}
            isWinner={awayWins}
          />
        </div>
      </article>

      {showStats && match.statistics && (
        <MatchStatsCard statistics={match.statistics} match={match} />
      )}
      {!showStats && (
        <p className="state-msg" style={{ marginTop: '1rem' }}>
          Статистика пока не заполнена.
          {canEdit && (
            <>
              {' '}
              <Link to={`/matches/${match.id}/statistics/edit`}>Добавить статистику</Link>
            </>
          )}
        </p>
      )}
    </div>
  )
}

function SetScoreColumn({
  sets,
  scoreText,
  homeWins,
  awayWins,
}: {
  sets: [number, number][]
  scoreText: string
  homeWins: boolean
  awayWins: boolean
}) {
  if (sets.length === 0) {
    return (
      <div className="match-card__sets">
        <span className="match-card__score-fallback">{scoreText || '—'}</span>
      </div>
    )
  }
  return (
    <div className="match-card__sets">
      {sets.map(([home, away], idx) => (
        <div key={idx} className="match-card__set-row">
          <span className={homeWins || (!awayWins && home > away) ? '' : 'match-card__set-cell--loser'}>
            {home}
          </span>
          <span className={awayWins || (!homeWins && away > home) ? '' : 'match-card__set-cell--loser'}>
            {away}
          </span>
        </div>
      ))}
    </div>
  )
}

function SideColumn({
  match,
  side,
  isDoubles,
  isWinner,
}: {
  match: Match
  side: 'home' | 'away'
  isDoubles: boolean
  isWinner: boolean
}) {
  const captain = side === 'home' ? match.player1_detail : match.player2_detail
  const partner = side === 'home' ? match.pair1_player2_detail : match.pair2_player2_detail
  const captainId = side === 'home' ? match.player1 : match.player2
  const partnerId = side === 'home' ? match.pair1_player2 : match.pair2_player2

  const className = `match-card__side${side === 'away' ? ' match-card__side--away' : ''}`

  if (!captain) {
    return (
      <div className={className}>
        <span className="match-card__name">TBD</span>
      </div>
    )
  }

  return (
    <div className={className}>
      {captainId ? (
        <Link
          to={`/players/${captainId}`}
          className={`match-card__name${isWinner ? ' match-card__name--winner' : ''}`}
        >
          {captain.last_name}
        </Link>
      ) : (
        <span className="match-card__name">{captain.last_name}</span>
      )}
      {isDoubles && partner && partnerId && (
        <Link to={`/players/${partnerId}`} className="match-card__partner">
          {partner.last_name}
        </Link>
      )}
      {isDoubles && partner && !partnerId && (
        <span className="match-card__partner">{partner.last_name}</span>
      )}
    </div>
  )
}
