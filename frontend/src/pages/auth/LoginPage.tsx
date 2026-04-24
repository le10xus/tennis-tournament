import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import { useAuth } from '../../auth/AuthContext'
import './LoginPage.css'

interface LocationState {
  from?: string
}

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LocationState | null)?.from ?? '/players'

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await auth.login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      const status = (err as { status?: number }).status
      if (status === 401) setError('Неверный логин или пароль')
      else setError('Не удалось войти. Попробуйте позже.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-header">
          <span className="login-brand">🎾 Tennis Tournament</span>
          <h1 className="login-title">Вход в систему</h1>
        </div>

        {error && <p className="form-error-global">{error}</p>}

        <FormField
          label="Логин"
          required
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={submitting}
        />

        <FormField
          label="Пароль"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
        />

        <button
          type="submit"
          className="btn btn-primary login-submit"
          disabled={submitting || !username || !password}
        >
          {submitting ? 'Входим…' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
