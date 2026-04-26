import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { AuthModal } from './AuthModal'
import './AppShell.css'

export function AppShell() {
  const { username, role, isStaff, isAuthenticated, logout } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  const roleLabel = isStaff ? 'Администратор' : role === 'organizer' ? 'Организатор' : 'Игрок'

  return (
    <div className="shell">
      <nav className="nav">
        <span className="nav-brand">🎾 Tennis Tournament</span>

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
          {isStaff && (
            <NavLink to="/users" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
              Пользователи
            </NavLink>
          )}
        </div>

        <div className="nav-user">
          {isAuthenticated ? (
            <>
              <span className="nav-username">
                {username}
                <span className="nav-role">{roleLabel}</span>
              </span>
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
        </div>
      </nav>

      <main className="content">
        <Outlet />
      </main>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  )
}
