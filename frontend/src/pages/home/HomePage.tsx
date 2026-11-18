import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { playersApi, tournamentsApi } from '../../api'
import { TournamentCalendar } from '../../components/TournamentCalendar'
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

const NEAREST_STATUSES = ['registration', 'registration_closed', 'in_progress', 'summing_up']
const ACTIVE_NEAREST = ['registration_closed', 'in_progress', 'summing_up']

async function loadAllTournaments(): Promise<TournamentListItem[]> {
  const pageSize = 500
  const first = await tournamentsApi.list({ page_size: String(pageSize) })
  if (first.count <= first.results.length) return first.results
  const pages = Math.ceil(first.count / pageSize)
  const rest = await Promise.all(
    Array.from({ length: pages - 1 }, (_, index) =>
      tournamentsApi.list({ page_size: String(pageSize), page: String(index + 2) }),
    ),
  )
  return [...first.results, ...rest.flatMap(page => page.results)]
}

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function HomePage() {
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([])
  const [nearestTournament, setNearestTournament] = useState<TournamentListItem | null>(null)
  const [tournamentLoading, setTournamentLoading] = useState(true)

  const [malePlayers, setMalePlayers] = useState<Player[]>([])
  const [femalePlayers, setFemalePlayers] = useState<Player[]>([])
  const [playersLoading, setPlayersLoading] = useState(true)

  const [activeTab, setActiveTab] = useState<GenderTab>('male')
  const [activeDiscipline, setActiveDiscipline] = useState<DisciplineTab>('singles')

  useEffect(() => {
    let cancelled = false
    loadAllTournaments()
      .then(all => {
        if (cancelled) return
        setTournaments(all)
        const today = todayIso()
        const upcoming = all
          .filter(t => NEAREST_STATUSES.includes(t.status))
          .filter(t => t.start_date >= today || ACTIVE_NEAREST.includes(t.status))
          .sort((a, b) => a.start_date.localeCompare(b.start_date) || a.id - b.id)
        setNearestTournament(upcoming[0] ?? null)
      })
      .finally(() => {
        if (!cancelled) setTournamentLoading(false)
      })

    Promise.all([
      playersApi.list({ gender: 'male', page_size: '500' }),
      playersApi.list({ gender: 'female', page_size: '500' }),
    ])
      .then(([male, female]) => {
        if (cancelled) return
        setMalePlayers(male.results)
        setFemalePlayers(female.results)
      })
      .finally(() => {
        if (!cancelled) setPlayersLoading(false)
      })

    return () => {
      cancelled = true
    }
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
        <div className="home-col">
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

        <div className="home-card">
          <h2 className="home-card__title">Календарь</h2>
          <TournamentCalendar tournaments={tournaments} loading={tournamentLoading} />
        </div>
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
