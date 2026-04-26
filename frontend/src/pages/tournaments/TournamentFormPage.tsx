import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { playersApi, tournamentsApi } from '../../api'
import { registrationsApi } from '../../api/registrations'
import { FormField } from '../../components/FormField'
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
        }))
        .catch(() => navigate('/tournaments')),
        registrationsApi.listForTournament(Number(id))
          .then(d => setRegistrations(d.results)),
      )
    }
    Promise.all(loads).finally(() => setLoading(false))
  }, [id, isEdit, navigate])

  function set<K extends keyof TournamentFormData>(field: K, value: TournamentFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
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
            gender_display: player.gender_display,
            rating: player.rating,
            rating_type_display: player.rating_type_display,
          },
          registered_at: '',
          seed: null,
          pair_id: null,
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
  const availablePlayers = allPlayers.filter(p => !registeredPlayerIds.has(p.id))

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
            <option value="in_progress">Идёт</option>
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
            disabled={!selectedPlayerId || addingPlayer}
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
                      <button
                        type="button"
                        className="btn btn-danger-ghost"
                        onClick={() => handleRemovePlayer(reg)}
                        disabled={removingId === reg.id}
                      >
                        {removingId === reg.id ? '…' : 'Убрать'}
                      </button>
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
