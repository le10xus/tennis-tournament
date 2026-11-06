import type { Match } from '../../types'
import './HistoricalBracket.css'

function sideName(match: Match, side: 1 | 2): string {
  const captain = side === 1 ? match.player1_detail : match.player2_detail
  const partner = side === 1 ? match.pair1_player2_detail : match.pair2_player2_detail
  if (!captain) return '—'
  if (partner) return `${captain.last_name} / ${partner.last_name}`
  return `${captain.last_name} ${captain.first_name.slice(0, 1)}.`
}

function setScores(match: Match, side: 1 | 2): string[] {
  const pairs = [
    [match.set1_home, match.set1_away],
    [match.set2_home, match.set2_away],
    [match.set3_home, match.set3_away],
  ].filter(([home, away]) => home !== null && away !== null) as [number, number][]

  if (pairs.length > 0) {
    return pairs.map(([home, away]) => String(side === 1 ? home : away))
  }

  if (!match.score || /[а-я]/i.test(match.score)) return []

  return match.score
    .split(/\s+/)
    .map(part => part.split(/[:\/]/))
    .filter(part => part.length === 2)
    .map(([home, away]) => String(side === 1 ? home : away).replace(/\(.*$/, ''))
}

function winnerSide(match: Match): 0 | 1 | 2 {
  if (!match.winner) return 0
  if (match.winner === match.player1) return 1
  if (match.winner === match.player2) return 2
  return 0
}

function scorePairs(match: Match): [number, number][] {
  const pairs = [
    [match.set1_home, match.set1_away],
    [match.set2_home, match.set2_away],
    [match.set3_home, match.set3_away],
  ].filter(([home, away]) => home !== null && away !== null) as [number, number][]

  if (pairs.length > 0) return pairs
  if (!match.score || /[а-я]/i.test(match.score)) return []

  return match.score
    .split(/\s+/)
    .map(part => part.split(/[:\/]/))
    .filter(part => part.length === 2 && part.every(value => /^\d/.test(value)))
    .map(([home, away]) => [parseInt(home, 10), parseInt(away, 10)] as [number, number])
}

interface GroupRow {
  id: number
  name: string
  wins: number
  setsFor: number
  setsAgainst: number
  gamesFor: number
  gamesAgainst: number
}

function groupStandings(matches: Match[]): GroupRow[] {
  const rows = new Map<number, GroupRow>()
  const headToHead = new Map<string, boolean>()

  const rowFor = (match: Match, side: 1 | 2): GroupRow | null => {
    const player = side === 1 ? match.player1_detail : match.player2_detail
    if (!player) return null
    if (!rows.has(player.id)) {
      rows.set(player.id, {
        id: player.id,
        name: `${player.last_name} ${player.first_name.slice(0, 1)}.`,
        wins: 0,
        setsFor: 0,
        setsAgainst: 0,
        gamesFor: 0,
        gamesAgainst: 0,
      })
    }
    return rows.get(player.id) ?? null
  }

  for (const match of matches) {
    const first = rowFor(match, 1)
    const second = rowFor(match, 2)
    if (!first || !second) continue
    const side = winnerSide(match)
    if (side === 1) {
      first.wins += 1
      headToHead.set(`${first.id}-${second.id}`, true)
    }
    if (side === 2) {
      second.wins += 1
      headToHead.set(`${second.id}-${first.id}`, true)
    }
    for (const [home, away] of scorePairs(match)) {
      first.gamesFor += home
      first.gamesAgainst += away
      second.gamesFor += away
      second.gamesAgainst += home
      if (home > away) {
        first.setsFor += 1
        second.setsAgainst += 1
      } else if (away > home) {
        second.setsFor += 1
        first.setsAgainst += 1
      }
    }
  }

  return [...rows.values()].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    if (headToHead.get(`${a.id}-${b.id}`)) return -1
    if (headToHead.get(`${b.id}-${a.id}`)) return 1
    const setDiff = (b.setsFor - b.setsAgainst) - (a.setsFor - a.setsAgainst)
    if (setDiff !== 0) return setDiff
    return (b.gamesFor - b.gamesAgainst) - (a.gamesFor - a.gamesAgainst)
  })
}

function roundLabel(round: number, maxRound: number): string {
  const left = maxRound - round
  if (left === 0) return 'Финал'
  if (left === 1) return '1/2'
  if (left === 2) return '1/4'
  if (left === 3) return '1/8'
  if (left === 4) return '1/16'
  return `R${round}`
}

const SLOT = 72
const CARD_H = 58

function slotTop(match: Match, firstRound: number, firstMin: number): number {
  const step = Math.pow(2, match.round_number - firstRound)
  const slot = match.round_number === firstRound ? match.slot_index - firstMin : match.slot_index
  return (slot * step + (step - 1) / 2) * SLOT
}

function BracketBoard({
  matches, maxRound, third,
}: {
  matches: Match[]
  maxRound: number
  third?: Match
}) {
  const rounds = [...new Set(matches.map(match => match.round_number))].sort((a, b) => a - b)
  if (rounds.length === 0) return null

  const firstRound = rounds[0]
  const firstMatches = matches.filter(match => match.round_number === firstRound)
  const nextCount = rounds.length > 1
    ? matches.filter(match => match.round_number === rounds[1]).length
    : firstMatches.length
  const firstSlots = Math.max(firstMatches.length, nextCount * 2)
  const firstMin = Math.min(...firstMatches.map(match => match.slot_index))

  const finalMatch = [...matches]
    .filter(match => match.round_number === maxRound)
    .sort((a, b) => a.slot_index - b.slot_index)[0]
  const finalTop = finalMatch ? slotTop(finalMatch, firstRound, firstMin) : 0
  const thirdTop = finalTop + CARD_H + 28

  let boardHeight = firstSlots * SLOT + CARD_H
  if (third) boardHeight = Math.max(boardHeight, thirdTop + CARD_H + 12)

  return (
    <div className="hist-board">
      {rounds.map(round => (
        <div className="hist-board__col" key={round}>
          <h4 className="hist-column__title">{roundLabel(round, maxRound)}</h4>
          <div className="hist-board__body" style={{ height: boardHeight }}>
            {matches
              .filter(match => match.round_number === round)
              .sort((a, b) => a.slot_index - b.slot_index)
              .map(match => (
                <div
                  className="hist-board__slot"
                  style={{ top: slotTop(match, firstRound, firstMin) }}
                  key={match.id}
                >
                  <HistoricalMatchCard match={match} />
                </div>
              ))}
            {third && round === maxRound && (
              <>
                <div className="hist-board__third-label" style={{ top: thirdTop - 20 }}>
                  3-е место
                </div>
                <div className="hist-board__slot" style={{ top: thirdTop }}>
                  <HistoricalMatchCard match={third} />
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export function HistoricalBracket({
  matches, printTitle, printMeta,
}: {
  matches: Match[]
  printTitle?: string
  printMeta?: string
}) {
  const winners = matches.filter(match => match.bracket === 'winners')
  const consolation = matches.filter(match => match.bracket === 'consolation')
  const groupMatches = matches.filter(match => match.bracket === 'group')
  const third = matches.find(match => match.bracket === 'third_place')
  const maxRound = Math.max(0, ...winners.map(match => match.round_number))

  const groups = ['9-16', '5-8']
    .map(group => ({
      group,
      matches: consolation
        .filter(match => match.group === group)
        .sort((a, b) => a.round_number - b.round_number || a.slot_index - b.slot_index),
    }))
    .filter(item => item.matches.length > 0)

  const consolationMain = consolation
    .filter(match => !['9-16', '5-8', 'third'].includes(match.group))
    .sort((a, b) => a.round_number - b.round_number || a.slot_index - b.slot_index)
  const consolationThird = consolation.find(match => match.group === 'third')
  const consolationMax = Math.max(0, ...consolationMain.map(match => match.round_number))

  return (
    <div className="hist-bracket">
      {groupMatches.length > 0 && (
        <section className="hist-section">
          <h3 className="hist-section__title">Групповой этап</h3>
          <div className="hist-group-tables">
            {[...new Set(groupMatches.map(match => match.group || '—'))]
              .sort()
              .map(group => {
                const groupList = groupMatches.filter(match => (match.group || '—') === group)
                const standings = groupStandings(groupList)
                return (
                  <div className="hist-group" key={group}>
                    <h4 className="hist-column__title">Группа {group}</h4>
                    <table className="hist-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Игрок</th>
                          <th>Победы</th>
                          <th>Сеты</th>
                          <th>Геймы</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((row, index) => (
                          <tr key={row.id}>
                            <td>{index + 1}</td>
                            <td className="hist-table__name">{row.name}</td>
                            <td>{row.wins}</td>
                            <td>{row.setsFor}–{row.setsAgainst}</td>
                            <td>{row.gamesFor}–{row.gamesAgainst}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
          </div>
          <div className="hist-columns">
            {[...new Set(groupMatches.map(match => match.group || '—'))]
              .sort()
              .map(group => (
                <div className="hist-column" key={group}>
                  <h4 className="hist-column__title">Группа {group}</h4>
                  {groupMatches
                    .filter(match => (match.group || '—') === group)
                    .sort((a, b) => a.slot_index - b.slot_index)
                    .map(match => <HistoricalMatchCard match={match} key={match.id} />)}
                </div>
              ))}
          </div>
        </section>
      )}

      <section className="hist-section">
        <h3 className="hist-section__title">Основная сетка</h3>
        <BracketBoard matches={winners} maxRound={maxRound} third={third} />
      </section>

      {groups.map(({ group, matches: groupMatches }) => (
        <section className="hist-section" key={group}>
          <h3 className="hist-section__title">
            {group === '9-16' ? 'Подвал 9–16' : 'Подвал 5–8'}
          </h3>
          <div className="hist-columns">
            {[...new Set(groupMatches.map(match => match.round_number))].map(round => (
              <div className="hist-column" key={round}>
                <h4 className="hist-column__title">{`Раунд ${round}`}</h4>
                {groupMatches
                  .filter(match => match.round_number === round)
                  .map(match => <HistoricalMatchCard match={match} key={match.id} />)}
              </div>
            ))}
          </div>
        </section>
      ))}

      {consolationMain.length > 0 && (
        <section className="hist-section">
          {printTitle && (
            <div className="bracket-print__header bracket-print__header--repeat">
              <h1>{printTitle}</h1>
              {printMeta && <p>{printMeta}</p>}
            </div>
          )}
          <h3 className="hist-section__title">Утешительный турнир</h3>
          <BracketBoard
            matches={consolationMain}
            maxRound={consolationMax}
            third={consolationThird}
          />
        </section>
      )}
    </div>
  )
}

function HistoricalMatchCard({ match }: { match: Match }) {
  const side = winnerSide(match)
  const scores1 = setScores(match, 1)
  const scores2 = setScores(match, 2)

  return (
    <div className="hist-match">
      <div className={`hist-row${side === 1 ? ' hist-row--win' : ''}`}>
        <span className="hist-name">{sideName(match, 1)}</span>
        <span className="hist-score">
          {scores1.map((value, index) => <span key={index}>{value}</span>)}
        </span>
      </div>
      <div className={`hist-row${side === 2 ? ' hist-row--win' : ''}`}>
        <span className="hist-name">{sideName(match, 2)}</span>
        <span className="hist-score">
          {scores2.map((value, index) => <span key={index}>{value}</span>)}
        </span>
      </div>
      {match.score && scores1.length === 0 && (
        <div className="hist-match__score-text">{match.score}</div>
      )}
    </div>
  )
}
