import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { matchesApi, playersApi, tournamentsApi } from '../../api'
import { FormField } from '../../components/FormField'
import { CATEGORIES } from '../../utils/categories'
import type { MatchApiErrors, MatchFormData, Player, Tournament } from '../../types'
import { playerName } from './matchUtils'

const EMPTY: MatchFormData = {
  tournament: '',
  gender_type: 'male',
  player1: '',
  pair1_player2: '',
  player2: '',
  pair2_player2: '',
  winner: null,
  status: 'scheduled',
  round_number: 1,
  scheduled_at: '',
  score: '',
}

const FINISHED_STATUSES = new Set(['finished', 'walkover'])

export function MatchFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState<MatchFormData>(EMPTY)
  const [errors, setErrors] = useState<MatchApiErrors>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [players, setPlayers] = useState<Player[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])

  useEffect(() => {
    const loadRef = Promise.all([
      playersApi.list({ page_size: '200' }).then(d => setPlayers(d.results)),
      tournamentsApi.list({ page_size: '200' }).then(d => setTournaments(d.results)),
    ])

    if (isEdit) {
      Promise.all([loadRef, matchesApi.get(Number(id))])
        .then(([, m]) => setForm({
          tournament: m.tournament,
          gender_type: m.gender_type,
          player1: m.player1,
          pair1_player2: m.pair1_player2 ?? '',
          player2: m.player2,
          pair2_player2: m.pair2_player2 ?? '',
          winner: m.winner,
          status: m.status,
          round_number: m.round_number,
          scheduled_at: m.scheduled_at
            ? new Date(m.scheduled_at).toISOString().slice(0, 16)
            : '',
          score: m.score,
        }))
        .catch(() => navigate('/matches'))
        .finally(() => setLoading(false))
    } else {
      loadRef.finally(() => setLoading(false))
    }
  }, [id, isEdit, navigate])

  function set<K extends keyof MatchFormData>(field: K, value: MatchFormData[K]) {
    setForm(prev => {
      const next = { ...prev, [field]: value }

      // при смене турнира — сбросить игроков
      if (field === 'tournament') {
        next.player1 = ''
        next.pair1_player2 = ''
        next.player2 = ''
        next.pair2_player2 = ''
        next.winner = null
      }

      // сбросить winner если сменили игроков-капитанов
      if ((field === 'player1' || field === 'player2') && next.winner) {
        if (next.winner !== next.player1 && next.winner !== next.player2) {
          next.winner = null
        }
      }
      return next
    })
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const selectedTournament = tournaments.find(t => t.id === form.tournament)
  const isDoubles = selectedTournament?.kind === 'doubles'
  const showResult = FINISHED_STATUSES.has(form.status)

  // для winners: только капитаны (player1 и player2)
  const p1 = players.find(p => p.id === form.player1)
  const p2 = players.find(p => p.id === form.player2)
  const captains = [p1, p2].filter(Boolean) as Player[]

  // все задействованные ID в форме
  const usedIds = new Set(
    [form.player1, form.pair1_player2, form.player2, form.pair2_player2].filter(Boolean)
  )

  function playerOptions(excludeExtra?: number | '') {
    return players.map(p => (
      <option
        key={p.id}
        value={p.id}
        disabled={usedIds.has(p.id) && p.id !== excludeExtra}
      >
        {p.last_name} {p.first_name} ({p.rating})
      </option>
    ))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const payload = {
        ...form,
        pair1_player2: (form.pair1_player2 || null) as unknown as number | '',
        pair2_player2: (form.pair2_player2 || null) as unknown as number | '',
        scheduled_at: (form.scheduled_at || null) as unknown as string,
        score: form.score || '',
      }
      if (isEdit) {
        await matchesApi.update(Number(id), payload)
      } else {
        await matchesApi.create(payload as MatchFormData)
      }
      navigate('/matches')
    } catch (err: unknown) {
      const apiErr = err as { data?: MatchApiErrors }
      if (apiErr.data) setErrors(apiErr.data)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="state-msg">Загрузка…</p>

  return (
    <div className="form-page">
      <h1 className="page-title">{isEdit ? 'Редактировать матч' : 'Новый матч'}</h1>

      <form className="form-card" onSubmit={handleSubmit} noValidate>

        <div className="form-row">
          <FormField as="select" label="Турнир" required
            value={String(form.tournament)}
            onChange={e => set('tournament', Number(e.target.value) || '')}
            error={errors.tournament}
          >
            <option value="">— выбрать —</option>
            {tournaments.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} {t.kind === 'doubles' ? '(парный)' : ''}
              </option>
            ))}
          </FormField>

          <FormField
            label="Раунд" type="number" min={1} required
            value={form.round_number}
            onChange={e => set('round_number', Number(e.target.value))}
            error={errors.round_number}
          />

          <FormField
            label="Дата и время" type="datetime-local"
            value={form.scheduled_at}
            onChange={e => set('scheduled_at', e.target.value)}
            error={errors.scheduled_at}
          />
        </div>

        <div className="form-row">
          <FormField as="select" label="Категория" required
            value={form.gender_type}
            onChange={e => set('gender_type', e.target.value as MatchFormData['gender_type'])}
            error={errors.gender_type}
          >
            {CATEGORIES
              .filter(c => !selectedTournament || c.kind === selectedTournament.kind)
              .map(c => <option key={c.value} value={c.gender}>{c.label}</option>)}
          </FormField>

          <FormField as="select" label="Статус"
            value={form.status}
            onChange={e => set('status', e.target.value as MatchFormData['status'])}
            error={errors.status}
          >
            <option value="scheduled">Запланирован</option>
            <option value="in_progress">Идёт</option>
            <option value="finished">Завершён</option>
            <option value="walkover">Тех. поражение</option>
          </FormField>
        </div>

        {/* ── Одиночный: 2 игрока ────────────────────────────────────────── */}
        {!isDoubles && (
          <div className="form-row">
            <FormField as="select" label="Игрок 1" required
              value={String(form.player1)}
              onChange={e => set('player1', Number(e.target.value) || '')}
              error={errors.player1}
            >
              <option value="">— выбрать —</option>
              {playerOptions(form.player1)}
            </FormField>

            <FormField as="select" label="Игрок 2" required
              value={String(form.player2)}
              onChange={e => set('player2', Number(e.target.value) || '')}
              error={errors.player2}
            >
              <option value="">— выбрать —</option>
              {playerOptions(form.player2)}
            </FormField>
          </div>
        )}

        {/* ── Парный: 2 пары ─────────────────────────────────────────────── */}
        {isDoubles && (
          <>
            <fieldset className="pair-fieldset">
              <legend className="pair-legend">Пара 1</legend>
              <div className="form-row">
                <FormField as="select" label="Игрок 1" required
                  value={String(form.player1)}
                  onChange={e => set('player1', Number(e.target.value) || '')}
                  error={errors.player1}
                >
                  <option value="">— выбрать —</option>
                  {playerOptions(form.player1)}
                </FormField>

                <FormField as="select" label="Игрок 2" required
                  value={String(form.pair1_player2)}
                  onChange={e => set('pair1_player2', Number(e.target.value) || '')}
                  error={errors.pair1_player2}
                >
                  <option value="">— выбрать —</option>
                  {playerOptions(form.pair1_player2)}
                </FormField>
              </div>
            </fieldset>

            <fieldset className="pair-fieldset">
              <legend className="pair-legend">Пара 2</legend>
              <div className="form-row">
                <FormField as="select" label="Игрок 1" required
                  value={String(form.player2)}
                  onChange={e => set('player2', Number(e.target.value) || '')}
                  error={errors.player2}
                >
                  <option value="">— выбрать —</option>
                  {playerOptions(form.player2)}
                </FormField>

                <FormField as="select" label="Игрок 2" required
                  value={String(form.pair2_player2)}
                  onChange={e => set('pair2_player2', Number(e.target.value) || '')}
                  error={errors.pair2_player2}
                >
                  <option value="">— выбрать —</option>
                  {playerOptions(form.pair2_player2)}
                </FormField>
              </div>
            </fieldset>
          </>
        )}

        {/* ── Результат ──────────────────────────────────────────────────── */}
        {showResult && (
          <div className="form-row">
            <FormField as="select" label={isDoubles ? 'Победившая пара' : 'Победитель'}
              value={String(form.winner ?? '')}
              onChange={e => set('winner', Number(e.target.value) || null)}
              error={errors.winner}
            >
              <option value="">— не выбран —</option>
              {isDoubles ? (
                <>
                  {p1 && (
                    <option value={p1.id}>
                      Пара 1: {playerName(p1)}{players.find(p => p.id === form.pair1_player2) ? ` / ${playerName(players.find(p => p.id === form.pair1_player2)!)}` : ''}
                    </option>
                  )}
                  {p2 && (
                    <option value={p2.id}>
                      Пара 2: {playerName(p2)}{players.find(p => p.id === form.pair2_player2) ? ` / ${playerName(players.find(p => p.id === form.pair2_player2)!)}` : ''}
                    </option>
                  )}
                </>
              ) : (
                captains.map(p => (
                  <option key={p.id} value={p.id}>{playerName(p)}</option>
                ))
              )}
            </FormField>

            <FormField
              label="Счёт" placeholder="6:4 7:5"
              value={form.score}
              onChange={e => set('score', e.target.value)}
              error={errors.score}
            />
          </div>
        )}

        {errors.non_field_errors && (
          <p className="form-error-global">{errors.non_field_errors.join(' ')}</p>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/matches')}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать матч'}
          </button>
        </div>
      </form>
    </div>
  )
}
