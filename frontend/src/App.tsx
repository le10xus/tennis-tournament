import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { HomePage } from './pages/home/HomePage'
import { PlayerListPage } from './pages/players/PlayerListPage'
import { PlayerPage } from './pages/players/PlayerPage'
import { PlayerFormPage } from './pages/players/PlayerFormPage'
import { MatchListPage } from './pages/matches/MatchListPage'
import { MatchPage } from './pages/matches/MatchPage'
import { MatchFormPage } from './pages/matches/MatchFormPage'
import { TournamentListPage } from './pages/tournaments/TournamentListPage'
import { TournamentPage } from './pages/tournaments/TournamentPage'
import { TournamentFormPage } from './pages/tournaments/TournamentFormPage'
import { TournamentBracketPage } from './pages/tournaments/TournamentBracketPage'
import { SummaryPage } from './pages/tournaments/SummaryPage'
import { HeadToHeadPage } from './pages/stats/HeadToHeadPage'
import { UserListPage } from './pages/users/UserListPage'
import { UserFormPage } from './pages/users/UserFormPage'
import { AuthProvider } from './auth/AuthContext'
import { RequireEdit } from './auth/RequireEdit'
import { RequireAdmin } from './auth/RequireAdmin'
import { RequireAuth } from './auth/RequireAuth'
import { ProfilePage } from './pages/profile/ProfilePage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<HomePage />} />

            <Route path="players">
              <Route index element={<PlayerListPage />} />
              <Route path=":id" element={<PlayerPage />} />
              <Route element={<RequireEdit />}>
                <Route path="new" element={<PlayerFormPage />} />
                <Route path=":id/edit" element={<PlayerFormPage />} />
              </Route>
            </Route>

            <Route path="tournaments">
              <Route index element={<TournamentListPage />} />
              <Route path=":id" element={<TournamentPage />} />
              <Route path=":id/bracket" element={<TournamentBracketPage />} />
              <Route path=":id/summary" element={<SummaryPage />} />
              <Route element={<RequireEdit />}>
                <Route path="new" element={<TournamentFormPage />} />
                <Route path=":id/edit" element={<TournamentFormPage />} />
              </Route>
            </Route>

            <Route path="head-to-head" element={<HeadToHeadPage />} />

            <Route path="matches">
              <Route index element={<MatchListPage />} />
              <Route path=":id" element={<MatchPage />} />
              <Route element={<RequireEdit />}>
                <Route path="new" element={<MatchFormPage />} />
                <Route path=":id/edit" element={<MatchFormPage />} />
              </Route>
            </Route>

            <Route element={<RequireAuth />}>
              <Route path="profile" element={<ProfilePage />} />
            </Route>

            <Route element={<RequireAdmin />}>
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
