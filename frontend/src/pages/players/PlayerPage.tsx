import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { playersApi, registrationsApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import type { Registration } from '../../api/registrations'
import type { Player } from '../../types'
import './PlayerPage.css'

const TOURNAMENT_STATUS_BADGE: Record<string, string> = {
  draft: 'badge--gray',
  registration: 'badge--blue',
  in_progress: 'badge--green',
  finished: 'badge--neutral',
}

export function PlayerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canEdit } = useAuth()

  const [player, setPlayer] = useState<Player | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const numId = Number(id)
    Promise.all([
      playersApi.get(numId),
      registrationsApi.listForPlayer(numId),
    ])
      .then(([p, regs]) => {
        setPlayer(p)
        setRegistrations(regs.results)
      })
      .catch(() => setError('Игрок не найден.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <p className="state-msg">Загрузка…</p>
  if (error || !player) return (
    <div className="empty-state">
      <p>{error ?? 'Игрок не найден.'}</p>
      <button className="btn btn-ghost" onClick={() => navigate('/players')}>← Назад</button>
    </div>
  )

  return (
    <div className="player-page">

      {/* ── Шапка ── */}
      <div className="player-page__header">
        <div>
          <Link to="/players" className="back-link">← Игроки</Link>
          <h1 className="page-title">{player.first_name} {player.last_name}</h1>
        </div>
        {canEdit && (
          <Link to={`/players/${player.id}/edit`} className="btn btn-primary">
            Редактировать
          </Link>
        )}
      </div>

      {/* ── Инфо-карточка ── */}
      <div className="player-card">
        <div className="player-card__grid">
          <InfoRow label="Пол" value={player.gender_display} />
          <InfoRow label="Рейтинг" value={`${player.rating} (${player.rating_type_display})`} />
          {player.email && <InfoRow label="Email" value={player.email} />}
          {player.phone && <InfoRow label="Телефон" value={player.phone} />}
          {player.birth_date && (
            <InfoRow
              label="Дата рождения"
              value={new Date(player.birth_date).toLocaleDateString('ru-RU')}
            />
          )}
        </div>
      </div>

      {/* ── Турниры ── */}
      <section className="player-section">
        <h2 className="section-title">
          Турниры
          <span className="section-count">{registrations.length}</span>
        </h2>

        {registrations.length === 0 ? (
          <p className="state-msg">Игрок ещё не участвовал в турнирах.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Турнир</th>
                  <th>Статус</th>
                  <th>Разряд</th>
                  <th>Формат</th>
                  <th>Дата начала</th>
                  <th>Место</th>
                  <th className="col-num">Посев</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map(reg => {
                  const t = reg.tournament_detail
                  return (
                    <tr key={reg.id}>
                      <td className="col-name">
                        <Link to={`/tournaments/${t.id}/edit`} className="tournament-ref-link">
                          {t.name}
                        </Link>
                      </td>
                      <td>
                        <span className={`badge ${TOURNAMENT_STATUS_BADGE[t.status] ?? ''}`}>
                          {t.status_display}
                        </span>
                      </td>
                      <td>{t.kind_display}</td>
                      <td className="col-secondary">{t.format_display}</td>
                      <td className="col-secondary">{t.start_date}</td>
                      <td className="col-secondary">{t.location || '—'}</td>
                      <td className="col-num">{reg.seed ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  )
}
