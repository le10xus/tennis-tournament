import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { matchesApi, registrationsApi, tournamentsApi, usersApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { categoryLabel } from '../../utils/categories'
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
  const { canEdit, isAuthenticated, role } = useAuth()

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [playerGender, setPlayerGender] = useState<'male' | 'female' | null>(null)
  const [playerRating, setPlayerRating] = useState<number | null>(null)
  const [playerProfileLoaded, setPlayerProfileLoaded] = useState(false)
  const [applying, setApplying] = useState(false)
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [applicationError, setApplicationError] = useState<string | null>(null)
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

  useEffect(() => {
    if (isAuthenticated && role === 'player' && !canEdit) {
      usersApi.getMe()
        .then(profile => {
          setPlayerGender(profile.player_gender)
          setPlayerRating(profile.player_rating)
        })
        .catch(() => {
          setPlayerGender(null)
          setPlayerRating(null)
        })
        .finally(() => setPlayerProfileLoaded(true))
    }
  }, [canEdit, isAuthenticated, role])

  if (loading) return <p className="state-msg">Загрузка…</p>
  if (error || !tournament) return (
    <div className="empty-state">
      <p>{error ?? 'Турнир не найден.'}</p>
      <button className="btn btn-ghost" onClick={() => navigate('/tournaments')}>← Назад</button>
    </div>
  )

  const isDoubles = tournament.kind === 'doubles'
  const approvedRegistrations = registrations.filter(reg => reg.status === 'approved')
  const pendingRegistrations = registrations.filter(reg => reg.status === 'pending')
  const ownRegistration = registrations.find(reg => reg.is_current_user)
  const isPlayer = isAuthenticated && role === 'player' && !canEdit
  const tournamentId = tournament.id
  const genderMismatch = Boolean(
    playerGender
    && tournament.gender_type !== 'mixed'
    && tournament.gender_type !== playerGender,
  )
  const ratingTooLow = (
    playerRating !== null
    && tournament.min_rating !== null
    && playerRating < tournament.min_rating
  )
  const ratingTooHigh = (
    playerRating !== null
    && tournament.max_rating !== null
    && playerRating > tournament.max_rating
  )
  const ratingLimit = tournament.min_rating !== null || tournament.max_rating !== null
    ? `${tournament.min_rating ?? 'без ограничения'} — ${tournament.max_rating ?? 'без ограничения'}`
    : null
  const applicationUnavailableReason = !playerProfileLoaded
    ? 'Проверяем условия участия…'
    : tournament.status !== 'registration'
      ? 'Регистрация на турнир закрыта.'
      : genderMismatch
        ? 'Категория турнира не соответствует вашему полу.'
        : ratingTooLow
          ? `Для участия нужен рейтинг не ниже ${tournament.min_rating}.`
          : ratingTooHigh
            ? `Для участия нужен рейтинг не выше ${tournament.max_rating}.`
            : approvedRegistrations.length >= tournament.max_players
              ? 'В турнире нет свободных мест.'
              : null

  async function handleApply() {
    setApplying(true)
    setApplicationError(null)
    try {
      const registration = await registrationsApi.apply(tournamentId)
      setRegistrations(current => [...current, registration])
    } catch (err) {
      const apiError = err as {
        data?: { detail?: string; player?: string[]; tournament?: string[]; non_field_errors?: string[] }
      }
      setApplicationError(
        apiError.data?.player?.[0]
        ?? apiError.data?.tournament?.[0]
        ?? apiError.data?.non_field_errors?.[0]
        ?? apiError.data?.detail
        ?? 'Не удалось подать заявку.',
      )
    } finally {
      setApplying(false)
    }
  }

  async function handleApprove(registrationId: number) {
    setApprovingId(registrationId)
    setApplicationError(null)
    try {
      const approved = await registrationsApi.approve(registrationId)
      setRegistrations(current => current.map(reg => (
        reg.id === registrationId ? approved : reg
      )))
    } catch (err) {
      const apiError = err as { data?: { detail?: string } }
      setApplicationError(apiError.data?.detail ?? 'Не удалось подтвердить заявку.')
    } finally {
      setApprovingId(null)
    }
  }

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
          <InfoRow label="Категория"><span>{categoryLabel(tournament.kind, tournament.gender_type)}</span></InfoRow>
          {ratingLimit && <InfoRow label="Рейтинг"><span>{ratingLimit}</span></InfoRow>}
          <InfoRow label="Формат"><span>{tournament.format_display}</span></InfoRow>
          <InfoRow label="Начало"><span>{tournament.start_date}</span></InfoRow>
          {tournament.end_date && <InfoRow label="Окончание"><span>{tournament.end_date}</span></InfoRow>}
          {tournament.location && <InfoRow label="Место"><span>{tournament.location}</span></InfoRow>}
          <InfoRow label="Игроков">
            <span>{approvedRegistrations.length} / {tournament.max_players}</span>
          </InfoRow>
        </div>
        {tournament.description && (
          <p className="t-card__desc">{tournament.description}</p>
        )}
      </div>

      {isPlayer && (
        <div className="t-application">
          <div>
            <h2 className="t-application__title">Участие в турнире</h2>
            {ownRegistration?.status === 'pending' && (
              <span className="badge badge--yellow">Заявка рассматривается</span>
            )}
            {ownRegistration?.status === 'approved' && (
              <span className="badge badge--green">Вы участвуете</span>
            )}
            {!ownRegistration && applicationUnavailableReason && (
              <p className="t-application__hint">{applicationUnavailableReason}</p>
            )}
          </div>
          {!ownRegistration && !applicationUnavailableReason && (
            <button
              className="btn btn-primary"
              type="button"
              disabled={applying}
              onClick={handleApply}
            >
              {applying ? 'Отправка…' : 'Подать заявку'}
            </button>
          )}
        </div>
      )}

      {canEdit && pendingRegistrations.length > 0 && (
        <section className="t-section">
          <h2 className="section-title">
            Заявки на рассмотрении
            <span className="section-count">{pendingRegistrations.length}</span>
          </h2>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Игрок</th>
                  <th>Пол</th>
                  <th className="col-num">Рейтинг</th>
                  <th>Дата заявки</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {pendingRegistrations.map(reg => (
                  <tr key={reg.id}>
                    <td className="col-name">
                      <Link to={`/players/${reg.player}`} className="player-ref-link">
                        {reg.player_detail.last_name} {reg.player_detail.first_name}
                      </Link>
                    </td>
                    <td>{reg.player_detail.gender_display}</td>
                    <td className="col-num">{reg.player_detail.rating}</td>
                    <td className="col-secondary">
                      {new Date(reg.registered_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        type="button"
                        disabled={approvingId === reg.id}
                        onClick={() => handleApprove(reg.id)}
                      >
                        {approvingId === reg.id ? 'Подтверждение…' : 'Подтвердить'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {applicationError && <p className="form-error t-application-error">{applicationError}</p>}

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
                  const side1 = isDoubles && m.pair1_player2_detail && m.player1_detail
                    ? `${m.player1_detail.last_name} / ${m.pair1_player2_detail.last_name}`
                    : (m.player1_detail?.last_name ?? 'TBD')

                  const side2 = isDoubles && m.pair2_player2_detail && m.player2_detail
                    ? `${m.player2_detail.last_name} / ${m.pair2_player2_detail.last_name}`
                    : (m.player2_detail?.last_name ?? 'TBD')

                  const winnerLabel = m.winner_detail
                    ? (isDoubles
                      ? (m.winner === m.player1
                        ? `${m.player1_detail?.last_name ?? ''}${m.pair1_player2_detail ? ' / ' + m.pair1_player2_detail.last_name : ''}`
                        : `${m.player2_detail?.last_name ?? ''}${m.pair2_player2_detail ? ' / ' + m.pair2_player2_detail.last_name : ''}`)
                      : m.winner_detail.last_name)
                    : '—'

                  return (
                    <tr key={m.id}>
                      <td className="col-num col-center col-secondary">
                        <Link to={`/matches/${m.id}`} className="player-ref-link">R{m.round_number}</Link>
                      </td>
                      <td className="col-name">
                        <Link to={`/matches/${m.id}`} className="player-ref-link">{side1}</Link>
                      </td>
                      <td className="col-name">
                        <Link to={`/matches/${m.id}`} className="player-ref-link">{side2}</Link>
                      </td>
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
          <span className="section-count">{approvedRegistrations.length}</span>
        </h2>

        {approvedRegistrations.length === 0 ? (
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
                {approvedRegistrations.map(reg => (
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
