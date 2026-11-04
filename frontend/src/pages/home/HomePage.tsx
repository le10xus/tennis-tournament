import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { playersApi, tournamentsApi } from '../../api'
import type { Player, TournamentListItem } from '../../types'
import './HomePage.css'

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge--gray',
  registration: 'badge--blue',
  registration_closed: 'badge--yellow',
  in_progress: 'badge--green',
  summing_up: 'badge--blue',
  finished: 'badge--neutral',
}

type GenderTab = 'male' | 'female'
type DisciplineTab = 'singles' | 'doubles'

export function HomePage() {
  const [nearestTournament, setNearestTournament] = useState<TournamentListItem | null>(null)
  const [tournamentLoading, setTournamentLoading] = useState(true)

  const [malePlayers, setMalePlayers] = useState<Player[]>([])
  const [femalePlayers, setFemalePlayers] = useState<Player[]>([])
  const [playersLoading, setPlayersLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<GenderTab>('male')
  const [activeDiscipline, setActiveDiscipline] = useState<DisciplineTab>('singles')

  useEffect(() => {
    Promise.all([
      tournamentsApi.list({ status: 'registration', page_size: '50' }),
      tournamentsApi.list({ status: 'registration_closed', page_size: '50' }),
      tournamentsApi.list({ status: 'in_progress', page_size: '50' }),
      tournamentsApi.list({ status: 'summing_up', page_size: '50' }),
    ])
      .then(([reg, closed, inProgress, summingUp]) => {
        const all = [...reg.results, ...closed.results, ...inProgress.results, ...summingUp.results]
        const today = new Date().toISOString().slice(0, 10)
        const activeStatuses = ['registration_closed', 'in_progress', 'summing_up']
        const upcoming = all
          .filter(t => t.start_date >= today || activeStatuses.includes(t.status))
          .sort((a, b) => a.start_date.localeCompare(b.start_date))
        setNearestTournament(upcoming[0] ?? null)
      })
      .finally(() => setTournamentLoading(false))

    Promise.all([
      playersApi.list({ gender: 'male', page_size: '500' }),
      playersApi.list({ gender: 'female', page_size: '500' }),
    ])
      .then(([male, female]) => {
        setMalePlayers(male.results)
        setFemalePlayers(female.results)
      })
      .finally(() => setPlayersLoading(false))
  }, [])

  const disciplinePoints = (p: Player) =>
    activeDiscipline === 'singles' ? p.points_singles : p.points_doubles
  const players = (activeTab === 'male' ? malePlayers : femalePlayers)
    .filter(disciplinePoints)
    .sort((a, b) => disciplinePoints(b) - disciplinePoints(a))
    .slice(0, 10)

  return (
    <div className="home-page">
      <div className="home-grid">

        {/* ── Ближайший турнир ── */}
        <div className="home-card">
          <h2 className="home-card__title">Ближайший турнир</h2>

          {tournamentLoading && <p className="state-msg">Загрузка…</p>}

          {!tournamentLoading && !nearestTournament && (
            <p className="state-msg">Активных турниров нет.</p>
          )}

          {!tournamentLoading && nearestTournament && (
            <div className="nearest-tournament">
              <div className="nearest-tournament__header">
                <Link
                  to={`/tournaments/${nearestTournament.id}`}
                  className="nearest-tournament__name"
                >
                  {nearestTournament.name}
                </Link>
                <span className={`badge ${STATUS_BADGE[nearestTournament.status] ?? ''}`}>
                  {nearestTournament.status_display}
                </span>
              </div>

              <div className="nearest-tournament__meta">
                <MetaRow icon="📅" label={formatDate(nearestTournament.start_date, nearestTournament.end_date)} />
                {nearestTournament.location && (
                  <MetaRow icon="📍" label={nearestTournament.location} />
                )}
                <MetaRow icon="🎾" label={`${nearestTournament.kind_display} · ${nearestTournament.format_display}`} />
                <MetaRow icon="👤" label={nearestTournament.gender_type_display} />
                <MetaRow
                  icon="👥"
                  label={`${nearestTournament.players_count} / ${nearestTournament.max_players} участников`}
                />
              </div>

              {nearestTournament.description && (
                <p className="nearest-tournament__desc">{nearestTournament.description}</p>
              )}

              <Link
                to={`/tournaments/${nearestTournament.id}`}
                className="btn btn-primary nearest-tournament__btn"
              >
                Подробнее
              </Link>
            </div>
          )}
        </div>

        {/* ── Топ-10 игроков ── */}
        <div className="home-card">
          <h2 className="home-card__title">Топ-10 рейтинг</h2>

          <div className="tab-bar">
            <button
              type="button"
              className={`tab-btn ${activeTab === 'male' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('male')}
            >
              Мужской
            </button>
            <button
              type="button"
              className={`tab-btn ${activeTab === 'female' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveTab('female')}
            >
              Женский
            </button>
          </div>

          <div className="tab-bar tab-bar--discipline">
            <button
              type="button"
              className={`tab-btn ${activeDiscipline === 'singles' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveDiscipline('singles')}
            >
              Одиночный
            </button>
            <button
              type="button"
              className={`tab-btn ${activeDiscipline === 'doubles' ? 'tab-btn--active' : ''}`}
              onClick={() => setActiveDiscipline('doubles')}
            >
              Парный
            </button>
          </div>

          {playersLoading && <p className="state-msg">Загрузка…</p>}

          {!playersLoading && players.length === 0 && (
            <p className="state-msg">Игроков пока нет.</p>
          )}

          {!playersLoading && players.length > 0 && (
            <ol className="rating-list">
              {players.map((p, i) => (
                <li key={p.id} className="rating-list__item">
                  <span className="rating-list__rank">{i + 1}</span>
                  <Link to={`/players/${p.id}`} className="rating-list__name player-ref-link">
                    {p.last_name} {p.first_name}
                  </Link>
                  <span className="rating-list__score">{disciplinePoints(p)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>

      </div>
    </div>
  )
}

function MetaRow({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="meta-row">
      <span className="meta-row__icon">{icon}</span>
      <span className="meta-row__label">{label}</span>
    </div>
  )
}

function formatDate(start: string, end: string | null): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  return end ? `${fmt(start)} — ${fmt(end)}` : fmt(start)
}
