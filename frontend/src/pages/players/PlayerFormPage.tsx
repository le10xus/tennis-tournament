import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { playersApi } from '../../api'
import { FormField } from '../../components/FormField'
import type { ApiErrors, PlayerFormData } from '../../types'
import './PlayerFormPage.css'

const EMPTY: PlayerFormData = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  birth_date: null,
  gender: 'male',
  rating: 1000,
  rating_type: 'elo',
  city: '',
  ntrp_singles: '',
  ntrp_doubles: '',
  points_singles: 0,
  points_doubles: 0,
}

export function PlayerFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState<PlayerFormData>(EMPTY)
  const [errors, setErrors] = useState<ApiErrors>({})
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    playersApi.get(Number(id))
      .then(p => setForm({
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        phone: p.phone,
        birth_date: p.birth_date ?? null,
        gender: p.gender,
        rating: p.rating,
        rating_type: p.rating_type,
        city: p.city,
        ntrp_singles: p.ntrp_singles,
        ntrp_doubles: p.ntrp_doubles,
        points_singles: p.points_singles,
        points_doubles: p.points_doubles,
      }))
      .catch(() => navigate('/players'))
      .finally(() => setLoading(false))
  }, [id, isEdit, navigate])

  function set(field: keyof PlayerFormData, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const payload = { ...form }
      if (isEdit) {
        await playersApi.update(Number(id), payload)
      } else {
        await playersApi.create(payload)
      }
      navigate('/players')
    } catch (err: unknown) {
      const apiErr = err as { data?: ApiErrors }
      if (apiErr.data) setErrors(apiErr.data)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="state-msg">Загрузка…</p>

  return (
    <div className="form-page">
      <h1 className="page-title">{isEdit ? 'Редактировать игрока' : 'Новый игрок'}</h1>

      <form className="form-card" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <FormField
            label="Имя" required
            value={form.first_name}
            onChange={e => set('first_name', e.target.value)}
            error={errors.first_name}
            autoFocus
          />
          <FormField
            label="Фамилия" required
            value={form.last_name}
            onChange={e => set('last_name', e.target.value)}
            error={errors.last_name}
          />
        </div>

        <FormField
          label="Email" required type="email"
          value={form.email}
          onChange={e => set('email', e.target.value)}
          error={errors.email}
        />

        <div className="form-row">
          <FormField
            label="Телефон" type="tel"
            value={form.phone}
            onChange={e => set('phone', e.target.value)}
            error={errors.phone}
            placeholder="+7 (999) 000-00-00"
          />
          <FormField
            label="Дата рождения" type="date"
            value={form.birth_date ?? ''}
            onChange={e => set('birth_date', e.target.value)}
            error={errors.birth_date}
          />
        </div>

        <div className="form-row">
          <FormField as="select" label="Пол" required
            value={form.gender}
            onChange={e => set('gender', e.target.value)}
            error={errors.gender}
          >
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </FormField>

          <FormField as="select" label="Тип рейтинга"
            value={form.rating_type}
            onChange={e => set('rating_type', e.target.value)}
            error={errors.rating_type}
          >
            <option value="elo">ELO</option>
            <option value="manual">Ручной</option>
          </FormField>

          <FormField
            label="Рейтинг" type="number" min={0} max={9999}
            value={form.rating}
            onChange={e => set('rating', Number(e.target.value))}
            error={errors.rating}
          />
        </div>

        <div className="form-row">
          <FormField
            label="Город"
            value={form.city}
            onChange={e => set('city', e.target.value)}
            error={errors.city}
          />
          <FormField
            label="NTRP (одиночный)"
            value={form.ntrp_singles}
            onChange={e => set('ntrp_singles', e.target.value)}
            error={errors.ntrp_singles}
            placeholder="3.70 или 4+"
          />
          <FormField
            label="NTRP (парный)"
            value={form.ntrp_doubles}
            onChange={e => set('ntrp_doubles', e.target.value)}
            error={errors.ntrp_doubles}
            placeholder="3.70 или 4+"
          />
        </div>

        <div className="form-row">
          <FormField
            label="Очки (одиночный)" type="number" min={0}
            value={form.points_singles}
            onChange={e => set('points_singles', Number(e.target.value))}
            error={errors.points_singles}
          />
          <FormField
            label="Очки (парный)" type="number" min={0}
            value={form.points_doubles}
            onChange={e => set('points_doubles', Number(e.target.value))}
            error={errors.points_doubles}
          />
        </div>

        {errors.non_field_errors && (
          <p className="form-error-global">{errors.non_field_errors.join(' ')}</p>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/players')}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать игрока'}
          </button>
        </div>
      </form>
    </div>
  )
}
