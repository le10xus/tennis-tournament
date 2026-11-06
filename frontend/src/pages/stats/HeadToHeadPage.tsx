import { useEffect, useState } from 'react'
import { playersApi } from '../../api'
import { PlayerPicker } from '../../components/PlayerPicker'
import type { Player } from '../../types'
import './HeadToHeadPage.css'

interface H2HMatch {
  id: number
  tournament: number
  tournament_name: string
  date: string
  round: number
  bracket: string
  score: string
  winner_side: number
}

interface H2HResponse {
  player1: Player
  player2: Player
  count: number
  wins1: number
  wins2: number
  matches: H2HMatch[]
}

const roundLabel = (match: H2HMatch) => {
  if (match.bracket === 'third_place') return 'За 3-е место'
  if (match.bracket === 'consolation') return `Подвал · R${match.round}`
  return `R${match.round}`
}

export function HeadToHeadPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [player1, setPlayer1] = useState('')
  const [player2, setPlayer2] = useState('')
  const [data, setData] = useState<H2HResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    playersApi.list({ page_size: '500' })
      .then(response => setPlayers(response.results))
      .catch(() => setPlayers([]))
  }, [])

  useEffect(() => {
    if (!player1 || !player2) {
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/head-to-head/?player1=${player1}&player2=${player2}`)
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.detail ?? 'Ошибка')
        setData(body)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [player1, player2])

  const name = (player: Player | undefined) =>
    player ? `${player.last_name} ${player.first_name}` : '—'

  return (
    <div className="h2h-page">
      <h1 className="page-title">Очные встречи</h1>
      <p className="page-subtitle">
        История матчей между двумя игроками по всем турнирам.
      </p>

      <div className="h2h-pickers">
        <PlayerPicker
          players={players}
          value={player1}
          onChange={setPlayer1}
          placeholder="Игрок 1"
          excludeIds={player2 ? [Number(player2)] : []}
        />
        <PlayerPicker
          players={players}
          value={player2}
          onChange={setPlayer2}
          placeholder="Игрок 2"
          excludeIds={player1 ? [Number(player1)] : []}
        />
      </div>

      {loading && <p className="state-msg">Считаем…</p>}
      {error && <p className="form-error">{error}</p>}

      {data && !loading && (
        <>
          <div className="h2h-summary">
            <div className="h2h-summary__score">
              <span>{data.wins1}</span>
              <span className="h2h-summary__dash">—</span>
              <span>{data.wins2}</span>
            </div>
            <div className="h2h-summary__names">
              <span>{name(data.player1)}</span>
              <span>{name(data.player2)}</span>
            </div>
            <p className="h2h-summary__count">
              Очных встреч: {data.count}
            </p>
          </div>

          {data.count === 0 ? (
            <p className="state-msg">В базе пока нет матчей между этими игроками.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Турнир</th>
                    <th>Круг</th>
                    <th>Счёт</th>
                    <th>Победитель</th>
                  </tr>
                </thead>
                <tbody>
                  {data.matches.map(match => (
                    <tr key={match.id}>
                      <td className="col-secondary">{match.date}</td>
                      <td>{match.tournament_name}</td>
                      <td className="col-secondary">{roundLabel(match)}</td>
                      <td>{match.score || '—'}</td>
                      <td>
                        {match.winner_side === 1
                          ? name(data.player1)
                          : match.winner_side === 2
                            ? name(data.player2)
                            : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
