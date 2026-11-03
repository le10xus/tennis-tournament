import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { playersApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import { DeleteTableAction, EditTableAction } from '../../components/TableActionIcon'
import type { Gender, Player } from '../../types'
import './PlayerListPage.css'

type Discipline = 'singles' | 'doubles'

export function PlayerListPage() {
  const { canEdit, canDelete } = useAuth()
  const [players, setPlayers] = useState<Player[]>([])
  const [totals, setTotals] = useState<Record<Gender, number>>({ male: 0, female: 0 })
  const [activeGender, setActiveGender] = useState<Gender>('male')
  const [activeDiscipline, setActiveDiscipline] = useState<Discipline>('singles')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      playersApi.list({ gender: 'male', page_size: '500' }),
      playersApi.list({ gender: 'female', page_size: '500' }),
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

  const pointsOf = (player: Player, discipline: Discipline = activeDiscipline) =>
    discipline === 'singles' ? player.points_singles : player.points_doubles

  const ntrpOf = (player: Player, discipline: Discipline = activeDiscipline) =>
    discipline === 'singles' ? player.ntrp_singles : player.ntrp_doubles

  // Игрок считается в разряде, только если в исходнике у него есть строка (очки или NTRP)
  const inDiscipline = (player: Player, discipline: Discipline) =>
    pointsOf(player, discipline) > 0 || ntrpOf(player, discipline) !== ''

  const countIn = (discipline: Discipline, gender?: Gender) => players.filter(player => (
    (gender === undefined || player.gender === gender) && inDiscipline(player, discipline)
  )).length

  const maleCount = countIn(activeDiscipline, 'male')
  const femaleCount = countIn(activeDiscipline, 'female')
  const disciplineTotal = maleCount + femaleCount
  const singlesTotal = countIn('singles')
  const doublesTotal = countIn('doubles')

  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('ru-RU')

  // В рейтинг попадают только те, кто играл этот разряд (в источнике нет строки — нет очков)
  const rankedPlayers = players
    .filter(player => player.gender === activeGender)
    .filter(player => inDiscipline(player, activeDiscipline))
    .sort((a, b) => (
      pointsOf(b) - pointsOf(a)
      || a.last_name.localeCompare(b.last_name, 'ru')
      || a.first_name.localeCompare(b.first_name, 'ru')
    ))
    .map((player, index) => ({ player, rank: index + 1 }))

  const visiblePlayers = rankedPlayers.filter(({ player }) => {
    const fullName = `${player.first_name} ${player.last_name}`.toLocaleLowerCase('ru-RU')
    const reversedName = `${player.last_name} ${player.first_name}`.toLocaleLowerCase('ru-RU')
    return fullName.includes(normalizedQuery) || reversedName.includes(normalizedQuery)
  })
  const allPlayersCount = totals.male + totals.female
  const disciplineLabel = activeDiscipline === 'singles' ? 'Одиночный разряд' : 'Парный разряд'
  const disciplinePlace = activeDiscipline === 'singles' ? 'одиночном разряде' : 'парном разряде'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Рейтинг</h1>
          {!loading && (
            <p className="page-subtitle">
              {disciplineLabel} · Мужчины: {maleCount} · Женщины: {femaleCount} · Всего: {disciplineTotal}
            </p>
          )}
        </div>
        {canEdit && <Link to="/players/new" className="btn btn-primary">+ Добавить игрока</Link>}
      </div>

      {loading && <p className="state-msg">Загрузка…</p>}
      {error && <p className="state-msg state-msg--error">{error}</p>}

      {!loading && !error && allPlayersCount === 0 && (
        <div className="empty-state">
          <p>Игроков пока нет.</p>
          <Link to="/players/new" className="btn btn-primary">Добавить первого</Link>
        </div>
      )}

      {!loading && !error && allPlayersCount > 0 && (
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

      {!loading && !error && allPlayersCount > 0 && (
        <div className="rating-tabs">
          <div className="rating-gender-tabs" role="tablist" aria-label="Категория рейтинга">
            <button
              className={`rating-gender-tab ${activeGender === 'male' ? 'rating-gender-tab--active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeGender === 'male'}
              onClick={() => setActiveGender('male')}
            >
              Мужчины <span>{maleCount}</span>
            </button>
            <button
              className={`rating-gender-tab ${activeGender === 'female' ? 'rating-gender-tab--active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeGender === 'female'}
              onClick={() => setActiveGender('female')}
            >
              Женщины <span>{femaleCount}</span>
            </button>
          </div>

          <div className="rating-gender-tabs" role="tablist" aria-label="Разряд">
            <button
              className={`rating-gender-tab ${activeDiscipline === 'singles' ? 'rating-gender-tab--active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeDiscipline === 'singles'}
              onClick={() => setActiveDiscipline('singles')}
            >
              Одиночный <span>{singlesTotal}</span>
            </button>
            <button
              className={`rating-gender-tab ${activeDiscipline === 'doubles' ? 'rating-gender-tab--active' : ''}`}
              type="button"
              role="tab"
              aria-selected={activeDiscipline === 'doubles'}
              onClick={() => setActiveDiscipline('doubles')}
            >
              Парный <span>{doublesTotal}</span>
            </button>
          </div>
        </div>
      )}

      {!loading && !error && allPlayersCount > 0 && visiblePlayers.length === 0 && (
        <div className="empty-state">
          <p>
            {normalizedQuery
              ? 'Игроки не найдены.'
              : `В ${disciplinePlace} этой категории игроков пока нет.`}
          </p>
        </div>
      )}

      {visiblePlayers.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th>Игрок</th>
                <th>Город</th>
                <th className="col-num">NTRP</th>
                <th className="col-num">Очки</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visiblePlayers.map(({ player: p, rank }) => (
                <tr key={p.id}>
                  <td className="col-num col-secondary">{rank}</td>
                  <td className="col-name">
                    <Link to={`/players/${p.id}`} className="player-link">
                      {p.last_name} {p.first_name}
                    </Link>
                  </td>
                  <td className="col-secondary">{p.city || '—'}</td>
                  <td className="col-num">{ntrpOf(p) || '—'}</td>
                  <td className="col-num">{pointsOf(p) || '—'}</td>
                  <td className="col-actions">
                    {canEdit && (
                      <EditTableAction
                        to={`/players/${p.id}/edit`}
                        label={`Редактировать игрока «${p.first_name} ${p.last_name}»`}
                      />
                    )}
                    {canDelete && (
                      <DeleteTableAction
                        onClick={() => handleDelete(p)}
                        disabled={deletingId === p.id}
                        label={`Удалить игрока «${p.first_name} ${p.last_name}»`}
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
