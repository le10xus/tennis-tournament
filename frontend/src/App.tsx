import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { PlayerListPage } from './pages/players/PlayerListPage'
import { PlayerPage } from './pages/players/PlayerPage'
import { PlayerFormPage } from './pages/players/PlayerFormPage'
import { MatchListPage } from './pages/matches/MatchListPage'
import { MatchFormPage } from './pages/matches/MatchFormPage'
import { TournamentListPage } from './pages/tournaments/TournamentListPage'
import { TournamentPage } from './pages/tournaments/TournamentPage'
import { TournamentFormPage } from './pages/tournaments/TournamentFormPage'
import { TournamentBracketPage } from './pages/tournaments/TournamentBracketPage'
import { UserListPage } from './pages/users/UserListPage'
import { UserFormPage } from './pages/users/UserFormPage'
import { LoginPage } from './pages/auth/LoginPage'
import { AuthProvider } from './auth/AuthContext'
import { RequireAuth } from './auth/RequireAuth'
import { RequireEdit } from './auth/RequireEdit'
import { RequireAdmin } from './auth/RequireAdmin'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Все маршруты требуют аутентификации */}
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/players" replace />} />

              <Route path="players">
                <Route index element={<PlayerListPage />} />
                <Route path=":id" element={<PlayerPage />} />
                {/* Создание и редактирование — только organizer + admin */}
                <Route element={<RequireEdit />}>
                  <Route path="new" element={<PlayerFormPage />} />
                  <Route path=":id/edit" element={<PlayerFormPage />} />
                </Route>
              </Route>

              <Route path="tournaments">
                <Route index element={<TournamentListPage />} />
                <Route path=":id" element={<TournamentPage />} />
                <Route path=":id/bracket" element={<TournamentBracketPage />} />
                <Route element={<RequireEdit />}>
                  <Route path="new" element={<TournamentFormPage />} />
                  <Route path=":id/edit" element={<TournamentFormPage />} />
                </Route>
              </Route>

              <Route path="matches">
                <Route index element={<MatchListPage />} />
                <Route element={<RequireEdit />}>
                  <Route path="new" element={<MatchFormPage />} />
                  <Route path=":id/edit" element={<MatchFormPage />} />
                </Route>
              </Route>

              {/* Управление пользователями — только admin */}
              <Route element={<RequireAdmin />}>
                <Route path="users">
                  <Route index element={<UserListPage />} />
                  <Route path="new" element={<UserFormPage />} />
                  <Route path=":id/edit" element={<UserFormPage />} />
                </Route>
              </Route>

            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
