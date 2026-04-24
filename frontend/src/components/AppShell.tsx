import { NavLink, Outlet } from 'react-router-dom'
import './AppShell.css'

export function AppShell() {
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
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}
