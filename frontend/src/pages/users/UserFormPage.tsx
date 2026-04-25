import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usersApi } from '../../api'
import { FormField } from '../../components/FormField'
import type { UserApiErrors, UserFormData } from '../../types'

const EMPTY: UserFormData = {
  username: '',
  password: '',
  email: '',
  first_name: '',
  last_name: '',
  role: 'player',
  is_staff: false,
  is_active: true,
}

export function UserFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState<UserFormData>(EMPTY)
  const [errors, setErrors] = useState<UserApiErrors>({})
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isEdit) return
    usersApi.get(Number(id))
      .then(u => setForm({
        username: u.username,
        password: '',
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
        role: u.role,
        is_staff: u.is_staff,
        is_active: u.is_active,
      }))
      .catch(() => navigate('/users'))
      .finally(() => setLoading(false))
  }, [id, isEdit, navigate])

  function set<K extends keyof UserFormData>(field: K, value: UserFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const payload = { ...form }
      // при редактировании не отправляем пустой пароль
      if (isEdit && !payload.password) {
        delete (payload as Partial<UserFormData>).password
      }
      if (isEdit) {
        await usersApi.update(Number(id), payload)
      } else {
        await usersApi.create(payload)
      }
      navigate('/users')
    } catch (err: unknown) {
      const apiErr = err as { data?: UserApiErrors }
      if (apiErr.data) setErrors(apiErr.data)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="state-msg">Загрузка…</p>

  return (
    <div className="form-page">
      <h1 className="page-title">{isEdit ? 'Редактировать пользователя' : 'Новый пользователь'}</h1>

      <form className="form-card" onSubmit={handleSubmit} noValidate>

        <div className="form-row">
          <FormField
            label="Логин" required
            value={form.username}
            onChange={e => set('username', e.target.value)}
            error={errors.username}
            autoFocus
          />
          <FormField
            label={isEdit ? 'Новый пароль (оставьте пустым чтобы не менять)' : 'Пароль'}
            type="password"
            required={!isEdit}
            value={form.password}
            onChange={e => set('password', e.target.value)}
            error={errors.password}
          />
        </div>

        <div className="form-row">
          <FormField
            label="Имя"
            value={form.first_name}
            onChange={e => set('first_name', e.target.value)}
            error={errors.first_name}
          />
          <FormField
            label="Фамилия"
            value={form.last_name}
            onChange={e => set('last_name', e.target.value)}
            error={errors.last_name}
          />
        </div>

        <FormField
          label="Email" type="email"
          value={form.email}
          onChange={e => set('email', e.target.value)}
          error={errors.email}
        />

        <div className="form-row">
          <FormField as="select" label="Роль" required
            value={form.role}
            onChange={e => set('role', e.target.value as UserFormData['role'])}
            error={errors.role}
          >
            <option value="player">Игрок (только просмотр)</option>
            <option value="organizer">Организатор (создание и редактирование)</option>
          </FormField>

          <div className="field">
            <label className="field-label">Права</label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.is_staff}
                onChange={e => set('is_staff', e.target.checked)}
              />
              Администратор (полный доступ)
            </label>
          </div>

          <div className="field">
            <label className="field-label">Аккаунт</label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={e => set('is_active', e.target.checked)}
              />
              Активен
            </label>
          </div>
        </div>

        {errors.non_field_errors && (
          <p className="form-error-global">{errors.non_field_errors.join(' ')}</p>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/users')}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать пользователя'}
          </button>
        </div>
      </form>
    </div>
  )
}
