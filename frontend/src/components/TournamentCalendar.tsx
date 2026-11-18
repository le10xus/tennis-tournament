import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { TournamentListItem } from '../types'
import './TournamentCalendar.css'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge--gray',
  registration: 'badge--blue',
  registration_closed: 'badge--yellow',
  in_progress: 'badge--green',
  summing_up: 'badge--blue',
  finished: 'badge--neutral',
}

type Cell = { iso: string; day: number; inMonth: boolean }

function isoFromParts(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function todayIso(): string {
  const now = new Date()
  return isoFromParts(now.getFullYear(), now.getMonth(), now.getDate())
}

function parseIso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function tournamentEnd(tournament: TournamentListItem): string {
  if (tournament.end_date && tournament.end_date >= tournament.start_date) {
    return tournament.end_date
  }
  return tournament.start_date
}

function coversDay(tournament: TournamentListItem, iso: string): boolean {
  return tournament.start_date <= iso && tournamentEnd(tournament) >= iso
}

function buildCells(year: number, month: number): Cell[] {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Cell[] = []

  for (let i = firstWeekday; i > 0; i -= 1) {
    const date = new Date(year, month, 1 - i)
    cells.push({
      iso: isoFromParts(date.getFullYear(), date.getMonth(), date.getDate()),
      day: date.getDate(),
      inMonth: false,
    })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ iso: isoFromParts(year, month, day), day, inMonth: true })
  }
  const trailing = (7 - (cells.length % 7)) % 7
  for (let day = 1; day <= trailing; day += 1) {
    const date = new Date(year, month + 1, day)
    cells.push({
      iso: isoFromParts(date.getFullYear(), date.getMonth(), date.getDate()),
      day: date.getDate(),
      inMonth: false,
    })
  }
  return cells
}

function formatDay(iso: string): string {
  return parseIso(iso).toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

function formatRange(start: string, end: string | null): string {
  const fmt = (iso: string) =>
    parseIso(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
  if (end && end !== start) return `${fmt(start)} — ${fmt(end)}`
  return fmt(start)
}

function pluralTournaments(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} турнир`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} турнира`
  return `${count} турниров`
}

export function TournamentCalendar({
  tournaments,
  loading,
}: {
  tournaments: TournamentListItem[]
  loading: boolean
}) {
  const today = todayIso()
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selected, setSelected] = useState(today)

  const cells = useMemo(
    () => buildCells(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  )
  const monthStart = isoFromParts(cursor.year, cursor.month, 1)
  const monthEnd = isoFromParts(cursor.year, cursor.month, cells.filter(cell => cell.inMonth).length)
  const monthTournaments = tournaments.filter(
    tournament => tournament.start_date <= monthEnd && tournamentEnd(tournament) >= monthStart,
  )
  const selectedTournaments = tournaments
    .filter(tournament => coversDay(tournament, selected))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))

  const onThisMonth = today >= monthStart && today <= monthEnd

  function shiftMonth(delta: number) {
    setCursor(current => {
      const next = new Date(current.year, current.month + delta, 1)
      return { year: next.getFullYear(), month: next.getMonth() }
    })
  }

  function openDay(iso: string) {
    const date = parseIso(iso)
    setCursor({ year: date.getFullYear(), month: date.getMonth() })
    setSelected(iso)
  }

  function goToday() {
    const now = new Date()
    setCursor({ year: now.getFullYear(), month: now.getMonth() })
    setSelected(today)
  }

  return (
    <div className="cal">
      <div className="cal__nav">
        <button
          type="button"
          className="cal__nav-btn"
          onClick={() => shiftMonth(-1)}
          aria-label="Предыдущий месяц"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="cal__heading">
          <div className="cal__title">{MONTHS[cursor.month]} {cursor.year}</div>
          <div className="cal__caption">
            {loading
              ? 'Загрузка…'
              : monthTournaments.length > 0
                ? `${pluralTournaments(monthTournaments.length)} в этом месяце`
                : 'В этом месяце турниров нет'}
          </div>
        </div>
        <button
          type="button"
          className="cal__nav-btn"
          onClick={() => shiftMonth(1)}
          aria-label="Следующий месяц"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {!onThisMonth && (
        <button type="button" className="cal__today" onClick={goToday}>
          Сегодня
        </button>
      )}

      <div className="cal__weekdays" aria-hidden>
        {WEEKDAYS.map(day => (
          <span key={day} className="cal__weekday">{day}</span>
        ))}
      </div>

      <div className="cal__grid" role="grid" aria-label="Календарь турниров">
        {cells.map(cell => {
          const onDay = tournaments.filter(tournament => coversDay(tournament, cell.iso))
          const className = [
            'cal-day',
            cell.inMonth ? '' : 'cal-day--outside',
            cell.iso === today ? 'cal-day--today' : '',
            onDay.length > 0 ? 'cal-day--marked' : '',
            cell.iso === selected ? 'cal-day--selected' : '',
          ].filter(Boolean).join(' ')
          const names = onDay.map(tournament => tournament.name).join(', ')
          return (
            <button
              key={cell.iso}
              type="button"
              role="gridcell"
              className={className}
              aria-pressed={cell.iso === selected}
              aria-label={names ? `${cell.day}, ${names}` : String(cell.day)}
              onClick={() => openDay(cell.iso)}
            >
              <span className="cal-day__num">{cell.day}</span>
              {onDay.length > 0 && (
                <span className="cal-day__dots" aria-hidden>
                  {Array.from({ length: Math.min(onDay.length, 3) }, (_, index) => (
                    <span key={index} className="cal-day__dot" />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="cal-events">
        <p className="cal-events__date">{formatDay(selected)}</p>
        {!loading && selectedTournaments.length === 0 && (
          <p className="cal-events__empty">В этот день турниров нет.</p>
        )}
        {selectedTournaments.map(tournament => (
          <Link
            key={tournament.id}
            to={`/tournaments/${tournament.id}`}
            className="cal-event"
          >
            <span className="cal-event__top">
              <span className="cal-event__name">{tournament.name}</span>
              <span className={`badge ${STATUS_BADGE[tournament.status] ?? ''}`}>
                {tournament.status_display}
              </span>
            </span>
            <span className="cal-event__meta">
              {formatRange(tournament.start_date, tournament.end_date)}
              {tournament.location ? ` · ${tournament.location}` : ''}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
