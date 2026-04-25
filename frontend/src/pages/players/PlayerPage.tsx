import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { matchesApi, playersApi, registrationsApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { statusBadge } from '../matches/matchUtils'
import type { Registration } from '../../api/registrations'
import type { Match, Player } from '../../types'
import './PlayerPage.css'

const TOURNAMENT_STATUS_BADGE: Record<string, string> = {
  draft: 'badge--gray',
  registration: 'badge--blue',
  in_progress: 'badge--green',
  finished: 'badge--neutral',
}

export function PlayerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canEdit } = useAuth()

  const [player, setPlayer] = useState<Player | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const numId = Number(id)
    Promise.all([
      playersApi.get(numId),
      registrationsApi.listForPlayer(numId),
      matchesApi.list({ player: String(numId), page_size: '200' }),
    ])
      .then(([p, regs, matchData]) => {
        setPlayer(p)
        setRegistrations(regs.results)
        setMatches(matchData.results)
      })
      .catch(() => setError('Игрок не найден.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="state-msg">Загрузка…</p>
  if (error || !player) return (
    <div className="empty-state">
      <p>{error ?? 'Игрок не найден.'}</p>
      <button className="btn btn-ghost" onClick={() => navigate('/players')}>← Назад</button>
    </div>
  )

  return (
    <div className="player-page">

      {/* ── Шапка ── */}
      <div className="player-page__header">
        <div>
          <Link to="/players" className="back-link">← Игроки</Link>
          <h1 className="page-title">{player.first_name} {player.last_name}</h1>
        </div>
        {canEdit && (
          <Link to={`/players/${player.id}/edit`} className="btn btn-primary">
            Редактировать
          </Link>
        )}
      </div>

      {/* ── Инфо-карточка ── */}
      <div className="player-card">
        <div className="player-card__grid">
          <InfoRow label="Пол" value={player.gender_display} />
          <InfoRow label="Рейтинг" value={`${player.rating} (${player.rating_type_display})`} />
          {player.email && <InfoRow label="Email" value={player.email} />}
          {player.phone && <InfoRow label="Телефон" value={player.phone} />}
          {player.birth_date && (
            <InfoRow
              label="Дата рождения"
              value={new Date(player.birth_date).toLocaleDateString('ru-RU')}
            />
          )}
        </div>
      </div>

      {/* ── Матчи ── */}
      <section className="player-section">
        <h2 className="section-title">
          Матчи
          <span className="section-count">{matches.length}</span>
        </h2>

        {matches.length === 0 ? (
          <p className="state-msg">Матчей пока нет.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Турнир</th>
                  <th>Раунд</th>
                  <th>Противник(и)</th>
                  <th>Партнёр</th>
                  <th>Счёт</th>
                  <th>Статус</th>
                  <th>Результат</th>
                </tr>
              </thead>
              <tbody>
                {matches.map(m => {
                  const pid = player.id
                  // определяем, на чьей стороне игрок
                  const onSide1 = m.player1 === pid || m.pair1_player2 === pid
                  const isDoubles = m.pair1_player2 !== null || m.pair2_player2 !== null

                  // партнёр по паре
                  const partnerDetail = onSide1
                    ? (m.player1 === pid ? m.pair1_player2_detail : m.player1_detail)
                    : (m.player2 === pid ? m.pair2_player2_detail : m.player2_detail)

                  // соперники
                  const opp1 = onSide1 ? m.player2_detail : m.player1_detail
                  const opp2 = onSide1 ? m.pair2_player2_detail : m.pair1_player2_detail

                  // победил ли игрок
                  let result: string | null = null
                  if (m.winner !== null) {
                    const playerWon = onSide1
                      ? m.winner === m.player1 || m.winner === m.pair1_player2
                      : m.winner === m.player2 || m.winner === m.pair2_player2
                    result = playerWon ? 'win' : 'loss'
                  }

                  const oppLabel = opp2
                    ? `${opp1?.last_name ?? '?'} / ${opp2.last_name}`
                    : (opp1?.last_name ?? '—')

                  return (
                    <tr key={m.id}>
                      <td className="col-secondary col-name">{m.tournament_name ?? `#${m.tournament}`}</td>
                      <td className="col-center col-secondary">R{m.round_number}</td>
                      <td>{oppLabel}</td>
                      <td className="col-secondary">
                        {isDoubles ? (partnerDetail?.last_name ?? '—') : '—'}
                      </td>
                      <td className="col-secondary">{m.score || '—'}</td>
                      <td>
                        <span className={`badge ${statusBadge(m.status)}`}>
                          {m.status_display}
                        </span>
                      </td>
                      <td>
                        {result === 'win' && <span className="result result--win">Победа</span>}
                        {result === 'loss' && <span className="result result--loss">Поражение</span>}
                        {result === null && '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Турниры ── */}
      <section className="player-section">
        <h2 className="section-title">
          Турниры
          <span className="section-count">{registrations.length}</span>
        </h2>

        {registrations.length === 0 ? (
          <p className="state-msg">Игрок ещё не участвовал в турнирах.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Турнир</th>
                  <th>Статус</th>
                  <th>Разряд</th>
                  <th>Формат</th>
                  <th>Дата начала</th>
                  <th>Место</th>
                  <th className="col-num">Посев</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map(reg => {
                  const t = reg.tournament_detail
                  return (
                    <tr key={reg.id}>
                      <td className="col-name">
                        <Link to={`/tournaments/${t.id}/edit`} className="tournament-ref-link">
                          {t.name}
                        </Link>
                      </td>
                      <td>
                        <span className={`badge ${TOURNAMENT_STATUS_BADGE[t.status] ?? ''}`}>
                          {t.status_display}
                        </span>
                      </td>
                      <td>{t.kind_display}</td>
                      <td className="col-secondary">{t.format_display}</td>
                      <td className="col-secondary">{t.start_date}</td>
                      <td className="col-secondary">{t.location || '—'}</td>
                      <td className="col-num">{reg.seed ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  )
}
