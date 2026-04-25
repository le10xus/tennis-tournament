import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { playersApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import type { Player } from '../../types'
import './PlayerListPage.css'

export function PlayerListPage() {
  const { canEdit, canDelete } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    playersApi.list()
      .then(data => { setPlayers(data.results); setTotal(data.count) })
      .catch(() => setError('Не удалось загрузить список игроков.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(player: Player) {
    if (!confirm(`Удалить игрока «${player.first_name} ${player.last_name}»?`)) return
    setDeletingId(player.id)
    try {
      await playersApi.delete(player.id)
      setPlayers(prev => prev.filter(p => p.id !== player.id))
      setTotal(prev => prev - 1)
    } catch {
      alert('Не удалось удалить игрока.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Игроки</h1>
          {!loading && <p className="page-subtitle">Всего: {total}</p>}
        </div>
        {canEdit && <Link to="/players/new" className="btn btn-primary">+ Добавить игрока</Link>}
      </div>

      {loading && <p className="state-msg">Загрузка…</p>}
      {error && <p className="state-msg state-msg--error">{error}</p>}

      {!loading && !error && players.length === 0 && (
        <div className="empty-state">
          <p>Игроков пока нет.</p>
          <Link to="/players/new" className="btn btn-primary">Добавить первого</Link>
        </div>
      )}

      {players.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Игрок</th>
                <th>Email</th>
                <th>Пол</th>
                <th className="col-num">Рейтинг</th>
                <th>Тип</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {players.map(p => (
                <tr key={p.id}>
                  <td className="col-name">
                    <Link to={`/players/${p.id}`} className="player-link">
                      {p.first_name} {p.last_name}
                    </Link>
                  </td>
                  <td className="col-secondary">{p.email}</td>
                  <td>{p.gender_display}</td>
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
