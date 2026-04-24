import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { matchesApi, playersApi, tournamentsApi } from '../../api'
import { FormField } from '../../components/FormField'
import type { MatchApiErrors, MatchFormData, Player, TournamentBrief } from '../../types'
import { playerName } from './matchUtils'

const EMPTY: MatchFormData = {
  tournament: '',
  gender_type: 'male',
  player1: '',
  player2: '',
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
  const [tournaments, setTournaments] = useState<TournamentBrief[]>([])

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
          player2: m.player2,
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
      // сбросить winner если сменили игроков
      if ((field === 'player1' || field === 'player2') && next.winner) {
        if (next.winner !== next.player1 && next.winner !== next.player2) {
          next.winner = null
        }
      }
      return next
    })
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  const showResult = FINISHED_STATUSES.has(form.status)
  const p1 = players.find(p => p.id === form.player1)
  const p2 = players.find(p => p.id === form.player2)
  const participants = [p1, p2].filter(Boolean) as Player[]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const payload = {
        ...form,
        scheduled_at: form.scheduled_at || null,
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
              <option key={t.id} value={t.id}>{t.name}</option>
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
          <FormField as="select" label="Тип" required
            value={form.gender_type}
            onChange={e => set('gender_type', e.target.value as MatchFormData['gender_type'])}
            error={errors.gender_type}
          >
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
            <option value="mixed">Микст</option>
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

        <div className="form-row">
          <FormField as="select" label="Игрок 1" required
            value={String(form.player1)}
            onChange={e => set('player1', Number(e.target.value) || '')}
            error={errors.player1}
          >
            <option value="">— выбрать —</option>
            {players.map(p => (
              <option key={p.id} value={p.id} disabled={p.id === form.player2}>
                {p.last_name} {p.first_name} ({p.rating})
              </option>
            ))}
          </FormField>

          <FormField as="select" label="Игрок 2" required
            value={String(form.player2)}
            onChange={e => set('player2', Number(e.target.value) || '')}
            error={errors.player2}
          >
            <option value="">— выбрать —</option>
            {players.map(p => (
              <option key={p.id} value={p.id} disabled={p.id === form.player1}>
                {p.last_name} {p.first_name} ({p.rating})
              </option>
            ))}
          </FormField>
        </div>

        {showResult && (
          <div className="form-row">
            <FormField as="select" label="Победитель"
              value={String(form.winner ?? '')}
              onChange={e => set('winner', Number(e.target.value) || null)}
              error={errors.winner}
            >
              <option value="">— не выбран —</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>
                  {playerName(p)}
                </option>
              ))}
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
