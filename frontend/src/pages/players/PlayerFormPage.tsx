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
  birth_date: '',
  gender: 'male',
  rating: 1000,
  rating_type: 'elo',
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
        birth_date: p.birth_date ?? '',
        gender: p.gender,
        rating: p.rating,
        rating_type: p.rating_type,
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
      const payload = { ...form, birth_date: (form.birth_date || null) as unknown as string }
      if (isEdit) {
        await playersApi.update(Number(id), payload)
      } else {
        await playersApi.create({ ...form, birth_date: form.birth_date || '' })
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
            value={form.birth_date}
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
