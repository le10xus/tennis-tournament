import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { playersApi, tournamentsApi } from '../../api'
import { registrationsApi } from '../../api/registrations'
import { FormField } from '../../components/FormField'
import { DeleteTableAction } from '../../components/TableActionIcon'
import { CATEGORIES, categoryValue } from '../../utils/categories'
import type { Player, TournamentApiErrors, TournamentFormData } from '../../types'
import type { Registration } from '../../api/registrations'
import './TournamentFormPage.css'

const today = new Date().toISOString().slice(0, 10)

const EMPTY: TournamentFormData = {
  name: '',
  kind: 'singles',
  gender_type: 'male',
  format: 'round_robin',
  status: 'draft',
  start_date: today,
  end_date: '',
  location: '',
  description: '',
  max_players: 16,
  courts: 4,
  match_duration_minutes: 60,
  saturday_start_time: '09:00',
  sunday_start_time: '09:00',
  set_games: 6,
  third_set_super_tiebreak: false,
  points_category: '',
  age_min: null,
  pair_age_sum_min: null,
  min_rating: null,
  max_rating: null,
}

export function TournamentFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState<TournamentFormData>(EMPTY)
  const [errors, setErrors] = useState<TournamentApiErrors>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // все игроки для выбора
  const [allPlayers, setAllPlayers] = useState<Player[]>([])
  // зарегистрированные (edit) или локально выбранные (create)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  // локальные id для create-режима
  const [pendingIds, setPendingIds] = useState<number[]>([])

  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
  const [addingPlayer, setAddingPlayer] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [playerError, setPlayerError] = useState<string | null>(null)

  // id турнира после создания (нужен для регистраций)
  const createdIdRef = useRef<number | null>(null)

  useEffect(() => {
    const loads: Promise<unknown>[] = [
      playersApi.list({ page_size: '500' }).then(d => setAllPlayers(d.results)),
    ]
    if (isEdit) {
      loads.push(
        tournamentsApi.get(Number(id)).then(t => setForm({
          name: t.name,
          kind: t.kind,
          gender_type: t.gender_type,
          format: t.format,
          status: t.status,
          start_date: t.start_date,
          end_date: t.end_date ?? '',
          location: t.location,
          description: t.description,
          max_players: t.max_players,
          courts: t.courts,
          match_duration_minutes: t.match_duration_minutes,
          saturday_start_time: (t.saturday_start_time || '09:00').slice(0, 5),
          sunday_start_time: (t.sunday_start_time || '09:00').slice(0, 5),
          set_games: t.set_games,
          third_set_super_tiebreak: t.third_set_super_tiebreak,
          points_category: t.points_category,
          age_min: t.age_min,
          pair_age_sum_min: t.pair_age_sum_min,
          min_rating: t.min_rating,
          max_rating: t.max_rating,
        }))
        .catch(() => navigate('/tournaments')),
        registrationsApi.listForTournament(Number(id), 'approved')
          .then(d => setRegistrations(d.results)),
      )
    }
    Promise.all(loads).finally(() => setLoading(false))
  }, [id, isEdit, navigate])

  function set<K extends keyof TournamentFormData>(field: K, value: TournamentFormData[K]) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'kind' && value === 'singles') {
        next.pair_age_sum_min = null
      }
      return next
    })
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  // ── Добавление игрока ──────────────────────────────────────────────────
  async function handleAddPlayer() {
    const pid = Number(selectedPlayerId)
    if (!pid) return
    setPlayerError(null)
    setAddingPlayer(true)
    try {
      if (isEdit) {
        const reg = await registrationsApi.add(Number(id), pid)
        setRegistrations(prev => [...prev, reg])
      } else {
        // в create-режиме просто запоминаем
        setPendingIds(prev => [...prev, pid])
        // создаём «виртуальную» регистрацию для отображения
        const player = allPlayers.find(p => p.id === pid)!
        setRegistrations(prev => [...prev, {
          id: -pid, // временный id
          tournament: -1,
          tournament_detail: {} as Registration['tournament_detail'],
          player: pid,
          player_detail: {
            id: player.id,
            first_name: player.first_name,
            last_name: player.last_name,
            gender: player.gender,
            gender_display: player.gender_display,
            rating: player.rating,
            rating_type_display: player.rating_type_display,
            birth_year: player.birth_year,
            birth_date: player.birth_date,
            city: player.city,
            points_singles: player.points_singles,
            points_doubles: player.points_doubles,
            ntrp_singles: player.ntrp_singles,
            ntrp_doubles: player.ntrp_doubles,
            is_ftvo: player.is_ftvo,
          },
          status: 'approved',
          status_display: 'Подтверждена',
          is_current_user: false,
          registered_at: '',
          seed: null,
          pair_id: null,
          wildcard: false,
          age_ok: true,
          invited_by: null,
          invited_by_detail: null,
        }])
      }
      setSelectedPlayerId('')
    } catch (err: unknown) {
      const e = err as { data?: { non_field_errors?: string[]; player?: string[] } }
      setPlayerError(
        e.data?.non_field_errors?.[0]
        ?? e.data?.player?.[0]
        ?? 'Не удалось добавить игрока.'
      )
    } finally {
      setAddingPlayer(false)
    }
  }

  // ── Удаление игрока ────────────────────────────────────────────────────
  async function handleRemovePlayer(reg: Registration) {
    setRemovingId(reg.id)
    try {
      if (isEdit) {
        await registrationsApi.remove(reg.id)
      } else {
        setPendingIds(prev => prev.filter(pid => pid !== reg.player))
      }
      setRegistrations(prev => prev.filter(r => r.id !== reg.id))
    } catch {
      alert('Не удалось удалить игрока из турнира.')
    } finally {
      setRemovingId(null)
    }
  }

  // ── Сохранение формы ──────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const payload = { ...form, end_date: (form.end_date || null) as unknown as string }
      if (isEdit) {
        await tournamentsApi.update(Number(id), payload)
        navigate('/tournaments')
      } else {
        const created = await tournamentsApi.create(payload)
        createdIdRef.current = created.id
        // создаём регистрации для всех выбранных игроков
        await Promise.all(pendingIds.map(pid => registrationsApi.add(created.id, pid)))
        navigate(`/tournaments/${created.id}/edit`)
      }
    } catch (err: unknown) {
      const apiErr = err as { data?: TournamentApiErrors }
      if (apiErr.data) setErrors(apiErr.data)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="state-msg">Загрузка…</p>

  const registeredPlayerIds = new Set(registrations.map(r => r.player))
  const availablePlayers = allPlayers.filter(player => (
    !registeredPlayerIds.has(player.id)
    && (form.gender_type === 'mixed' || player.gender === form.gender_type)
    && (form.min_rating === null || player.rating >= form.min_rating)
    && (form.max_rating === null || player.rating <= form.max_rating)
  ))
  const selectedPlayerIsAvailable = availablePlayers.some(
    player => player.id === Number(selectedPlayerId),
  )

  return (
    <div className="form-page">
      <h1 className="page-title">{isEdit ? 'Редактировать турнир' : 'Новый турнир'}</h1>

      <form className="form-card" onSubmit={handleSubmit} noValidate>

        <FormField
          label="Название" required
          value={form.name}
          onChange={e => set('name', e.target.value)}
          error={errors.name}
          placeholder="Открытый чемпионат города"
          autoFocus
        />

        <div className="form-row">
          <FormField as="select" label="Категория" required
            value={categoryValue(form.kind, form.gender_type)}
            onChange={e => {
              const cat = CATEGORIES.find(c => c.value === e.target.value)
              if (cat) { set('kind', cat.kind); set('gender_type', cat.gender) }
            }}
            error={errors.kind ?? errors.gender_type}
          >
            {CATEGORIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </FormField>

          <FormField as="select" label="Формат" required
            value={form.format}
            onChange={e => set('format', e.target.value)}
            error={errors.format}
          >
            <option value="round_robin">Круговой</option>
            <option value="single_elim">Олимпийская (с выбыванием)</option>
            <option value="double_elim">Двойное выбывание</option>
          </FormField>

          <FormField as="select" label="Статус"
            value={form.status}
            onChange={e => set('status', e.target.value)}
            error={errors.status}
          >
            <option value="draft">Черновик</option>
            <option value="registration">Регистрация открыта</option>
            <option value="registration_closed">Регистрация закрыта</option>
            <option value="in_progress">Турнир начался</option>
            <option value="summing_up">Подводим итоги</option>
            <option value="finished">Завершён</option>
          </FormField>
        </div>

        <div className="form-row">
          <FormField
            label="Дата начала" type="date" required
            value={form.start_date}
            onChange={e => set('start_date', e.target.value)}
            error={errors.start_date}
          />
          <FormField
            label="Дата окончания" type="date"
            value={form.end_date}
            onChange={e => set('end_date', e.target.value)}
            error={errors.end_date}
          />
          <FormField
            label="Макс. игроков" type="number" min={2} max={512}
            value={form.max_players}
            onChange={e => set('max_players', Number(e.target.value))}
            error={errors.max_players}
          />
          <FormField
            label="Кортов" type="number" min={1} max={20}
            value={form.courts}
            onChange={e => set('courts', Number(e.target.value))}
            error={errors.courts}
          />
          <FormField
            label="Матч, мин" type="number" min={15} max={240} step={5}
            value={form.match_duration_minutes}
            onChange={e => set('match_duration_minutes', Number(e.target.value))}
            error={errors.match_duration_minutes}
          />
        </div>

        <div className="form-row">
          <FormField
            label="Суббота, с" type="time"
            value={form.saturday_start_time}
            onChange={e => set('saturday_start_time', e.target.value)}
            error={errors.saturday_start_time}
          />
          <FormField
            label="Воскресенье, с" type="time"
            value={form.sunday_start_time}
            onChange={e => set('sunday_start_time', e.target.value)}
            error={errors.sunday_start_time}
          />
        </div>

        <div className="form-row">
          <FormField as="select" label="Сет до" required
            value={String(form.set_games)}
            onChange={e => set('set_games', Number(e.target.value))}
            error={errors.set_games}
          >
            <option value="6">До 6 геймов (тай-брейк 6:6)</option>
            <option value="4">До 4 геймов (тай-брейк 3:3)</option>
          </FormField>
          <FormField as="select" label="3-й сет"
            value={form.third_set_super_tiebreak ? 'tiebreak' : 'full'}
            onChange={e => set('third_set_super_tiebreak', e.target.value === 'tiebreak')}
            error={errors.third_set_super_tiebreak}
          >
            <option value="full">Полный сет</option>
            <option value="tiebreak">Тай-брейк до 10</option>
          </FormField>
        </div>

        <FormField as="select" label="Начисление очков"
          value={form.points_category ?? ''}
          onChange={e => set('points_category', e.target.value)}
          error={errors.points_category}
        >
          <option value="">Не начислять очки</option>
          <option value="two_day">2-дневный ТВД</option>
          <option value="one_day">1-дневный ТВД или NTRP&lt;3</option>
          <option value="veterans">Ветераны</option>
          <option value="region">Чемпионат области</option>
        </FormField>
        {(form.points_category ?? '') !== '' && (
          <p className="seed-hint">
            Очки считаются по таблице федерации: категория + схема турнира
            ({form.format === 'double_elim' ? 'двойное выбывание' : form.format === 'round_robin' ? 'групповой' : 'олимпийка'})
            + число участников. Начисляются на странице «Итоги».
          </p>
        )}

        <div className="form-row">
          <FormField
            label="Возраст от" type="number" min={0}
            value={form.age_min ?? ''}
            onChange={e => set('age_min', e.target.value === '' ? null : Number(e.target.value))}
            error={errors.age_min}
            placeholder="Без ограничения"
          />
          {form.kind === 'doubles' && (
            <FormField
              label="Сумма возрастов пары от" type="number" min={0}
              value={form.pair_age_sum_min ?? ''}
              onChange={e => set('pair_age_sum_min', e.target.value === '' ? null : Number(e.target.value))}
              error={errors.pair_age_sum_min}
              placeholder="Без ограничения"
            />
          )}
        </div>
        <p className="seed-hint">
          «Возраст от» проверяется у каждого игрока
          {form.kind === 'doubles' ? ', «Сумма возрастов пары» — у пары целиком' : ''}.
          Если участник не проходит, заявку можно допустить с WC.
        </p>

        <div className="form-row">
          <FormField
            label="Рейтинг от" type="number" min={0}
            value={form.min_rating ?? ''}
            onChange={e => set('min_rating', e.target.value === '' ? null : Number(e.target.value))}
            error={errors.min_rating}
            placeholder="Без ограничения"
          />
          <FormField
            label="Рейтинг до" type="number" min={0}
            value={form.max_rating ?? ''}
            onChange={e => set('max_rating', e.target.value === '' ? null : Number(e.target.value))}
            error={errors.max_rating}
            placeholder="Без ограничения"
          />
        </div>

        <FormField
          label="Место проведения"
          value={form.location}
          onChange={e => set('location', e.target.value)}
          error={errors.location}
          placeholder="Спортивный комплекс «Олимп», Москва"
        />

        <div className={`field ${errors.description?.length ? 'field--error' : ''}`}>
          <label className="field-label" htmlFor="description">Описание</label>
          <textarea
            id="description"
            className="field-input field-textarea"
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={4}
            placeholder="Дополнительная информация о турнире…"
          />
          {errors.description?.map((e, i) => <p key={i} className="field-error">{e}</p>)}
        </div>

        {errors.non_field_errors && (
          <p className="form-error-global">{errors.non_field_errors.join(' ')}</p>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/tournaments')}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать турнир'}
          </button>
        </div>
      </form>

      {/* ── Участники (вне <form> чтобы кнопки не сабмитили форму) ── */}
      <section className="players-section">
        <div className="players-section__header">
          <h2 className="section-title">
            Участники
            <span className="section-count">{registrations.length}</span>
          </h2>
        </div>

        {/* Добавление игрока */}
        <div className="add-player-row">
          <select
            className="filter-select add-player-select"
            value={selectedPlayerId}
            onChange={e => { setSelectedPlayerId(e.target.value); setPlayerError(null) }}
          >
            <option value="">— выбрать игрока —</option>
            {availablePlayers.map(p => (
              <option key={p.id} value={p.id}>
                {p.last_name} {p.first_name} (рейтинг: {p.rating})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleAddPlayer}
            disabled={!selectedPlayerId || !selectedPlayerIsAvailable || addingPlayer}
          >
            {addingPlayer ? '…' : '+ Добавить'}
          </button>
        </div>
        {playerError && <p className="form-error-global" style={{ marginTop: '0.5rem' }}>{playerError}</p>}

        {/* Список участников */}
        {registrations.length > 0 && (
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Игрок</th>
                  <th>Пол</th>
                  <th className="col-num">Рейтинг</th>
                  <th>Тип рейтинга</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {registrations.map(reg => (
                  <tr key={reg.id}>
                    <td className="col-name">
                      {reg.player_detail.last_name} {reg.player_detail.first_name}
                    </td>
                    <td>{reg.player_detail.gender_display}</td>
                    <td className="col-num">{reg.player_detail.rating}</td>
                    <td className="col-secondary">{reg.player_detail.rating_type_display}</td>
                    <td className="col-actions">
                      <DeleteTableAction
                        onClick={() => handleRemovePlayer(reg)}
                        disabled={removingId === reg.id}
                        label={`Убрать игрока «${reg.player_detail.first_name} ${reg.player_detail.last_name}»`}
                        title="Убрать"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {registrations.length === 0 && (
          <p className="state-msg" style={{ marginTop: '0.75rem' }}>
            Игроков пока нет. Выберите игрока выше.
          </p>
        )}
      </section>
    </div>
  )
}
