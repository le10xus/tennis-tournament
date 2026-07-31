import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { playersApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import type { Gender, Player } from '../../types'
import './PlayerListPage.css'

export function PlayerListPage() {
  const { canEdit, canDelete } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [totals, setTotals] = useState<Record<Gender, number>>({ male: 0, female: 0 })
  const [activeGender, setActiveGender] = useState<Gender>('male')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      playersApi.list({ gender: 'male', page_size: '200' }),
      playersApi.list({ gender: 'female', page_size: '200' }),
    ])
      .then(([male, female]) => {
        setPlayers([...male.results, ...female.results])
        setTotals({ male: male.count, female: female.count })
      })
      .catch(() => setError('Не удалось загрузить список игроков.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(player: Player) {
    if (!confirm(`Удалить игрока «${player.first_name} ${player.last_name}»?`)) return
    setDeletingId(player.id)
    try {
      await playersApi.delete(player.id)
      setPlayers(prev => prev.filter(p => p.id !== player.id))
      setTotals(prev => ({ ...prev, [player.gender]: prev[player.gender] - 1 }))
    } catch {
      alert('Не удалось удалить игрока.')
    } finally {
      setDeletingId(null)
    }
  }

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('ru-RU')
  const visiblePlayers = players
    .filter(player => player.gender === activeGender)
    .map((player, index) => ({ player, rank: index + 1 }))
    .filter(({ player }) => {
      const fullName = `${player.first_name} ${player.last_name}`.toLocaleLowerCase('ru-RU')
      const reversedName = `${player.last_name} ${player.first_name}`.toLocaleLowerCase('ru-RU')
      return fullName.includes(normalizedQuery) || reversedName.includes(normalizedQuery)
    })
  const total = totals.male + totals.female

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Рейтинг</h1>
          {!loading && (
            <p className="page-subtitle">
              Мужчины: {totals.male} · Женщины: {totals.female} · Всего: {total}
            </p>
          )}
        </div>
        {canEdit && <Link to="/players/new" className="btn btn-primary">+ Добавить игрока</Link>}
      </div>

      {loading && <p className="state-msg">Загрузка…</p>}
      {error && <p className="state-msg state-msg--error">{error}</p>}

      {!loading && !error && total === 0 && (
        <div className="empty-state">
          <p>Игроков пока нет.</p>
          <Link to="/players/new" className="btn btn-primary">Добавить первого</Link>
        </div>
      )}

      {!loading && !error && total > 0 && (
        <div className="rating-search">
          <label htmlFor="rating-player-search">Поиск по имени</label>
          <input
            id="rating-player-search"
            type="search"
            value={searchQuery}
            placeholder="Имя или фамилия"
            onChange={event => setSearchQuery(event.target.value)}
          />
        </div>
      )}

      {!loading && !error && total > 0 && (
        <div className="rating-gender-tabs" role="tablist" aria-label="Категория рейтинга">
          <button
            className={`rating-gender-tab ${activeGender === 'male' ? 'rating-gender-tab--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeGender === 'male'}
            onClick={() => setActiveGender('male')}
          >
            Мужчины <span>{totals.male}</span>
          </button>
          <button
            className={`rating-gender-tab ${activeGender === 'female' ? 'rating-gender-tab--active' : ''}`}
            type="button"
            role="tab"
            aria-selected={activeGender === 'female'}
            onClick={() => setActiveGender('female')}
          >
            Женщины <span>{totals.female}</span>
          </button>
        </div>
      )}

      {!loading && !error && total > 0 && visiblePlayers.length === 0 && (
        <div className="empty-state">
          <p>{normalizedQuery ? 'Игроки не найдены.' : 'В этой категории игроков пока нет.'}</p>
        </div>
      )}

      {visiblePlayers.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th>Игрок</th>
                <th>Email</th>
                <th className="col-num">Рейтинг</th>
                <th>Тип</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visiblePlayers.map(({ player: p, rank }) => (
                <tr key={p.id}>
                  <td className="col-num col-secondary">{rank}</td>
                  <td className="col-name">
                    <Link to={`/players/${p.id}`} className="player-link">
                      {p.first_name} {p.last_name}
                    </Link>
                  </td>
                  <td className="col-secondary">{p.email}</td>
                  <td className="col-num">{p.rating}</td>
                  <td>{p.rating_type_display}</td>
                  <td className="col-actions">
                    {canEdit && (
                      <Link to={`/players/${p.id}/edit`} className="btn btn-ghost btn-sm">
                        Редактировать
                      </Link>
                    )}
                    {canDelete && (
                      <button
                        className="btn btn-danger-ghost"
                        onClick={() => handleDelete(p)}
                        disabled={deletingId === p.id}
                      >
                        {deletingId === p.id ? '…' : 'Удалить'}
                      </button>
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
