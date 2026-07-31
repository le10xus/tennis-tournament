import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { tournamentsApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { DeleteTableAction, EditTableAction } from '../../components/TableActionIcon'
import { CATEGORIES, categoryLabel } from '../../utils/categories'
import type { Tournament } from '../../types'
import './TournamentListPage.css'

const STATUS_OPTIONS = [
  { value: '', label: 'Все статусы' },
  { value: 'draft', label: 'Черновик' },
  { value: 'registration', label: 'Регистрация' },
  { value: 'in_progress', label: 'Идёт' },
  { value: 'finished', label: 'Завершён' },
]

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge--gray',
  registration: 'badge--blue',
  in_progress: 'badge--green',
  finished: 'badge--neutral',
}

export function TournamentListPage() {
  const { canEdit, canDelete } = useAuth()
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  function load(status: string, category: string) {
    setLoading(true)
    setError(null)
    const params: Record<string, string> = {}
    if (status) params.status = status
    if (category) {
      const cat = CATEGORIES.find(c => c.value === category)
      if (cat) { params.kind = cat.kind; params.gender_type = cat.gender }
    }
    tournamentsApi.list(params)
      .then(data => { setTournaments(data.results); setTotal(data.count) })
      .catch(() => setError('Не удалось загрузить список турниров.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load('', '') }, [])

  function applyFilters(status: string, category: string) {
    setFilterStatus(status)
    setFilterCategory(category)
    load(status, category)
  }

  async function handleDelete(t: Tournament) {
    if (!confirm(`Удалить турнир «${t.name}»?`)) return
    setDeletingId(t.id)
    try {
      await tournamentsApi.delete(t.id)
      setTournaments(prev => prev.filter(x => x.id !== t.id))
      setTotal(prev => prev - 1)
    } catch {
      alert('Не удалось удалить турнир.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Турниры</h1>
          {!loading && <p className="page-subtitle">Всего: {total}</p>}
        </div>
        {canEdit && <Link to="/tournaments/new" className="btn btn-primary">+ Создать турнир</Link>}
      </div>

      <div className="filters">
        <select
          className="filter-select"
          value={filterStatus}
          onChange={e => applyFilters(e.target.value, filterCategory)}
        >
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="filter-select"
          value={filterCategory}
          onChange={e => applyFilters(filterStatus, e.target.value)}
        >
          <option value="">Все категории</option>
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {loading && <p className="state-msg">Загрузка…</p>}
      {error && <p className="state-msg state-msg--error">{error}</p>}

      {!loading && !error && tournaments.length === 0 && (
        <div className="empty-state">
          <p>Турниров пока нет.</p>
          <Link to="/tournaments/new" className="btn btn-primary">Создать первый</Link>
        </div>
      )}

      {tournaments.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Статус</th>
                <th>Категория</th>
                <th>Формат</th>
                <th>Дата начала</th>
                <th>Место</th>
                <th className="col-num">Игроков</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map(t => (
                <tr key={t.id}>
                  <td className="col-name">
                    <Link to={`/tournaments/${t.id}`} className="tournament-link">
                      {t.name}
                    </Link>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[t.status] ?? ''}`}>
                      {t.status_display}
                    </span>
                  </td>
                  <td>{categoryLabel(t.kind, t.gender_type)}</td>
                  <td className="col-secondary">{t.format_display}</td>
                  <td className="col-secondary">{t.start_date}</td>
                  <td className="col-secondary">{t.location || '—'}</td>
                  <td className="col-num">{t.players_count} / {t.max_players}</td>
                  <td className="col-actions">
                    {canEdit && (
                      <EditTableAction
                        to={`/tournaments/${t.id}/edit`}
                        label={`Редактировать турнир «${t.name}»`}
                      />
                    )}
                    {canDelete && (
                      <DeleteTableAction
                        onClick={() => handleDelete(t)}
                        disabled={deletingId === t.id}
                        label={`Удалить турнир «${t.name}»`}
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
