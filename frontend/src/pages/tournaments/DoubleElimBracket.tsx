import { Link } from 'react-router-dom'
import type { Match, PlayerBrief } from '../../types'
import type { Registration } from '../../api/registrations'
import { statusBadge } from '../matches/matchUtils'
import './DoubleElimBracket.css'

interface DoubleElimBracketProps {
  matches: Match[]
  registrations: Registration[]
  isDoubles: boolean
  editable: boolean
}

function byRound(list: Match[], round: number) {
  return list
    .filter(match => match.round_number === round)
    .sort((a, b) => a.slot_index - b.slot_index)
}

function formatWhen(value: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const BASEMENT_NUMBERS = [1, 2, 3, 4]
const BASEMENT_LABELS = [
  'Победитель на 8',
  'Победитель на 7',
  'Победитель на 6',
  'Победитель на 5',
]
const MAIN_QF_LABELS = [
  'Проигравший на 2',
  'Проигравший на 1',
  'Проигравший на 4',
  'Проигравший на 3',
]
const MAIN_QF2_NUMBERS = [5, 6, 7, 8]

export function DoubleElimBracket({
  matches,
  registrations,
  isDoubles,
  editable,
}: DoubleElimBracketProps) {
  const main = matches.filter(m => m.bracket === 'winners')
  const basement = matches.filter(m => m.bracket === 'consolation')
  const thirdPlace = matches
    .filter(m => m.bracket === 'third_place')
    .sort((a, b) => a.slot_index - b.slot_index)

  const seedByPlayer = new Map<number, number>()
  registrations.forEach(reg => {
    if (reg.seed !== null) seedByPlayer.set(reg.player, reg.seed)
  })

  const columns = [
    {
      key: 'b2',
      title: 'Подвал · 1/4 · 5–8',
      matches: byRound(basement, 2),
      secondNumbers: BASEMENT_NUMBERS,
      footers: BASEMENT_LABELS,
      footerKind: 'winner' as const,
    },
    { key: 'b1', title: 'Подвал · 1/4 · 9–16', matches: byRound(basement, 1) },
    { key: 'm1', title: '1/8', matches: byRound(main, 1) },
    {
      key: 'm2',
      title: '1/4',
      matches: byRound(main, 2),
      footers: MAIN_QF_LABELS,
      footerKind: 'loser' as const,
    },
    {
      key: 'm3',
      title: '1/4',
      matches: byRound(main, 3),
      secondNumbers: MAIN_QF2_NUMBERS,
    },
    { key: 'm4', title: '1/2', matches: byRound(main, 4) },
    { key: 'm5', title: 'Финал', matches: byRound(main, 5), final: true },
  ].filter(column => column.matches.length > 0)

  const renderCard = (
    match: Match,
    options: {
      highlight?: boolean
      secondNumber?: number
      footer?: string
      footerKind?: 'winner' | 'loser'
    } = {},
  ) => (
    <MatchCard
      key={match.id}
      match={match}
      isDoubles={isDoubles}
      editable={editable}
      seedByPlayer={seedByPlayer}
      {...options}
    />
  )

  return (
    <div className="de-bracket">
      <div className="de-board">
        {columns.map(column => {
          const footers = 'footers' in column ? column.footers : undefined
          const secondNumbers = 'secondNumbers' in column ? column.secondNumbers : undefined
          const footerKind = 'footerKind' in column ? column.footerKind : undefined
          return (
            <div className={`de-col${'final' in column && column.final ? ' de-col--final' : ''}`} key={column.key}>
              <div className="de-col__title">{column.title}</div>
              <div className="de-col__body">
                {column.matches.map((match, index) => renderCard(match, {
                  highlight: 'final' in column && Boolean(column.final),
                  secondNumber: secondNumbers?.[index],
                  footer: footers?.[index],
                  footerKind,
                }))}
                {'final' in column && column.final && thirdPlace.length > 0 && (
                  <div className="de-col__third">
                    <div className="de-col__subtitle">3-е место</div>
                    {thirdPlace.map(match => renderCard(match))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {editable && (
        <p className="de-bracket__hint">
          Нажмите ✎, чтобы изменить участников, счёт, победителя, дату и корт.
        </p>
      )}
    </div>
  )
}

function sideName(
  captain: PlayerBrief | null,
  partner: PlayerBrief | null,
  isDoubles: boolean,
) {
  if (!captain) return ''
  if (isDoubles && partner) return `${captain.last_name} / ${partner.last_name}`
  return `${captain.last_name} ${captain.first_name}`
}

function MatchCard({
  match,
  isDoubles,
  editable,
  highlight = false,
  seedByPlayer,
  secondNumber,
  footer,
  footerKind = 'winner',
}: {
  match: Match
  isDoubles: boolean
  editable: boolean
  highlight?: boolean
  seedByPlayer: Map<number, number>
  secondNumber?: number
  footer?: string
  footerKind?: 'winner' | 'loser'
}) {
  const side1 = sideName(match.player1_detail, match.pair1_player2_detail, isDoubles)
  const side2 = sideName(match.player2_detail, match.pair2_player2_detail, isDoubles)
  const seed1 = match.player1 ? seedByPlayer.get(match.player1) : undefined
  const seed2 = match.player2 ? seedByPlayer.get(match.player2) : undefined
  const winnerSide = match.winner
    ? (match.winner === match.player1 ? 1 : match.winner === match.player2 ? 2 : 0)
    : 0
  const when = formatWhen(match.scheduled_at)

  return (
    <div className={`de-match${highlight ? ' de-match--final' : ''}`}>
      <div className="de-match__players">
        <div className={`de-match__row${winnerSide === 1 ? ' de-match__row--win' : ''}`}>
          {seed1 && <span className="de-match__seed" title="Сеяный">№{seed1}</span>}
          <span className={`de-match__name${!side1 ? ' de-match__name--tbd' : ''}`} title={side1}>
            {side1 || '—'}
          </span>
        </div>
        <div className={`de-match__row${winnerSide === 2 ? ' de-match__row--win' : ''}`}>
          {secondNumber !== undefined && (
            <span className={`de-match__num de-match__num--${footerKind === 'loser' ? 'red' : 'blue'}`}>
              {secondNumber}
            </span>
          )}
          {seed2 && <span className="de-match__seed" title="Сеяный">№{seed2}</span>}
          <span className={`de-match__name${!side2 ? ' de-match__name--tbd' : ''}`} title={side2}>
            {side2 || '—'}
          </span>
        </div>
      </div>

      <div className="de-match__meta">
        <span className="de-match__when">
          {when || '—'}
          {match.court ? ` · корт ${match.court}` : ''}
        </span>
        {match.score && <span className="de-match__score">{match.score}</span>}
        {match.status !== 'scheduled' && (
          <span className={`badge ${statusBadge(match.status)}`}>
            {match.status_display}
          </span>
        )}
      </div>

      {footer && (
        <div className={`de-match__footer de-match__footer--${footerKind}`}>
          {footer}
        </div>
      )}

      {editable && (
        <Link
          to={`/matches/${match.id}/edit`}
          className="de-match__edit"
          title="Изменить матч"
          aria-label={`Изменить матч ${side1 || ''} — ${side2 || ''}`}
        >
          ✎
        </Link>
      )}
    </div>
  )
}
