import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import './AppShell.css'

export function AppShell() {
  const { username, logout } = useAuth()
  const navigate = useNavigate()

  function onLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="shell">
      <nav className="nav">
        <span className="nav-brand">🎾 Tennis Tournament</span>
        <div className="nav-links">
          <NavLink to="/players" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Игроки
          </NavLink>
          <NavLink to="/tournaments" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Турниры
          </NavLink>
          <NavLink to="/matches" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            Матчи
          </NavLink>
        </div>
        <div className="nav-user">
          {username && <span className="nav-username">{username}</span>}
          <button type="button" className="btn btn-ghost nav-logout" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
