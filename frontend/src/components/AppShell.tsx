import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { applyTheme, resolveTheme, storedTheme, systemTheme, toggleTheme, type Theme } from '../theme'
import { AuthModal } from './AuthModal'
import './AppShell.css'

export function AppShell() {
  const { username, role, isStaff, isAuthenticated, logout } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  const roleLabel = isStaff ? 'Администратор' : role === 'organizer' ? 'Организатор' : 'Игрок'

  return (
    <div className="shell">
      <nav className="nav">
        <span className="nav-brand">
          <img className="nav-brand__logo" src={`${import.meta.env.BASE_URL}bt35-logo.jpg`} alt="" />
          БТ35 тур
        </span>

        <div className="nav-links">
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Главное
          </NavLink>
          <NavLink to="/players" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Рейтинг
          </NavLink>
          <NavLink to="/tournaments" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Турниры
          </NavLink>
          <NavLink to="/head-to-head" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Очные
          </NavLink>
          {isStaff && (
            <NavLink to="/users" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Пользователи
            </NavLink>
          )}
        </div>

        <div className="nav-user">
          {isAuthenticated ? (
            <>
              <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link nav-profile'}>
                {username}
                <span className="nav-role">{roleLabel}</span>
              </NavLink>
              <button type="button" className="btn btn-ghost nav-logout" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-primary nav-logout"
              onClick={() => setShowAuth(true)}
            >
              Войти
            </button>
          )}
          <ThemeToggle />
        </div>
      </nav>

      <main className="content">
        <Outlet />
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => resolveTheme())

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (storedTheme()) return
      const next = systemTheme()
      applyTheme(next)
      setTheme(next)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      title={isDark ? 'Светлая тема' : 'Тёмная тема'}
      onClick={() => setTheme(toggleTheme())}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15.5 3.5a8.2 8.2 0 1 0 5 12.6A7 7 0 0 1 15.5 3.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}
