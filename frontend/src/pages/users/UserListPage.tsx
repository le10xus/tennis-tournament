import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { usersApi } from '../../api'
import { DeleteTableAction } from '../../components/TableActionIcon'
import type { User } from '../../types'
import './UserListPage.css'

export function UserListPage() {
  const [users, setUsers] = useState<User[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    usersApi.list()
      .then(data => { setUsers(data.results); setTotal(data.count) })
      .catch(() => setError('Не удалось загрузить список пользователей.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleDelete(u: User) {
    if (!confirm(`Удалить пользователя «${u.username}»?`)) return
    setDeletingId(u.id)
    try {
      await usersApi.delete(u.id)
      setUsers(prev => prev.filter(x => x.id !== u.id))
      setTotal(prev => prev - 1)
    } catch {
      alert('Не удалось удалить пользователя.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Пользователи</h1>
          {!loading && <p className="page-subtitle">Всего: {total}</p>}
        </div>
        <Link to="/users/new" className="btn btn-primary">+ Добавить пользователя</Link>
      </div>

      {loading && <p className="state-msg">Загрузка…</p>}
      {error && <p className="state-msg state-msg--error">{error}</p>}

      {!loading && !error && users.length === 0 && (
        <div className="empty-state">
          <p>Пользователей пока нет.</p>
          <Link to="/users/new" className="btn btn-primary">Добавить первого</Link>
        </div>
      )}

      {users.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Логин</th>
                <th>Имя</th>
                <th>Email</th>
                <th>Роль</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td className="col-name">
                    <Link to={`/users/${u.id}/edit`} className="user-link">
                      {u.username}
                    </Link>
                    {u.is_staff && <span className="badge badge--admin">admin</span>}
                  </td>
                  <td className="col-secondary">
                    {u.first_name || u.last_name ? `${u.first_name} ${u.last_name}`.trim() : '—'}
                  </td>
                  <td className="col-secondary">{u.email || '—'}</td>
                  <td>{u.role_display}</td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge--green' : 'badge--gray'}`}>
                      {u.is_active ? 'Активен' : 'Заблокирован'}
                    </span>
                  </td>
                  <td className="col-actions">
                    <DeleteTableAction
                      onClick={() => handleDelete(u)}
                      disabled={deletingId === u.id}
                      label={`Удалить пользователя «${u.username}»`}
                    />
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
