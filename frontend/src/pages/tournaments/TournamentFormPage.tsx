import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { tournamentsApi } from '../../api'
import { FormField } from '../../components/FormField'
import type { TournamentApiErrors, TournamentFormData } from '../../types'
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
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    tournamentsApi.get(Number(id))
      .then(t => setForm({
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
      .catch(() => navigate('/tournaments'))
      .finally(() => setLoading(false))
  }, [id, isEdit, navigate])

  function set<K extends keyof TournamentFormData>(field: K, value: TournamentFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      // end_date — пустая строка в форме, null на сервере
      const payload = { ...form, end_date: (form.end_date || null) as unknown as string }
      if (isEdit) {
        await tournamentsApi.update(Number(id), payload)
      } else {
        await tournamentsApi.create(payload)
      }
      navigate('/tournaments')
    } catch (err: unknown) {
      const apiErr = err as { data?: TournamentApiErrors }
      if (apiErr.data) setErrors(apiErr.data)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="state-msg">Загрузка…</p>

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
          <FormField as="select" label="Разряд" required
            value={form.kind}
            onChange={e => set('kind', e.target.value)}
            error={errors.kind}
          >
            <option value="singles">Одиночный</option>
            <option value="doubles">Парный</option>
          </FormField>

          <FormField as="select" label="Категория" required
            value={form.gender_type}
            onChange={e => set('gender_type', e.target.value)}
            error={errors.gender_type}
          >
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
            <option value="mixed">Смешанный</option>
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
    </div>
  )
}
