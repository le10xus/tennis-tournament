import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { PlayerListPage } from './pages/players/PlayerListPage'
import { PlayerFormPage } from './pages/players/PlayerFormPage'
import { MatchListPage } from './pages/matches/MatchListPage'
import { MatchFormPage } from './pages/matches/MatchFormPage'
import { LoginPage } from './pages/auth/LoginPage'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/players" replace />} />

              <Route path="players">
                <Route index element={<PlayerListPage />} />
                <Route path="new" element={<PlayerFormPage />} />
                <Route path=":id/edit" element={<PlayerFormPage />} />
              </Route>

              <Route path="matches">
                <Route index element={<MatchListPage />} />
                <Route path="new" element={<MatchFormPage />} />
                <Route path=":id/edit" element={<MatchFormPage />} />
              </Route>

              <Route path="tournaments" element={<div style={{ padding: '2rem 0', color: 'var(--text)' }}>Страница турниров — в разработке</div>} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
