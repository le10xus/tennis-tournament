import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { PlayerListPage } from './pages/players/PlayerListPage'
import { PlayerFormPage } from './pages/players/PlayerFormPage'
import { MatchListPage } from './pages/matches/MatchListPage'
import { MatchFormPage } from './pages/matches/MatchFormPage'
import { TournamentListPage } from './pages/tournaments/TournamentListPage'
import { TournamentFormPage } from './pages/tournaments/TournamentFormPage'
import { UserListPage } from './pages/users/UserListPage'
import { UserFormPage } from './pages/users/UserFormPage'
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

              <Route path="tournaments">
                <Route index element={<TournamentListPage />} />
                <Route path="new" element={<TournamentFormPage />} />
                <Route path=":id/edit" element={<TournamentFormPage />} />
              </Route>

              <Route path="users">
                <Route index element={<UserListPage />} />
                <Route path="new" element={<UserFormPage />} />
                <Route path=":id/edit" element={<UserFormPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
