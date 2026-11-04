import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { matchesApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { categoryLabel } from '../../utils/categories'
import type { Match } from '../../types'

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

  const isDoubles = !!match.pair1_player2_detail || !!match.pair2_player2_detail

  const side1 = isDoubles && match.pair1_player2_detail && match.player1_detail
    ? `${match.player1_detail.last_name} / ${match.pair1_player2_detail.last_name}`
    : (match.player1_detail?.last_name ?? 'TBD')

  const side2 = isDoubles && match.pair2_player2_detail && match.player2_detail
    ? `${match.player2_detail.last_name} / ${match.pair2_player2_detail.last_name}`
    : (match.player2_detail?.last_name ?? 'TBD')

  const winnerLabel = match.winner_detail
    ? (match.winner === match.player1 ? side1 : side2)
    : null

  const setsText = [
    [match.set1_home, match.set1_away],
    [match.set2_home, match.set2_away],
    [match.set3_home, match.set3_away],
  ]
    .filter(([home, away]) => home !== null && away !== null)
    .map(([home, away]) => `${home}:${away}`)
    .join(' ')
  const scoreText = match.score || setsText

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="t-page__header">
        <div>
          <Link to={`/tournaments/${match.tournament}`} className="back-link">
            ← {match.tournament_name}
          </Link>
          <h1 className="page-title">Матч · Раунд {match.round_number}</h1>
        </div>
        {canEdit && (
          <Link to={`/matches/${match.id}/edit`} className="btn btn-primary">
            Редактировать
          </Link>
        )}
      </div>

      <div className="t-card">
        <div className="match-versus">
          <PlayerSide
            name={side1}
            playerId={match.player1}
            partner={match.pair1_player2 ? { id: match.pair1_player2, name: match.pair1_player2_detail!.last_name } : null}
            isWinner={match.player1 !== null && match.winner === match.player1}
          />
          <span className="match-vs">vs</span>
          <PlayerSide
            name={side2}
            playerId={match.player2}
            partner={match.pair2_player2 ? { id: match.pair2_player2, name: match.pair2_player2_detail!.last_name } : null}
            isWinner={match.player2 !== null && match.winner === match.player2}
          />
        </div>

        <div className="t-card__grid" style={{ paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <InfoRow label="Счёт"><span>{scoreText || '—'}</span></InfoRow>
          {winnerLabel && <InfoRow label="Победитель"><span>{winnerLabel}</span></InfoRow>}
          <InfoRow label="Категория"><span>{categoryLabel(match.kind, match.gender_type)}</span></InfoRow>
          {match.scheduled_at && (
            <InfoRow label="Дата">
              <span>{new Date(match.scheduled_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </InfoRow>
          )}
          <InfoRow label="Турнир">
            <Link to={`/tournaments/${match.tournament}`} className="player-ref-link">
              {match.tournament_name}
            </Link>
          </InfoRow>
        </div>
      </div>
    </div>
  )
}

function PlayerSide({
  name, playerId, partner, isWinner,
}: {
  name: string
  playerId: number | null
  partner: { id: number; name: string } | null
  isWinner: boolean
}) {
  if (playerId === null) {
    return (
      <div className={`match-side ${isWinner ? 'match-side--winner' : ''}`}>
        <span className="match-side__name">{name}</span>
      </div>
    )
  }
  return (
    <div className={`match-side ${isWinner ? 'match-side--winner' : ''}`}>
      <Link to={`/players/${playerId}`} className="match-side__name player-ref-link">
        {name.split(' / ')[0]}
      </Link>
      {partner && (
        <Link to={`/players/${partner.id}`} className="match-side__partner player-ref-link">
          / {partner.name}
        </Link>
      )}
      {isWinner && <span className="match-side__crown">🏆</span>}
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="t-info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{children}</span>
    </div>
  )
}
