import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { matchesApi, registrationsApi, tournamentsApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { statusBadge } from '../matches/matchUtils'
import type { Registration } from '../../api/registrations'
import type { Match, Tournament } from '../../types'
import './TournamentPage.css'

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge--gray',
  registration: 'badge--blue',
  in_progress: 'badge--green',
  finished: 'badge--neutral',
}

export function TournamentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canEdit } = useAuth()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const numId = Number(id)
    Promise.all([
      tournamentsApi.get(numId),
      registrationsApi.listForTournament(numId),
      matchesApi.list({ tournament: String(numId), page_size: '200' }),
    ])
      .then(([t, regs, matchData]) => {
        setTournament(t)
        // сортируем по посеву, нулевые в конец
        setRegistrations([...regs.results].sort((a, b) => {
          if (a.seed === null) return 1
          if (b.seed === null) return -1
          return a.seed - b.seed
        }))
        setMatches(matchData.results)
      })
      .catch(() => setError('Турнир не найден.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="state-msg">Загрузка…</p>
  if (error || !tournament) return (
    <div className="empty-state">
      <p>{error ?? 'Турнир не найден.'}</p>
      <button className="btn btn-ghost" onClick={() => navigate('/tournaments')}>← Назад</button>
    </div>
  )

  const isDoubles = tournament.kind === 'doubles'

  return (
    <div className="tournament-page">

      {/* ── Шапка ── */}
      <div className="t-page__header">
        <div>
          <Link to="/tournaments" className="back-link">← Турниры</Link>
          <h1 className="page-title">{tournament.name}</h1>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link to={`/tournaments/${tournament.id}/bracket`} className="btn btn-ghost">
            Сетка
          </Link>
          {canEdit && (
            <Link to={`/tournaments/${tournament.id}/edit`} className="btn btn-primary">
              Редактировать
            </Link>
          )}
        </div>
      </div>

      {/* ── Инфо-карточка ── */}
      <div className="t-card">
        <div className="t-card__grid">
          <InfoRow label="Статус">
            <span className={`badge ${STATUS_BADGE[tournament.status] ?? ''}`}>
              {tournament.status_display}
            </span>
          </InfoRow>
          <InfoRow label="Разряд"><span>{tournament.kind_display}</span></InfoRow>
          <InfoRow label="Формат"><span>{tournament.format_display}</span></InfoRow>
          <InfoRow label="Категория"><span>{tournament.gender_type_display}</span></InfoRow>
          <InfoRow label="Начало"><span>{tournament.start_date}</span></InfoRow>
          {tournament.end_date && <InfoRow label="Окончание"><span>{tournament.end_date}</span></InfoRow>}
          {tournament.location && <InfoRow label="Место"><span>{tournament.location}</span></InfoRow>}
          <InfoRow label="Игроков">
            <span>{registrations.length} / {tournament.max_players}</span>
          </InfoRow>
        </div>
        {tournament.description && (
          <p className="t-card__desc">{tournament.description}</p>
        )}
      </div>

      {/* ── Матчи ── */}
      <section className="t-section">
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
                  <th className="col-num">Раунд</th>
                  {isDoubles ? (
                    <>
                      <th>Пара 1</th>
                      <th>Пара 2</th>
                    </>
                  ) : (
                    <>
                      <th>Игрок 1</th>
                      <th>Игрок 2</th>
                    </>
                  )}
                  <th>Победитель</th>
                  <th>Счёт</th>
                  <th>Статус</th>
                  <th>Дата</th>
                </tr>
              </thead>
              <tbody>
                {matches.map(m => {
                  const side1 = isDoubles && m.pair1_player2_detail
                    ? `${m.player1_detail.last_name} / ${m.pair1_player2_detail.last_name}`
                    : m.player1_detail.last_name

                  const side2 = isDoubles && m.pair2_player2_detail
                    ? `${m.player2_detail.last_name} / ${m.pair2_player2_detail.last_name}`
                    : m.player2_detail.last_name

                  const winnerLabel = m.winner_detail
                    ? (isDoubles
                      ? (m.winner === m.player1
                        ? `${m.player1_detail.last_name}${m.pair1_player2_detail ? ' / ' + m.pair1_player2_detail.last_name : ''}`
                        : `${m.player2_detail.last_name}${m.pair2_player2_detail ? ' / ' + m.pair2_player2_detail.last_name : ''}`)
                      : m.winner_detail.last_name)
                    : '—'

                  return (
                    <tr key={m.id}>
                      <td className="col-num col-center col-secondary">R{m.round_number}</td>
                      <td className="col-name">{side1}</td>
                      <td className="col-name">{side2}</td>
                      <td>{winnerLabel}</td>
                      <td className="col-secondary">{m.score || '—'}</td>
                      <td>
                        <span className={`badge ${statusBadge(m.status)}`}>
                          {m.status_display}
                        </span>
                      </td>
                      <td className="col-secondary">
                        {m.scheduled_at
                          ? new Date(m.scheduled_at).toLocaleDateString('ru-RU')
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Участники ── */}
      <section className="t-section">
        <h2 className="section-title">
          Участники
          <span className="section-count">{registrations.length}</span>
        </h2>

        {registrations.length === 0 ? (
          <p className="state-msg">Игроков пока нет.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="col-num">Посев</th>
                  <th>Игрок</th>
                  <th>Пол</th>
                  <th className="col-num">Рейтинг</th>
                  <th>Тип рейтинга</th>
                  <th>Дата регистрации</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map(reg => (
                  <tr key={reg.id}>
                    <td className="col-num col-center">{reg.seed ?? '—'}</td>
                    <td className="col-name">
                      <Link to={`/players/${reg.player}`} className="player-ref-link">
                        {reg.player_detail.last_name} {reg.player_detail.first_name}
                      </Link>
                    </td>
                    <td>{reg.player_detail.gender_display}</td>
                    <td className="col-num">{reg.player_detail.rating}</td>
                    <td className="col-secondary">{reg.player_detail.rating_type_display}</td>
                    <td className="col-secondary">
                      {new Date(reg.registered_at).toLocaleDateString('ru-RU')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

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
