import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usersApi } from '../../api'
import { FormField } from '../../components/FormField'
import type { Profile, ProfileApiErrors, ProfileFormData } from '../../types'

const EMPTY: ProfileFormData = {
  first_name: '',
  last_name: '',
  password: '',
}

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<ProfileFormData>(EMPTY)
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [errors, setErrors] = useState<ProfileApiErrors>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    usersApi.getMe()
      .then((data) => {
        setProfile(data)
        setForm({
          first_name: data.first_name,
          last_name: data.last_name,
          password: '',
        })
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false))
  }, [])

  function set<K extends keyof ProfileFormData>(field: K, value: ProfileFormData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
    setErrors(prev => ({ ...prev, [field]: undefined }))
    setSaved(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setSaved(false)

    if (form.password && form.password !== passwordConfirm) {
      setErrors({ password: ['Пароли не совпадают'] })
      return
    }

    setSaving(true)
    try {
      const payload: Partial<ProfileFormData> = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
      }
      if (form.password) {
        payload.password = form.password
      }

      const updated = await usersApi.updateMe(payload)
      setProfile(updated)
      setForm(prev => ({ ...prev, password: '' }))
      setPasswordConfirm('')
      setSaved(true)
    } catch (err: unknown) {
      const apiErr = err as { data?: ProfileApiErrors }
      if (apiErr.data) setErrors(apiErr.data)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="state-msg">Загрузка…</p>

  if (!profile) {
    return (
      <div className="empty-state">
        <p>Не удалось загрузить профиль.</p>
        <Link to="/" className="btn btn-ghost">← На главную</Link>
      </div>
    )
  }

  const roleLabel = profile.is_staff
    ? 'Администратор'
    : profile.role === 'organizer'
      ? 'Организатор'
      : 'Игрок'

  return (
    <div className="form-page">
      <h1 className="page-title">Мой профиль</h1>

      <div className="form-card" style={{ marginBottom: '1rem' }}>
        <div className="form-row">
          <div className="field">
            <span className="field-label">Логин</span>
            <p>{profile.username}</p>
          </div>
          <div className="field">
            <span className="field-label">Роль</span>
            <p>{roleLabel}</p>
          </div>
        </div>
      </div>

      <form className="form-card" onSubmit={handleSubmit} noValidate>
        <div className="form-row">
          <FormField
            label="Имя"
            autoComplete="given-name"
            value={form.first_name}
            onChange={e => set('first_name', e.target.value)}
            error={errors.first_name}
            autoFocus
          />
          <FormField
            label="Фамилия"
            autoComplete="family-name"
            value={form.last_name}
            onChange={e => set('last_name', e.target.value)}
            error={errors.last_name}
          />
        </div>

        <div className="form-row">
          <FormField
            label="Новый пароль"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            error={errors.password}
          />
          <FormField
            label="Повторите пароль"
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={e => {
              setPasswordConfirm(e.target.value)
              setSaved(false)
            }}
          />
        </div>

        <p className="seed-hint">
          Оставьте поля пароля пустыми, если менять пароль не нужно.
        </p>

        {errors.non_field_errors && (
          <p className="form-error-global">{errors.non_field_errors.join(' ')}</p>
        )}

        {saved && (
          <p className="form-success" style={{ color: 'var(--accent)', marginBottom: '0.75rem' }}>
            Изменения сохранены.
          </p>
        )}

        <div className="form-actions">
          <Link to="/" className="btn btn-ghost">← Назад</Link>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  )
}
