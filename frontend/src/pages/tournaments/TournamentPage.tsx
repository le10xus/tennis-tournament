import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { matchesApi, playersApi, registrationsApi, tournamentsApi, usersApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { DeleteTableAction } from '../../components/TableActionIcon'
import { PlayerPicker } from '../../components/PlayerPicker'
import { categoryLabel } from '../../utils/categories'
import { statusBadge } from '../matches/matchUtils'
import type { Registration } from '../../api/registrations'
import type { Match, Player, Tournament } from '../../types'
import './TournamentPage.css'

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge--gray',
  registration: 'badge--blue',
  registration_closed: 'badge--yellow',
  in_progress: 'badge--green',
  summing_up: 'badge--blue',
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
  const [playerPoints, setPlayerPoints] = useState<{ singles: number | null; doubles: number | null }>({
    singles: null,
    doubles: null,
  })
  const [playerProfileLoaded, setPlayerProfileLoaded] = useState(false)
  const [applying, setApplying] = useState(false)
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [applicationError, setApplicationError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  const [myPlayerId, setMyPlayerId] = useState<number | null>(null)
  const [partnerId, setPartnerId] = useState('')
  const [declarePlayerId, setDeclarePlayerId] = useState('')
  const [declarePartnerId, setDeclarePartnerId] = useState('')
  const [declaring, setDeclaring] = useState(false)
  const [confirmingId, setConfirmingId] = useState<number | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)

  useEffect(() => {
    playersApi.list({ page_size: '500' })
      .then(data => setAllPlayers(data.results))
      .catch(() => setAllPlayers([]))
  }, [])

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
          setPlayerPoints({
            singles: profile.player_points_singles,
            doubles: profile.player_points_doubles,
          })
          setMyPlayerId(profile.player_id)
        })
        .catch(() => {
          setPlayerGender(null)
          setPlayerPoints({ singles: null, doubles: null })
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
  // рейтинг игрока зависит от разряда турнира: парный или одиночный
  const disciplinePoints = (player: { points_singles: number; points_doubles: number }) =>
    isDoubles ? player.points_doubles : player.points_singles
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
  const myPoints = isDoubles ? playerPoints.doubles : playerPoints.singles
  const ratingTooLow = (
    myPoints !== null
    && tournament.min_rating !== null
    && myPoints < tournament.min_rating
  )
  const ratingTooHigh = (
    myPoints !== null
    && tournament.max_rating !== null
    && myPoints > tournament.max_rating
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

  const registeredPlayerIds = new Set(registrations.map(reg => reg.player))
  const disciplineNtrp = (player: { ntrp_singles: string; ntrp_doubles: string }) =>
    isDoubles ? player.ntrp_doubles : player.ntrp_singles

  const birthYear = (player: { birth_year: number | null; birth_date: string | null }) =>
    player.birth_year ?? (player.birth_date ? new Date(player.birth_date).getFullYear() : null)

  // сумма парных очков пары — одинаковая для обоих её игроков
  const pairPointsById = new Map<number, number>()
  const firstOfPair = new Map<number, number>()
  if (isDoubles) {
    const grouped = new Map<number, Registration[]>()
    approvedRegistrations.forEach(reg => {
      if (reg.pair_id === null) return
      const list = grouped.get(reg.pair_id) ?? []
      list.push(reg)
      grouped.set(reg.pair_id, list)
      if (!firstOfPair.has(reg.pair_id)) {
        firstOfPair.set(reg.pair_id, reg.id)
      }
    })
    grouped.forEach((regs, pairId) => {
      pairPointsById.set(
        pairId,
        regs.reduce((sum, reg) => sum + reg.player_detail.points_doubles, 0),
      )
    })
  }

  // строки группируем по парам, чтобы визуально отделить одну пару от другой
  const groupMap = new Map<string, Registration[]>()
  approvedRegistrations.forEach(reg => {
    const key = isDoubles && reg.pair_id !== null ? `pair-${reg.pair_id}` : `reg-${reg.id}`
    const list = groupMap.get(key) ?? []
    list.push(reg)
    groupMap.set(key, list)
  })
  const participantGroups = [...groupMap.entries()].map(([key, registrations]) => ({
    key,
    registrations,
  }))
  const playerPointsOf = (player: Player) =>
    isDoubles ? player.points_doubles : player.points_singles

  const availableForAdmin = allPlayers.filter(player => !registeredPlayerIds.has(player.id))
  const partnerOptions = allPlayers.filter(player => (
    player.id !== myPlayerId
    && !registeredPlayerIds.has(player.id)
    && (tournament.gender_type === 'mixed' || tournament.gender_type === player.gender)
    && (tournament.min_rating === null || playerPointsOf(player) >= tournament.min_rating)
    && (tournament.max_rating === null || playerPointsOf(player) <= tournament.max_rating)
  ))

  type ApiErrorData = {
    detail?: string
    partner?: string[]
    player?: string[]
    tournament?: string[]
    non_field_errors?: string[]
  }

  function registrationError(err: unknown, fallback: string) {
    const data = (err as { data?: ApiErrorData }).data ?? {}
    return data.partner?.[0]
      ?? data.player?.[0]
      ?? data.tournament?.[0]
      ?? data.non_field_errors?.[0]
      ?? data.detail
      ?? fallback
  }

  async function reloadRegistrations() {
    const data = await registrationsApi.listForTournament(tournamentId)
    setRegistrations(data.results)
  }

  async function handleApply() {
    setApplying(true)
    setApplicationError(null)
    try {
      await registrationsApi.apply(tournamentId, isDoubles ? Number(partnerId) : undefined)
      setPartnerId('')
      await reloadRegistrations()
    } catch (err) {
      setApplicationError(registrationError(err, 'Не удалось подать заявку.'))
    } finally {
      setApplying(false)
    }
  }

  async function handleConfirm(registrationId: number) {
    setConfirmingId(registrationId)
    setApplicationError(null)
    try {
      await registrationsApi.confirm(registrationId)
      await reloadRegistrations()
    } catch (err) {
      setApplicationError(registrationError(err, 'Не удалось подтвердить участие.'))
    } finally {
      setConfirmingId(null)
    }
  }

  async function handleDeclare() {
    const playerId = Number(declarePlayerId)
    const partner = isDoubles ? Number(declarePartnerId) : undefined
    if (!playerId) {
      setApplicationError('Выберите игрока.')
      return
    }
    if (isDoubles && !partner) {
      setApplicationError('Выберите двоих игроков.')
      return
    }
    setDeclaring(true)
    setApplicationError(null)
    try {
      await registrationsApi.add(tournamentId, playerId, partner)
      setDeclarePlayerId('')
      setDeclarePartnerId('')
      await reloadRegistrations()
    } catch (err) {
      setApplicationError(registrationError(err, 'Не удалось заявить игрока.'))
    } finally {
      setDeclaring(false)
    }
  }

  async function handleApprove(registrationId: number) {
    setApprovingId(registrationId)
    setApplicationError(null)
    try {
      await registrationsApi.approve(registrationId)
      await reloadRegistrations()
    } catch (err) {
      setApplicationError(registrationError(err, 'Не удалось подтвердить заявку.'))
    } finally {
      setApprovingId(null)
    }
  }

  function handlePlayerCreated(player: Player) {
    setAllPlayers(current => [...current, player])
  }

  async function handleRemove(registration: Registration) {
    const isPair = isDoubles && registration.pair_id !== null
    const name = `${registration.player_detail.last_name} ${registration.player_detail.first_name}`
    const question = isPair
      ? `Удалить пару (${name} и партнёр) из турнира?`
      : `Удалить игрока ${name} из турнира?`
    if (!confirm(question)) return
    setRemovingId(registration.id)
    setApplicationError(null)
    try {
      await registrationsApi.remove(registration.id)
      await reloadRegistrations()
    } catch (err) {
      setApplicationError(registrationError(err, 'Не удалось удалить заявку.'))
    } finally {
      setRemovingId(null)
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
            {ownRegistration?.status === 'pending' && ownRegistration.invited_by_detail && (
              <span className="badge badge--yellow">
                Вас пригласил {ownRegistration.invited_by_detail.last_name} {ownRegistration.invited_by_detail.first_name}
              </span>
            )}
            {ownRegistration?.status === 'pending' && !ownRegistration.invited_by_detail && (
              <span className="badge badge--yellow">Заявка рассматривается</span>
            )}
            {ownRegistration?.status === 'approved' && (
              <span className="badge badge--green">Вы участвуете</span>
            )}
            {!ownRegistration && applicationUnavailableReason && (
              <p className="t-application__hint">{applicationUnavailableReason}</p>
            )}
            {!ownRegistration && !applicationUnavailableReason && isDoubles && (
              <p className="t-application__hint">
                Для парного турнира выберите партнёра — он получит приглашение и сможет подтвердить участие.
              </p>
            )}
          </div>

          {ownRegistration?.status === 'pending' && ownRegistration.invited_by_detail && (
            <button
              className="btn btn-primary"
              type="button"
              disabled={confirmingId === ownRegistration.id}
              onClick={() => handleConfirm(ownRegistration.id)}
            >
              {confirmingId === ownRegistration.id ? 'Подтверждение…' : 'Подтвердить участие'}
            </button>
          )}

          {!ownRegistration && !applicationUnavailableReason && (
            <div className="t-application__actions">
              {isDoubles && (
                <PlayerPicker
                  players={partnerOptions}
                  value={partnerId}
                  onChange={setPartnerId}
                  placeholder="Выберите партнёра"
                  pointsOf={playerPointsOf}
                />
              )}
              <button
                className="btn btn-primary"
                type="button"
                disabled={applying || (isDoubles && !partnerId)}
                onClick={handleApply}
              >
                {applying ? 'Отправка…' : 'Подать заявку'}
              </button>
            </div>
          )}
        </div>
      )}

      {canEdit && (
        <section className="t-section">
          <h2 className="section-title">Заявить участников</h2>
          <div className="t-declare">
            <PlayerPicker
              players={availableForAdmin}
              value={declarePlayerId}
              onChange={setDeclarePlayerId}
              placeholder={isDoubles ? 'Игрок 1' : 'Выберите игрока'}
              excludeIds={declarePartnerId ? [Number(declarePartnerId)] : []}
              allowCreate
              onCreated={handlePlayerCreated}
              pointsOf={playerPointsOf}
            />
            {isDoubles && (
              <PlayerPicker
                players={availableForAdmin}
                value={declarePartnerId}
                onChange={setDeclarePartnerId}
                placeholder="Игрок 2 (партнёр)"
                excludeIds={declarePlayerId ? [Number(declarePlayerId)] : []}
                allowCreate
                onCreated={handlePlayerCreated}
                pointsOf={playerPointsOf}
              />
            )}
            <button
              className="btn btn-primary"
              type="button"
              disabled={declaring}
              onClick={handleDeclare}
            >
              {declaring ? 'Отправка…' : isDoubles ? 'Заявить пару' : 'Заявить игрока'}
            </button>
          </div>
        </section>
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
                      {reg.invited_by_detail && (
                        <span className="col-secondary"> · приглашён</span>
                      )}
                    </td>
                    <td>{reg.player_detail.gender_display}</td>
                    <td className="col-num">{disciplinePoints(reg.player_detail)}</td>
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
                        {approvingId === reg.id
                          ? 'Подтверждение…'
                          : isDoubles ? 'Подтвердить пару' : 'Подтвердить'}
                      </button>
                      <DeleteTableAction
                        onClick={() => handleRemove(reg)}
                        disabled={removingId === reg.id}
                        label="Удалить заявку"
                        title="Удалить заявку"
                      />
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
                          ? `${new Date(m.scheduled_at).toLocaleString('ru-RU', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}${m.court ? ` · корт ${m.court}` : ''}`
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

        {isDoubles && (
          <p style={{ margin: '-0.25rem 0 0.85rem', fontSize: '0.85rem', color: 'var(--text-secondary, #6b7280)' }}>
            Рейтинг пары — сумма парных очков обоих игроков. Первые 4 пары по рейтингу получают посев.
          </p>
        )}

        {approvedRegistrations.length === 0 ? (
          <p className="state-msg">Игроков пока нет.</p>
        ) : (
          <div className="table-wrap">
            <table className={`table participants-table${isDoubles ? ' participants-table--pairs' : ''}`}>
              <thead>
                <tr>
                  <th className="col-num">Посев</th>
                  <th>Игрок</th>
                  <th>Город</th>
                  <th className="col-num">Год рождения</th>
                  <th>Пол</th>
                  <th className="col-num">Очки</th>
                  <th className="col-num">Очки пары</th>
                  <th className="col-num">NTRP</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              {participantGroups.map((group, groupIndex) => {
                const place = groupIndex + 1
                const isSeeded = place <= 4
                return (
                <tbody
                  key={group.key}
                  className={isDoubles && group.registrations.length > 1 ? 'pair-group' : undefined}
                >
                  {group.registrations.map(reg => (
                    <tr key={reg.id}>
                      <td className="col-num col-center">
                        <span
                          className={isSeeded ? 'seed-number seed-number--seeded' : 'seed-number'}
                          title={isSeeded ? 'Сеяный' : `Место ${place}`}
                        >
                          {place}
                        </span>
                      </td>
                      <td className="col-name">
                        <Link to={`/players/${reg.player}`} className="player-ref-link">
                          {reg.player_detail.last_name} {reg.player_detail.first_name}
                        </Link>
                      </td>
                      <td className="col-secondary">{reg.player_detail.city || '—'}</td>
                      <td className="col-num">{birthYear(reg.player_detail) ?? '—'}</td>
                      <td>{reg.player_detail.gender === 'female' ? 'Ж' : 'М'}</td>
                      <td className="col-num">{disciplinePoints(reg.player_detail)}</td>
                      <td className="col-num">
                        {isDoubles && reg.pair_id !== null
                          ? pairPointsById.get(reg.pair_id) ?? '—'
                          : '—'}
                      </td>
                      <td className="col-num">{disciplineNtrp(reg.player_detail) || '—'}</td>
                      {canEdit && (
                        <td className="col-actions">
                          {(!isDoubles || reg.pair_id === null || firstOfPair.get(reg.pair_id) === reg.id) && (
                            <DeleteTableAction
                              onClick={() => handleRemove(reg)}
                              disabled={removingId === reg.id}
                              label={isDoubles && reg.pair_id !== null
                                ? 'Удалить пару из турнира'
                                : `Удалить игрока ${reg.player_detail.last_name} ${reg.player_detail.first_name} из турнира`}
                              title={isDoubles && reg.pair_id !== null ? 'Удалить пару' : 'Удалить игрока'}
                            />
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                )
              })}
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
