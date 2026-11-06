import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { matchesApi, playersApi, registrationsApi, tournamentsApi, usersApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { DeleteTableAction } from '../../components/TableActionIcon'
import { PlayerPicker } from '../../components/PlayerPicker'
import { categoryLabel } from '../../utils/categories'
import type { Registration } from '../../api/registrations'
import type { ScheduleTemplate } from '../../api/tournaments'
import type { Match, Player, Tournament } from '../../types'
import './TournamentPage.css'

const FINISHED_STATUSES = new Set(['finished', 'walkover'])

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge--gray',
  registration: 'badge--blue',
  registration_closed: 'badge--yellow',
  in_progress: 'badge--green',
  summing_up: 'badge--blue',
  finished: 'badge--neutral',
}

function dayKeyOf(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function dayTitle(key: string) {
  if (!key) return 'Ещё не в расписании'
  const [year, month, day] = key.split('-').map(Number)
  const text = new Date(year, month - 1, day).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function shiftDay(key: string, days: number) {
  if (!key) return ''
  const [year, month, day] = key.split('-').map(Number)
  const date = new Date(year, month - 1, day + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function dayNumber(date: string, startDate: string) {
  const diff = Date.parse(`${date}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)
  return Math.round(diff / 86_400_000) + 1
}

function timeLabel(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function ageOn(birthDate: string | null, birthYear: number | null, onDate: string): number | null {
  const date = new Date(onDate)
  if (birthDate) {
    const born = new Date(birthDate)
    let years = date.getFullYear() - born.getFullYear()
    if (
      date.getMonth() < born.getMonth()
      || (date.getMonth() === born.getMonth() && date.getDate() < born.getDate())
    ) {
      years -= 1
    }
    return years
  }
  if (birthYear) return date.getFullYear() - birthYear
  return null
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
  const [scheduling, setScheduling] = useState(false)
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [template, setTemplate] = useState<ScheduleTemplate | null>(null)
  const [templateLoading, setTemplateLoading] = useState(false)

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
    if (!tournament) return
    if (new URLSearchParams(window.location.search).get('view') === 'info') return
    if (tournament.status === 'finished' || tournament.status === 'summing_up') {
      navigate(`/tournaments/${tournament.id}/summary`, { replace: true })
    } else if (tournament.status === 'in_progress') {
      navigate(`/tournaments/${tournament.id}/bracket`, { replace: true })
    }
  }, [tournament, navigate])

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
  const pairIds = new Set(
    approvedRegistrations
      .filter(reg => reg.pair_id !== null)
      .map(reg => reg.pair_id),
  )
  const participantCount = isDoubles
    ? (pairIds.size || Math.ceil(approvedRegistrations.length / 2))
    : approvedRegistrations.length
  const ownRegistration = registrations.find(reg => reg.is_current_user)
  const isPlayer = isAuthenticated && role === 'player' && !canEdit
  const tournamentId = tournament.id
  const genderMismatch = Boolean(
    playerGender
    && tournament.gender_type !== 'mixed'
    && tournament.gender_type !== playerGender,
  )
  const myPoints = isDoubles ? playerPoints.doubles : playerPoints.singles
  const myPlayer = allPlayers.find(player => player.id === myPlayerId) ?? null
  const chosenPartner = isDoubles && partnerId
    ? allPlayers.find(player => player.id === Number(partnerId)) ?? null
    : null
  const myAge = myPlayer
    ? ageOn(myPlayer.birth_date, myPlayer.birth_year, tournament.start_date)
    : null
  const partnerAge = chosenPartner
    ? ageOn(chosenPartner.birth_date, chosenPartner.birth_year, tournament.start_date)
    : null
  const ageWarning = (() => {
    if (!myPlayer) return null
    if (
      tournament.age_min
      && myAge !== null
      && myAge < tournament.age_min
    ) {
      return `Ваш возраст — ${myAge}, турнир с ${tournament.age_min} лет. Заявку сможет допустить организатор (WC).`
    }
    if (
      isDoubles
      && tournament.pair_age_sum_min
      && myAge !== null
      && partnerAge !== null
      && myAge + partnerAge < tournament.pair_age_sum_min
    ) {
      return `Сумма возрастов пары — ${myAge + partnerAge}, нужно от ${tournament.pair_age_sum_min}. Заявку сможет допустить организатор (WC).`
    }
    return null
  })()
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
            : participantCount >= tournament.max_players
              ? 'В турнире нет свободных мест.'
              : null

  const registeredPlayerIds = new Set(registrations.map(reg => reg.player))
  // обычным пользователям показываем только готовое расписание:
  // матчи со временем и с известными участниками
  const scheduleMatches = canEdit
    ? matches
    : matches.filter(match => (
      match.scheduled_at && match.player1 && match.player2
    ))
  const scheduleDays = (() => {
    const grouped = new Map<string, Match[]>()
    scheduleMatches.forEach(match => {
      const key = dayKeyOf(match.scheduled_at)
      const list = grouped.get(key) ?? []
      list.push(match)
      grouped.set(key, list)
    })
    return [...grouped.entries()]
      .sort((a, b) => {
        if (a[0] === '') return 1
        if (b[0] === '') return -1
        return a[0].localeCompare(b[0])
      })
      .map(([key, list]) => {
        const sorted = [...list].sort((a, b) => {
          const at = a.scheduled_at ?? ''
          const bt = b.scheduled_at ?? ''
          if (at !== bt) return at.localeCompare(bt)
          return (a.court ?? 99) - (b.court ?? 99)
        })
        const courts = [...new Set(sorted.map(m => m.court ?? 0))].sort((a, b) => a - b)
        const times = [...new Set(sorted.map(m => m.scheduled_at ?? ''))].sort((a, b) => {
          if (a === '') return 1
          if (b === '') return -1
          return a.localeCompare(b)
        })
        const cells = new Map<string, Match[]>()
        sorted.forEach(match => {
          const cellKey = `${match.scheduled_at ?? ''}|${match.court ?? 0}`
          const cellMatches = cells.get(cellKey) ?? []
          cellMatches.push(match)
          cells.set(cellKey, cellMatches)
        })
        return { key, title: dayTitle(key), matches: sorted, courts, times, cells }
      })
  })()
  const scheduleInfo = (() => {
    const scheduled = matches.filter(match => match.scheduled_at)
    const keys = [...new Set(scheduled.map(match => dayKeyOf(match.scheduled_at)))].sort()
    const perDay = keys.map(key => {
      const dayMatches = scheduled.filter(match => dayKeyOf(match.scheduled_at) === key)
      return {
        key,
        total: dayMatches.length,
        unfinished: dayMatches.filter(match => !FINISHED_STATUSES.has(match.status)).length,
      }
    })
    const current = perDay.find(day => day.unfinished > 0) ?? null
    const nextKey = keys.length ? shiftDay(keys[keys.length - 1], 1) : tournament.start_date
    const unplayed = matches.filter(match => !FINISHED_STATUSES.has(match.status)).length
    return { keys, perDay, current, nextKey, unplayed }
  })()
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

  async function handleApprove(registrationId: number, wildcard = false) {
    setApprovingId(registrationId)
    setApplicationError(null)
    try {
      await registrationsApi.approve(registrationId, wildcard)
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

  async function loadTemplate() {
    setTemplateLoading(true)
    setScheduleMessage(null)
    try {
      const data = await tournamentsApi.scheduleTemplate(tournamentId)
      setTemplate(data)
    } catch {
      setScheduleMessage('Не удалось получить шаблон расписания.')
    } finally {
      setTemplateLoading(false)
    }
  }

  async function handleGenerateSchedule(reset = false) {
    if (reset && !confirm('Пересобрать текущий день? Несыгранные матчи этого дня будут разложены заново.')) {
      return
    }
    if (!reset) {
      const currentKey = scheduleInfo.current?.key
        ?? scheduleInfo.keys[scheduleInfo.keys.length - 1]
        ?? ''
      const hasFutureDays = scheduleInfo.keys.some(key => key > currentKey)
      if (
        hasFutureDays
        && !confirm('Несыгранные матчи будущих дней будут очищены. Продолжить?')
      ) {
        return
      }
    }
    setScheduling(true)
    setScheduleMessage(null)
    try {
      const result = await tournamentsApi.generateSchedule(tournamentId, { reset })
      setMatches(result.matches)
      setScheduleMessage(result.message)
      if (templateOpen) await loadTemplate()
    } catch (err) {
      const data = (err as { data?: { detail?: string } }).data
      setScheduleMessage(data?.detail ?? 'Не удалось составить расписание.')
    } finally {
      setScheduling(false)
    }
  }

  async function toggleTemplate() {
    if (templateOpen) {
      setTemplateOpen(false)
      return
    }
    setTemplateOpen(true)
    await loadTemplate()
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
          <Link to={`/tournaments/${tournament.id}/summary`} className="btn btn-ghost">
            Итоги
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
          <InfoRow label="Сеты">
            <span>
              до {tournament.set_games}, тай-брейк при {tournament.set_games === 4 ? '3:3' : '6:6'} до 7
              {' · '}3-й сет — {tournament.third_set_super_tiebreak ? 'тай-брейк до 10' : 'полный'}
            </span>
          </InfoRow>
          <InfoRow label="Начало"><span>{tournament.start_date}</span></InfoRow>
          {tournament.end_date && <InfoRow label="Окончание"><span>{tournament.end_date}</span></InfoRow>}
          {tournament.location && <InfoRow label="Место"><span>{tournament.location}</span></InfoRow>}
          <InfoRow label="Игроков">
            <span>{participantCount} / {tournament.max_players}</span>
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
            {ownRegistration?.status === 'pending' && !ownRegistration.age_ok && (
              <span className="badge badge--red">Не проходите по возрасту — нужен WC</span>
            )}
            {ownRegistration?.status === 'approved' && (
              <span className="badge badge--green">Вы участвуете</span>
            )}
            {!ownRegistration && applicationUnavailableReason && (
              <p className="t-application__hint">{applicationUnavailableReason}</p>
            )}
            {!ownRegistration && !applicationUnavailableReason && ageWarning && (
              <p className="t-application__hint t-application__hint--warn">{ageWarning}</p>
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
                      {!reg.age_ok && (
                        <span className="badge badge--red" title="Не проходит по возрастному цензу — можно допустить с WC">
                          не проходит по возрасту
                        </span>
                      )}
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
                        onClick={() => handleApprove(reg.id, !reg.age_ok)}
                      >
                        {approvingId === reg.id
                          ? 'Подтверждение…'
                          : !reg.age_ok
                            ? 'Допустить с WC'
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

      {/* ── Расписание по дням ── */}
      <section className="t-section">
        <div className="schedule-head">
          <h2 className="section-title">
            Расписание
            <span className="section-count">{scheduleMatches.length}</span>
          </h2>
          {canEdit && (
            <div className="schedule-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={scheduling}
                onClick={() => handleGenerateSchedule()}
              >
                {scheduling ? 'Составление…' : 'Составить расписание'}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={scheduling}
                onClick={() => handleGenerateSchedule(true)}
              >
                Пересобрать день
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={templateLoading}
                onClick={toggleTemplate}
              >
                {templateOpen ? 'Скрыть шаблон' : 'Шаблон следующих дней'}
              </button>
            </div>
          )}
        </div>

        {canEdit && (
          <div className="schedule-status">
            {scheduleInfo.current ? (
              <span>
                Текущий день — <b>{dayTitle(scheduleInfo.current.key)}</b>:
                сыграно {scheduleInfo.current.total - scheduleInfo.current.unfinished}
                {' '}из {scheduleInfo.current.total}.
                Следующий день откроется, когда завершатся матчи этого дня.
              </span>
            ) : scheduleInfo.keys.length > 0 ? (
              <span>
                День <b>{dayTitle(scheduleInfo.keys[scheduleInfo.keys.length - 1])}</b> закрыт —
                можно составить расписание на <b>{dayTitle(scheduleInfo.nextKey)}</b>.
                {scheduleInfo.unplayed > 0 && ' Часть матчей ещё ждёт участников.'}
              </span>
            ) : (
              <span>
                Расписание ещё не составлено. Первый день — <b>{dayTitle(tournament.start_date)}</b>.
              </span>
            )}
            {scheduleInfo.unplayed > 0 && (
              <span className="schedule-status__rest">
                Не сыграно матчей: {scheduleInfo.unplayed}
              </span>
            )}
          </div>
        )}

        {scheduleMessage && (
          <p className="schedule-message">{scheduleMessage}</p>
        )}

        {templateOpen && (
          <div className="schedule-template">
            <div className="schedule-template__head">
              <div>
                <h3 className="schedule-template__title">Предварительный план</h3>
                <p className="schedule-template__hint">
                  Не сохраняется. Матчи с ещё неизвестными участниками тоже показаны —
                  это ориентир, а не финальное расписание.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={loadTemplate}
                disabled={templateLoading}
              >
                {templateLoading ? 'Обновление…' : 'Обновить'}
              </button>
            </div>

            {templateLoading ? (
              <p className="state-msg">Считаем план…</p>
            ) : !template || template.days.every(day => day.matches.length === 0) ? (
              <p className="state-msg">Планировать пока нечего — нет нерасставленных матчей.</p>
            ) : (
              template.days.map(day => {
                if (day.matches.length === 0) return null
                const templateTimes = [...new Set(day.matches.map(m => m.time))]
                const templateCourts = [...new Set(day.matches.map(m => m.court))].sort((a, b) => a - b)
                return (
                  <div className="schedule-template__day" key={day.date}>
                    <h4 className="schedule-template__day-title">
                      День {dayNumber(day.date, tournament.start_date)} · {dayTitle(day.date)}
                      <span>старт {day.start}</span>
                      <span>{day.matches.length} матч(ей)</span>
                    </h4>
                    <div className="table-wrap">
                      <table className="table schedule-table schedule-table--template">
                        <thead>
                          <tr>
                            <th className="col-num">Время</th>
                            {templateCourts.map(court => (
                              <th key={court}>Корт {court}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {templateTimes.map(time => (
                            <tr key={time}>
                              <td className="col-num col-secondary">{time}</td>
                              {templateCourts.map(court => (
                                <td key={court}>
                                  {day.matches
                                    .filter(m => m.time === time && m.court === court)
                                    .map(m => (
                                      <div className="template-cell" key={m.id}>
                                        <span>
                                          {m.player1}
                                          {m.pair1_player2 ? ` / ${m.pair1_player2}` : ''}
                                          {' — '}
                                          {m.player2}
                                          {m.pair2_player2 ? ` / ${m.pair2_player2}` : ''}
                                        </span>
                                        <span className="template-cell__meta">R{m.round_number}</span>
                                      </div>
                                    ))}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {matches.length === 0 ? (
          <p className="state-msg">Матчей пока нет.</p>
        ) : scheduleMatches.length === 0 ? (
          <p className="state-msg">
            Расписание пока не опубликовано — матчи появятся, когда будут назначены
            время и участники.
          </p>
        ) : (
          scheduleDays.map(day => (
            <div className="schedule-day" key={day.key || 'none'}>
              <h3 className="schedule-day__title">
                {day.title}
                <span className="section-count">{day.matches.length}</span>
              </h3>
              <div className="table-wrap">
                <table className="table schedule-table">
                  <thead>
                    <tr>
                      <th className="col-num">Время</th>
                      {day.courts.map(court => (
                        <th key={court}>{court ? `Корт ${court}` : 'Без корта'}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {day.times.map(time => (
                      <tr key={time || 'none'}>
                        <td className="col-num col-secondary">
                          {time ? timeLabel(time) : '—'}
                        </td>
                        {day.courts.map(court => (
                          <td key={court}>
                            {(day.cells.get(`${time}|${court}`) ?? []).map(m => {
                              const side1 = isDoubles && m.pair1_player2_detail && m.player1_detail
                                ? `${m.player1_detail.last_name} / ${m.pair1_player2_detail.last_name}`
                                : (m.player1_detail?.last_name ?? 'TBD')

                              const side2 = isDoubles && m.pair2_player2_detail && m.player2_detail
                                ? `${m.player2_detail.last_name} / ${m.pair2_player2_detail.last_name}`
                                : (m.player2_detail?.last_name ?? 'TBD')

                              const winnerSide = m.winner
                                ? (m.winner === m.player1 ? 1 : m.winner === m.player2 ? 2 : 0)
                                : 0

                              return (
                                <Link
                                  to={`/matches/${m.id}`}
                                  className="schedule-cell"
                                  key={m.id}
                                >
                                  <span className="schedule-cell__pairs">
                                    <span className={winnerSide === 1 ? 'schedule-cell__win' : ''}>{side1}</span>
                                    <span className="schedule-cell__vs">—</span>
                                    <span className={winnerSide === 2 ? 'schedule-cell__win' : ''}>{side2}</span>
                                  </span>
                                  <span className="schedule-cell__meta">
                                    R{m.round_number}{m.score ? ` · ${m.score}` : ''}
                                  </span>
                                </Link>
                              )
                            })}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </section>

      {/* ── Участники ── */}
      <section className="t-section">
        <h2 className="section-title">
          Участники
          <span className="section-count">{participantCount}</span>
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
                        {reg.wildcard && (
                          <span className="badge badge--yellow" title="Допущен по wild card">
                            WC
                          </span>
                        )}
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
