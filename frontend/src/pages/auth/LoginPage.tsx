import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FormField } from '../../components/FormField'
import { useAuth } from '../../auth/AuthContext'
import './LoginPage.css'

interface LocationState {
  from?: string
}

type Mode = 'login' | 'register'

interface FieldErrors {
  username?: string[]
  password?: string[]
  password_confirm?: string[]
  email?: string[]
  first_name?: string[]
  last_name?: string[]
}

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as LocationState | null)?.from ?? '/players'

  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')

  const [globalError, setGlobalError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setGlobalError(null)
    setFieldErrors({})
    setPasswordConfirm('')
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setGlobalError(null)
    setFieldErrors({})

    if (mode === 'register' && password !== passwordConfirm) {
      setFieldErrors({ password_confirm: ['Пароли не совпадают'] })
      return
    }

    setSubmitting(true)
    try {
      if (mode === 'login') {
        await auth.login(username.trim(), password)
      } else {
        await auth.register({
          username: username.trim(),
          password,
          email: email.trim() || undefined,
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
        })
      }
      navigate(from, { replace: true })
    } catch (err) {
      const e = err as { status?: number; data?: Record<string, string[] | string> }
      if (mode === 'login' && e.status === 401) {
        setGlobalError('Неверный логин или пароль')
      } else if (e.status === 400 && e.data && typeof e.data === 'object') {
        const fe: FieldErrors = {}
        const detailParts: string[] = []
        for (const [key, val] of Object.entries(e.data)) {
          const arr = Array.isArray(val) ? val : [String(val)]
          if (key in { username: 1, password: 1, email: 1, first_name: 1, last_name: 1 }) {
            ;(fe as Record<string, string[]>)[key] = arr
          } else {
            detailParts.push(arr.join(' '))
          }
        }
        setFieldErrors(fe)
        if (detailParts.length) setGlobalError(detailParts.join(' '))
      } else {
        setGlobalError(mode === 'login' ? 'Не удалось войти. Попробуйте позже.' : 'Не удалось зарегистрироваться. Попробуйте позже.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const isRegister = mode === 'register'

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-header">
          <span className="login-brand">🎾 Tennis Tournament</span>
          <h1 className="login-title">{isRegister ? 'Регистрация' : 'Вход в систему'}</h1>
        </div>

        <div className="login-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={`login-tab ${mode === 'login' ? 'login-tab--active' : ''}`}
            onClick={() => switchMode('login')}
          >
            Вход
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className={`login-tab ${mode === 'register' ? 'login-tab--active' : ''}`}
            onClick={() => switchMode('register')}
          >
            Регистрация
          </button>
        </div>

        {globalError && <p className="form-error-global">{globalError}</p>}

        <FormField
          label="Логин"
          required
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          disabled={submitting}
          error={fieldErrors.username}
        />

        {isRegister && (
          <>
            <FormField
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              error={fieldErrors.email}
            />
            <FormField
              label="Имя"
              autoComplete="given-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={submitting}
              error={fieldErrors.first_name}
            />
            <FormField
              label="Фамилия"
              autoComplete="family-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={submitting}
              error={fieldErrors.last_name}
            />
          </>
        )}

        <FormField
          label="Пароль"
          type="password"
          required
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={submitting}
          error={fieldErrors.password}
        />

        {isRegister && (
          <FormField
            label="Повторите пароль"
            type="password"
            required
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={(e) => setPasswordConfirm(e.target.value)}
            disabled={submitting}
            error={fieldErrors.password_confirm}
          />
        )}

        <button
          type="submit"
          className="btn btn-primary login-submit"
          disabled={submitting || !username || !password || (isRegister && !passwordConfirm)}
        >
          {submitting
            ? isRegister ? 'Регистрируем…' : 'Входим…'
            : isRegister ? 'Зарегистрироваться' : 'Войти'}
        </button>
      </form>
    </div>
  )
}
