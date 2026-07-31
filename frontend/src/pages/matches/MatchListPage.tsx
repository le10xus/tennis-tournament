import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { matchesApi, tournamentsApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { DeleteTableAction } from '../../components/TableActionIcon'
import { CATEGORIES, categoryLabel } from '../../utils/categories'
import type { Match, TournamentBrief } from '../../types'
import { statusBadge, playerName } from './matchUtils'

export function MatchListPage() {
  const { canEdit, canDelete } = useAuth()
  const [matches, setMatches] = useState<Match[]>([])
  const [tournaments, setTournaments] = useState<TournamentBrief[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [filterTournament, setFilterTournament] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  useEffect(() => {
    tournamentsApi.list({ page_size: '200' })
      .then(d => setTournaments(d.results))
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    const params: Record<string, string> = {}
    if (filterTournament) params.tournament = filterTournament
    if (filterStatus) params.status = filterStatus
    if (filterCategory) {
      const cat = CATEGORIES.find(c => c.value === filterCategory)
      if (cat) { params.kind = cat.kind; params.gender_type = cat.gender }
    }

    matchesApi.list(params)
      .then(d => { setMatches(d.results); setTotal(d.count) })
      .catch(() => setError('Не удалось загрузить матчи.'))
      .finally(() => setLoading(false))
  }, [filterTournament, filterStatus, filterCategory])

  async function handleDelete(match: Match) {
    const label = `${playerName(match.player1_detail)} vs ${playerName(match.player2_detail)}`
    if (!confirm(`Удалить матч «${label}»?`)) return
    setDeletingId(match.id)
    try {
      await matchesApi.delete(match.id)
      setMatches(prev => prev.filter(m => m.id !== match.id))
      setTotal(prev => prev - 1)
    } catch {
      alert('Не удалось удалить матч.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Матчи</h1>
          {!loading && <p className="page-subtitle">Всего: {total}</p>}
        </div>
        {canEdit && <Link to="/matches/new" className="btn btn-primary">+ Добавить матч</Link>}
      </div>

      <div className="filters">
        <select
          className="filter-select"
          value={filterTournament}
          onChange={e => setFilterTournament(e.target.value)}
        >
          <option value="">Все турниры</option>
          {tournaments.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        <select
          className="filter-select"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="scheduled">Запланирован</option>
          <option value="in_progress">Идёт</option>
          <option value="finished">Завершён</option>
          <option value="walkover">Тех. поражение</option>
        </select>
        <select
          className="filter-select"
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="">Все категории</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {loading && <p className="state-msg">Загрузка…</p>}
      {error && <p className="state-msg state-msg--error">{error}</p>}

      {!loading && !error && matches.length === 0 && (
        <div className="empty-state">
          <p>Матчей пока нет.</p>
          {canEdit && <Link to="/matches/new" className="btn btn-primary">Добавить первый</Link>}
        </div>
      )}

      {matches.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Раунд</th>
                <th>Матч</th>
                <th>Победитель</th>
                <th>Счёт</th>
                <th>Категория</th>
                <th>Статус</th>
                <th>Дата</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {matches.map(m => (
                <tr key={m.id}>
                  <td className="col-center col-secondary">R{m.round_number}</td>
                  <td className="col-name">
                    <Link to={`/matches/${m.id}/edit`} className="player-link">
                      {playerName(m.player1_detail)} vs {playerName(m.player2_detail)}
                    </Link>
                  </td>
                  <td>{m.winner_detail ? playerName(m.winner_detail) : '—'}</td>
                  <td className="col-secondary">{m.score || '—'}</td>
                  <td className="col-secondary">{categoryLabel(m.kind, m.gender_type)}</td>
                  <td>
                    <span className={`badge ${statusBadge(m.status)}`}>
                      {m.status_display}
                    </span>
                  </td>
                  <td className="col-secondary">
                    {m.scheduled_at
                      ? new Date(m.scheduled_at).toLocaleDateString('ru-RU')
                      : '—'}
                  </td>
                  <td className="col-actions">
                    {canDelete && (
                      <DeleteTableAction
                        onClick={() => handleDelete(m)}
                        disabled={deletingId === m.id}
                        label={`Удалить матч ${playerName(m.player1_detail)} — ${playerName(m.player2_detail)}`}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
