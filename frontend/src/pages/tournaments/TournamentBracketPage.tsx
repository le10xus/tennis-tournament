import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { matchesApi, registrationsApi, tournamentsApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import type { Registration } from '../../api/registrations'
import type { Match, Tournament } from '../../types'
import './TournamentBracketPage.css'

// ── Types ──────────────────────────────────────────────────────────────────────
interface Pair {
  pairId: number
  seed: number | null
  p1: Registration
  p2: Registration
}

// ── Page ───────────────────────────────────────────────────────────────────────
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

  // Singles seeding state: regId → seed string
  const [seeds, setSeeds] = useState<Record<number, string>>({})
  // Doubles seeding state: regId → { seed, pairId }
  const [pairSeeds, setPairSeeds] = useState<Record<number, string>>({})
  const [pairIds, setPairIds] = useState<Record<number, string>>({})

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
        applyRegistrations(regs.results)
        setMatches(matchData.results)
      })
      .catch(() => setError('Турнир не найден.'))
      .finally(() => setLoading(false))
  }, [numId])

  function applyRegistrations(regs: Registration[]) {
    const sorted = sortedRegs(regs)
    setRegistrations(sorted)
    const s: Record<number, string> = {}
    const ps: Record<number, string> = {}
    const pi: Record<number, string> = {}
    regs.forEach(r => {
      s[r.id] = r.seed !== null ? String(r.seed) : ''
      ps[r.id] = r.seed !== null ? String(r.seed) : ''
      pi[r.id] = r.pair_id !== null ? String(r.pair_id) : ''
    })
    setSeeds(s)
    setPairSeeds(ps)
    setPairIds(pi)
  }

  function sortedRegs(regs: Registration[]) {
    return [...regs].sort((a, b) => {
      if (a.seed === null) return 1
      if (b.seed === null) return -1
      return a.seed - b.seed
    })
  }

  async function reloadRegs() {
    const regs = await registrationsApi.listForTournament(numId)
    applyRegistrations(regs.results)
  }

  // ── Singles: save seeds ────────────────────────────────────────────────────
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
      await reloadRegs()
    } catch {
      alert('Не удалось сохранить посевы.')
    } finally {
      setSavingSeeds(false)
    }
  }

  // ── Doubles: save pair assignments ─────────────────────────────────────────
  async function handleSavePairs() {
    setSavingSeeds(true)
    try {
      await Promise.all(
        registrations.map(r => {
          const seedVal = pairSeeds[r.id]
          const pairVal = pairIds[r.id]
          const seed = seedVal && seedVal.trim() !== '' ? Number(seedVal) : null
          const pair_id = pairVal && pairVal.trim() !== '' ? Number(pairVal) : null
          return registrationsApi.update(r.id, { seed, pair_id })
        })
      )
      await reloadRegs()
    } catch {
      alert('Не удалось сохранить пары.')
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

  const isDoubles = tournament.kind === 'doubles'
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

      {/* ── Seeding panel (editors only) ── */}
      {canEdit && registrations.length > 0 && (
        <section className="bracket-section">
          <h2 className="section-title">
            {isDoubles ? 'Пары и посевы' : 'Посевы участников'}
          </h2>

          {isDoubles ? (
            <DoubleSeedingPanel
              registrations={registrations}
              pairSeeds={pairSeeds}
              pairIds={pairIds}
              onSeedChange={(id, v) => setPairSeeds(prev => ({ ...prev, [id]: v }))}
              onPairChange={(id, v) => setPairIds(prev => ({ ...prev, [id]: v }))}
            />
          ) : (
            <SingleSeedingPanel
              registrations={registrations}
              seeds={seeds}
              onSeedChange={(id, v) => setSeeds(prev => ({ ...prev, [id]: v }))}
            />
          )}

          <div className="bracket-actions">
            <button
              type="button" className="btn btn-ghost"
              onClick={isDoubles ? handleSavePairs : handleSaveSeeds}
              disabled={savingSeeds}
            >
              {savingSeeds ? 'Сохранение…' : (isDoubles ? 'Сохранить пары' : 'Сохранить посевы')}
            </button>
            <button
              type="button" className="btn btn-primary"
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

      {/* ── Bracket display ── */}
      {matches.length > 0 && (
        <section className="bracket-section">
          <h2 className="section-title">
            Сетка
            <span className="section-count">{matches.length}</span>
          </h2>
          {fmt === 'round_robin' ? (
            <RoundRobinView
              matches={matches}
              registrations={registrations}
              isDoubles={isDoubles}
            />
          ) : (
            <SingleElimView
              matches={matches}
              registrations={registrations}
              isDoubles={isDoubles}
            />
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

// ── Seeding panels ─────────────────────────────────────────────────────────────

function SingleSeedingPanel({
  registrations, seeds, onSeedChange,
}: {
  registrations: Registration[]
  seeds: Record<number, string>
  onSeedChange: (id: number, v: string) => void
}) {
  return (
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
                  type="number" className="seed-input" min={1} placeholder="—"
                  value={seeds[reg.id] ?? ''}
                  onChange={e => onSeedChange(reg.id, e.target.value)}
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
  )
}

function DoubleSeedingPanel({
  registrations, pairSeeds, pairIds, onSeedChange, onPairChange,
}: {
  registrations: Registration[]
  pairSeeds: Record<number, string>
  pairIds: Record<number, string>
  onSeedChange: (id: number, v: string) => void
  onPairChange: (id: number, v: string) => void
}) {
  // Group into pairs for visual display (sort by pair_id, then by name for ungrouped)
  const sorted = [...registrations].sort((a, b) => {
    const pa = a.pair_id ?? 9999
    const pb = b.pair_id ?? 9999
    if (pa !== pb) return pa - pb
    return 0
  })

  return (
    <div className="seed-table-wrap">
      <p className="seed-hint">
        Укажите номер пары для каждого игрока (два игрока с одинаковым номером — одна пара).
        Посев — позиция пары в сетке.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th className="col-num">Пара №</th>
            <th className="col-num">Посев</th>
            <th>Игрок</th>
            <th className="col-num">Рейтинг</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((reg, i) => {
            const prevPairId = i > 0 ? (sorted[i - 1].pair_id ?? null) : null
            const curPairId = reg.pair_id
            const showDivider = i > 0 && curPairId !== prevPairId && curPairId !== null
            return (
              <tr key={reg.id} className={showDivider ? 'pair-row-divider' : ''}>
                <td className="col-num">
                  <input
                    type="number" className="seed-input" min={1} placeholder="—"
                    value={pairIds[reg.id] ?? ''}
                    onChange={e => onPairChange(reg.id, e.target.value)}
                  />
                </td>
                <td className="col-num">
                  <input
                    type="number" className="seed-input" min={1} placeholder="—"
                    value={pairSeeds[reg.id] ?? ''}
                    onChange={e => onSeedChange(reg.id, e.target.value)}
                  />
                </td>
                <td className="col-name">
                  <Link to={`/players/${reg.player}`} className="player-ref-link">
                    {reg.player_detail.last_name} {reg.player_detail.first_name}
                  </Link>
                </td>
                <td className="col-num col-secondary">{reg.player_detail.rating}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Single/Double elimination bracket ─────────────────────────────────────────

const SLOT_PX = 90

function SingleElimView({
  matches, registrations, isDoubles,
}: {
  matches: Match[]
  registrations: Registration[]
  isDoubles: boolean
}) {
  const n = isDoubles
    ? buildPairs(registrations).length
    : registrations.length

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
                      <MatchCard match={match} isDoubles={isDoubles} />
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

// ── Round-robin ────────────────────────────────────────────────────────────────

function RoundRobinView({
  matches, registrations, isDoubles,
}: {
  matches: Match[]
  registrations: Registration[]
  isDoubles: boolean
}) {
  type StandingRow = { id: string; label: string; wins: number; losses: number }
  const standing: Record<string, StandingRow> = {}

  if (isDoubles) {
    // Build standings by pair (player1 id as key since that's the "captain")
    matches.forEach(m => {
      const pair1Key = String(m.player1)
      const pair2Key = String(m.player2)
      if (!standing[pair1Key]) {
        standing[pair1Key] = { id: pair1Key, label: pairLabel(m, 1), wins: 0, losses: 0 }
      }
      if (!standing[pair2Key]) {
        standing[pair2Key] = { id: pair2Key, label: pairLabel(m, 2), wins: 0, losses: 0 }
      }
      if (m.winner === m.player1) {
        standing[pair1Key].wins++
        standing[pair2Key].losses++
      } else if (m.winner === m.player2) {
        standing[pair2Key].wins++
        standing[pair1Key].losses++
      }
    })
  } else {
    registrations.forEach(r => {
      standing[String(r.player)] = {
        id: String(r.player),
        label: `${r.player_detail.last_name} ${r.player_detail.first_name}`,
        wins: 0,
        losses: 0,
      }
    })
    matches.forEach(m => {
      if (m.winner) {
        const loserId = String(m.winner === m.player1 ? m.player2 : m.player1)
        if (standing[String(m.winner)]) standing[String(m.winner)].wins++
        if (standing[loserId]) standing[loserId].losses++
      }
    })
  }

  const rows = Object.values(standing)
    .map(s => ({ ...s, pts: s.wins * 2 }))
    .sort((a, b) => b.pts - a.pts || b.wins - a.wins)

  const rounds = [...new Set(matches.map(m => m.round_number))].sort((a, b) => a - b)

  return (
    <div>
      <div className="rr-layout">
        <div className="rr-standings">
          <h3 className="rr-standings__title">Таблица</h3>
          <table className="table">
            <thead>
              <tr>
                <th className="col-num">#</th>
                <th>{isDoubles ? 'Пара' : 'Игрок'}</th>
                <th className="col-num">В</th>
                <th className="col-num">П</th>
                <th className="col-num">Очки</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.id}>
                  <td className="col-num col-secondary">{i + 1}</td>
                  <td className="col-name">{row.label}</td>
                  <td className="col-num">{row.wins}</td>
                  <td className="col-num col-secondary">{row.losses}</td>
                  <td className="col-num"><strong>{row.pts}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rr-rounds">
          {rounds.map(round => (
            <div key={round} className="rr-round">
              <div className="rr-round__title">Тур {round}</div>
              <div className="rr-round__matches">
                {matches
                  .filter(m => m.round_number === round)
                  .map(m => <MatchCard key={m.id} match={m} isDoubles={isDoubles} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function pairLabel(match: Match, side: 1 | 2): string {
  if (side === 1) {
    const p2 = match.pair1_player2_detail
    return p2
      ? `${match.player1_detail.last_name} / ${p2.last_name}`
      : match.player1_detail.last_name
  }
  const p2 = match.pair2_player2_detail
  return p2
    ? `${match.player2_detail.last_name} / ${p2.last_name}`
    : match.player2_detail.last_name
}

function buildPairs(registrations: Registration[]): Pair[] {
  const grouped: Record<number, Registration[]> = {}
  registrations.forEach(r => {
    if (r.pair_id !== null) {
      if (!grouped[r.pair_id]) grouped[r.pair_id] = []
      grouped[r.pair_id].push(r)
    }
  })
  return Object.entries(grouped)
    .filter(([, regs]) => regs.length === 2)
    .map(([pid, regs]) => {
      const seeds = regs.map(r => r.seed).filter((s): s is number => s !== null)
      return {
        pairId: Number(pid),
        seed: seeds.length ? Math.min(...seeds) : null,
        p1: regs[0],
        p2: regs[1],
      }
    })
    .sort((a, b) => (a.seed === null ? 1 : b.seed === null ? -1 : a.seed - b.seed))
}

function MatchCard({ match, isDoubles }: { match: Match; isDoubles: boolean }) {
  const p1Win = match.winner === match.player1
  const p2Win = match.winner === match.player2
  const side1 = isDoubles ? pairLabel(match, 1) : match.player1_detail.last_name
  const side2 = isDoubles ? pairLabel(match, 2) : match.player2_detail.last_name

  return (
    <div className="bracket__match-card">
      <div className={`bracket__player-row ${p1Win ? 'bracket__player-row--winner' : ''}`}>
        <span className="bracket__player-name">{side1}</span>
        {match.score && p1Win && <span className="bracket__score">{match.score}</span>}
      </div>
      <div className="bracket__divider" />
      <div className={`bracket__player-row ${p2Win ? 'bracket__player-row--winner' : ''}`}>
        <span className="bracket__player-name">{side2}</span>
        {match.score && p2Win && <span className="bracket__score">{match.score}</span>}
      </div>
    </div>
  )
}
