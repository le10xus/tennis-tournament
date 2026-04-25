import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { matchesApi, registrationsApi, tournamentsApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import type { Registration } from '../../api/registrations'
import type { Match, Tournament } from '../../types'
import './TournamentBracketPage.css'

export function TournamentBracketPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { canEdit } = useAuth()
  const numId = Number(id)

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [seeds, setSeeds] = useState<Record<number, string>>({})
  const [savingSeeds, setSavingSeeds] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      tournamentsApi.get(numId),
      registrationsApi.listForTournament(numId),
      matchesApi.list({ tournament: String(numId), page_size: '500' }),
    ])
      .then(([t, regs, matchData]) => {
        setTournament(t)
        const sorted = sortedRegs(regs.results)
        setRegistrations(sorted)
        const seedMap: Record<number, string> = {}
        regs.results.forEach(r => { seedMap[r.id] = r.seed !== null ? String(r.seed) : '' })
        setSeeds(seedMap)
        setMatches(matchData.results)
      })
      .catch(() => setError('Турнир не найден.'))
      .finally(() => setLoading(false))
  }, [numId])

  function sortedRegs(regs: Registration[]) {
    return [...regs].sort((a, b) => {
      if (a.seed === null) return 1
      if (b.seed === null) return -1
      return a.seed - b.seed
    })
  }

  async function handleSaveSeeds() {
    setSavingSeeds(true)
    try {
      await Promise.all(
        registrations.map(r => {
          const val = seeds[r.id]
          const seed = val && val.trim() !== '' ? Number(val) : null
          return registrationsApi.updateSeed(r.id, seed)
        })
      )
      const regs = await registrationsApi.listForTournament(numId)
      setRegistrations(sortedRegs(regs.results))
      const seedMap: Record<number, string> = {}
      regs.results.forEach(r => { seedMap[r.id] = r.seed !== null ? String(r.seed) : '' })
      setSeeds(seedMap)
    } catch {
      alert('Не удалось сохранить посевы.')
    } finally {
      setSavingSeeds(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenError(null)
    try {
      const newMatches = await tournamentsApi.generateBracket(numId)
      setMatches(Array.isArray(newMatches) ? newMatches : [])
    } catch (err: unknown) {
      const e = err as { data?: { detail?: string } }
      setGenError(e.data?.detail ?? 'Не удалось сгенерировать сетку.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) return <p className="state-msg">Загрузка…</p>
  if (error || !tournament) return (
    <div className="empty-state">
      <p>{error ?? 'Турнир не найден.'}</p>
      <button className="btn btn-ghost" onClick={() => navigate('/tournaments')}>← Назад</button>
    </div>
  )

  const fmt = tournament.format

  return (
    <div className="bracket-page">
      <div className="bracket-page__header">
        <div>
          <Link to={`/tournaments/${numId}`} className="back-link">← {tournament.name}</Link>
          <h1 className="page-title">Турнирная сетка</h1>
        </div>
        <span className="badge badge--blue">{tournament.format_display}</span>
      </div>

      {/* ── Посевы (только для редакторов) ── */}
      {canEdit && registrations.length > 0 && (
        <section className="bracket-section">
          <h2 className="section-title">Посевы участников</h2>
          <div className="seed-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="col-num">Посев</th>
                  <th>Игрок</th>
                  <th className="col-num">Рейтинг</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map(reg => (
                  <tr key={reg.id}>
                    <td className="col-num">
                      <input
                        type="number"
                        className="seed-input"
                        min={1}
                        value={seeds[reg.id] ?? ''}
                        onChange={e => setSeeds(prev => ({ ...prev, [reg.id]: e.target.value }))}
                        placeholder="—"
                      />
                    </td>
                    <td className="col-name">
                      <Link to={`/players/${reg.player}`} className="player-ref-link">
                        {reg.player_detail.last_name} {reg.player_detail.first_name}
                      </Link>
                    </td>
                    <td className="col-num col-secondary">{reg.player_detail.rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bracket-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleSaveSeeds}
              disabled={savingSeeds}
            >
              {savingSeeds ? 'Сохранение…' : 'Сохранить посевы'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleGenerate}
              disabled={generating || registrations.length < 2}
            >
              {generating ? 'Генерация…' : 'Сгенерировать сетку'}
            </button>
          </div>
          {genError && <p className="form-error-global" style={{ marginTop: '0.5rem' }}>{genError}</p>}
        </section>
      )}

      {registrations.length === 0 && (
        <p className="state-msg">Нет зарегистрированных игроков.</p>
      )}

      {/* ── Сетка ── */}
      {matches.length > 0 && (
        <section className="bracket-section">
          <h2 className="section-title">
            Сетка
            <span className="section-count">{matches.length}</span>
          </h2>
          {fmt === 'round_robin' ? (
            <RoundRobinView matches={matches} registrations={registrations} />
          ) : (
            <SingleElimView matches={matches} registrations={registrations} />
          )}
        </section>
      )}

      {matches.length === 0 && registrations.length >= 2 && (
        <p className="state-msg" style={{ marginTop: '1rem' }}>
          Сетка ещё не сгенерирована.
          {canEdit ? ' Нажмите «Сгенерировать сетку» выше.' : ''}
        </p>
      )}
    </div>
  )
}

// ── Single/Double elimination bracket ────────────────────────────────────────

const SLOT_PX = 90

function SingleElimView({ matches, registrations }: { matches: Match[]; registrations: Registration[] }) {
  const n = registrations.length
  if (n < 2) return null

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(n, 2))))
  const totalRounds = Math.log2(bracketSize)

  function roundLabel(round: number): string {
    if (round === totalRounds) return 'Финал'
    if (round === totalRounds - 1) return 'Полуфинал'
    if (round === totalRounds - 2 && totalRounds > 3) return 'Четвертьфинал'
    return `Раунд ${round}`
  }

  return (
    <div className="bracket">
      {Array.from({ length: totalRounds }, (_, ri) => {
        const round = ri + 1
        const slotCount = bracketSize / Math.pow(2, round)
        const slotHeight = Math.pow(2, ri) * SLOT_PX
        const roundMatches = matches.filter(m => m.round_number === round)

        return (
          <div key={round} className="bracket__round">
            <div className="bracket__round-title">{roundLabel(round)}</div>
            <div className="bracket__slots">
              {Array.from({ length: slotCount }, (_, si) => {
                const match = roundMatches[si]
                return (
                  <div key={si} className="bracket__slot" style={{ height: slotHeight }}>
                    {match ? (
                      <MatchCard match={match} />
                    ) : (
                      <div className="bracket__match-card bracket__match-card--tbd">
                        <div className="bracket__player-row bracket__tbd">TBD</div>
                        <div className="bracket__divider" />
                        <div className="bracket__player-row bracket__tbd">TBD</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Round-robin ───────────────────────────────────────────────────────────────

function RoundRobinView({ matches, registrations }: { matches: Match[]; registrations: Registration[] }) {
  const standing: Record<number, { name: string; playerId: number; wins: number; losses: number }> = {}
  registrations.forEach(r => {
    standing[r.player] = {
      playerId: r.player,
      name: `${r.player_detail.last_name} ${r.player_detail.first_name}`,
      wins: 0,
      losses: 0,
    }
  })
  matches.forEach(m => {
    if (m.winner) {
      const loserId = m.winner === m.player1 ? m.player2 : m.player1
      if (standing[m.winner]) standing[m.winner].wins++
      if (standing[loserId]) standing[loserId].losses++
    }
  })
  const rows = Object.values(standing)
    .map(s => ({ ...s, pts: s.wins * 2 }))
    .sort((a, b) => b.pts - a.pts || b.wins - a.wins)

  const rounds = [...new Set(matches.map(m => m.round_number))].sort((a, b) => a - b)

  return (
    <div>
      <div className="rr-layout">
        {/* Standings */}
        <div className="rr-standings">
          <h3 className="rr-standings__title">Таблица</h3>
          <table className="table">
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th>Игрок</th>
                <th className="col-num">В</th>
                <th className="col-num">П</th>
                <th className="col-num">Очки</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.playerId}>
                  <td className="col-num col-secondary">{i + 1}</td>
                  <td className="col-name">
                    <Link to={`/players/${row.playerId}`} className="player-ref-link">
                      {row.name}
                    </Link>
                  </td>
                  <td className="col-num">{row.wins}</td>
                  <td className="col-num col-secondary">{row.losses}</td>
                  <td className="col-num"><strong>{row.pts}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Matches by round */}
        <div className="rr-rounds">
          {rounds.map(round => (
            <div key={round} className="rr-round">
              <div className="rr-round__title">Тур {round}</div>
              <div className="rr-round__matches">
                {matches
                  .filter(m => m.round_number === round)
                  .map(m => <MatchCard key={m.id} match={m} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Shared match card ─────────────────────────────────────────────────────────

function MatchCard({ match }: { match: Match }) {
  const p1Win = match.winner === match.player1
  const p2Win = match.winner === match.player2

  return (
    <div className="bracket__match-card">
      <div className={`bracket__player-row ${p1Win ? 'bracket__player-row--winner' : ''}`}>
        <span className="bracket__player-name">{match.player1_detail.last_name}</span>
        {match.score && p1Win && <span className="bracket__score">{match.score}</span>}
      </div>
      <div className="bracket__divider" />
      <div className={`bracket__player-row ${p2Win ? 'bracket__player-row--winner' : ''}`}>
        <span className="bracket__player-name">{match.player2_detail.last_name}</span>
        {match.score && p2Win && <span className="bracket__score">{match.score}</span>}
      </div>
    </div>
  )
}
