import { useEffect, useState, type DragEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { matchesApi, registrationsApi, tournamentsApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import type { Registration } from '../../api/registrations'
import { DoubleElimBracket } from './DoubleElimBracket'
import { HistoricalBracket } from './HistoricalBracket'
import type { Match, Tournament, GenderType } from '../../types'
import {
  type BracketSlot,
  type BracketTarget,
  type EmptyBracketSlot,
  isMatchEditable,
  isSideEmpty,
  matchAtSlot,
  moveBracketSide,
  reorderPairSeeds,
  reorderSeedsByIndex,
} from './bracketDnD'
import './TournamentBracketPage.css'

const SEED_DRAG_TYPE = 'application/x-seed-row'
const BRACKET_DRAG_TYPE = 'application/x-bracket-slot'

function themeBackground(): { css: string; rgb: [number, number, number] } {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  const hex = raw.startsWith('#') ? raw.slice(1) : 'ffffff'
  const full = (hex.length === 3 ? hex.split('').map(ch => ch + ch).join('') : hex).slice(0, 6)
  const value = Number.parseInt(full, 16)
  const rgb: [number, number, number] = Number.isNaN(value)
    ? [255, 255, 255]
    : [(value >> 16) & 255, (value >> 8) & 255, value & 255]
  return { css: `#${full.padEnd(6, '0')}`, rgb }
}

function scheduleWhen(value: string) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function scheduleSide(match: Match, side: 1 | 2) {
  const captain = side === 1 ? match.player1_detail : match.player2_detail
  const partner = side === 1 ? match.pair1_player2_detail : match.pair2_player2_detail
  if (!captain) return '—'
  if (partner) return `${captain.last_name} / ${partner.last_name}`
  return `${captain.last_name} ${captain.first_name}`
}

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
  const [scheduling, setScheduling] = useState(false)
  const [onlySeeded, setOnlySeeded] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [scheduleMessage, setScheduleMessage] = useState<string | null>(null)
  const [swappingBracket, setSwappingBracket] = useState(false)
  const [bracketSwapError, setBracketSwapError] = useState<string | null>(null)
  const [showSchedule, setShowSchedule] = useState(
    () => localStorage.getItem('bracket.showSchedule') !== 'false',
  )
  const [pdfLoading, setPdfLoading] = useState(false)

  function toggleSchedule(value: boolean) {
    setShowSchedule(value)
    localStorage.setItem('bracket.showSchedule', String(value))
  }
  const [dragSeedIndex, setDragSeedIndex] = useState<number | null>(null)
  const [dragPairIndex, setDragPairIndex] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      tournamentsApi.get(numId),
      registrationsApi.listForTournament(numId, 'approved'),
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
    const regs = await registrationsApi.listForTournament(numId, 'approved')
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
    if (tournament?.format === 'double_elim' && matches.length > 0) {
      const ok = confirm(
        'Перегенерировать сетку? Все матчи, включая результаты, будут удалены.',
      )
      if (!ok) return
    }
    setGenerating(true)
    setGenError(null)
    try {
      const newMatches = await tournamentsApi.generateBracket(numId, { only_seeded: onlySeeded })
      setMatches(Array.isArray(newMatches) ? newMatches : [])
    } catch (err: unknown) {
      const e = err as { data?: { detail?: string } }
      setGenError(e.data?.detail ?? 'Не удалось сгенерировать сетку.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSchedule() {
    setScheduling(true)
    setGenError(null)
    setScheduleMessage(null)
    try {
      const result = await tournamentsApi.generateSchedule(numId)
      setMatches(result.matches)
      setScheduleMessage(result.message)
    } catch (err: unknown) {
      const e = err as { data?: { detail?: string } }
      setGenError(e.data?.detail ?? 'Не удалось составить расписание.')
    } finally {
      setScheduling(false)
    }
  }

  async function handleDownloadPdf() {
    setGenError(null)
    if (!tournament) return
    setPdfLoading(true)
    const element = document.querySelector<HTMLElement>('.bracket-print')
    const h2c = (window as unknown as {
      html2canvas?: (
        element: HTMLElement,
        options?: Record<string, unknown>,
      ) => Promise<HTMLCanvasElement>
    }).html2canvas
    const JsPDF = (window as unknown as {
      jspdf?: {
        jsPDF?: new (options: Record<string, unknown>) => {
          internal: { pageSize: { getWidth: () => number; getHeight: () => number } }
          addImage: (...args: unknown[]) => void
          addPage: () => void
          setFillColor: (...args: unknown[]) => void
          rect: (...args: unknown[]) => void
          save: (name: string) => void
        }
      }
    }).jspdf?.jsPDF

    if (!element || !h2c || !JsPDF) {
      setPdfLoading(false)
      setGenError('PDF-модуль не загрузился. Обнови страницу.')
      return
    }

    document.body.classList.add('pdf-export')
    try {
      await new Promise<void>(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      })
      const background = themeBackground()
      const canvas = await h2c(element, {
        backgroundColor: background.css,
        scale: 1.5,
        useCORS: true,
        logging: false,
        windowWidth: element.scrollWidth,
      })
      const pdf = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const sliceHeight = Math.floor((canvas.width * pageH) / pageW)
      let offset = 0
      let firstPage = true

      while (offset < canvas.height) {
        const height = Math.min(sliceHeight, canvas.height - offset)
        const slice = document.createElement('canvas')
        slice.width = canvas.width
        slice.height = height
        const context = slice.getContext('2d')
        if (!context) break
        context.fillStyle = background.css
        context.fillRect(0, 0, slice.width, slice.height)
        context.drawImage(canvas, 0, offset, canvas.width, height, 0, 0, canvas.width, height)
        if (!firstPage) pdf.addPage()
        pdf.setFillColor(...background.rgb)
        pdf.rect(0, 0, pageW, pageH, 'F')
        pdf.addImage(
          slice.toDataURL('image/jpeg', 0.92),
          'JPEG',
          0,
          0,
          pageW,
          (height * pageW) / canvas.width,
        )
        firstPage = false
        offset += height
      }

      const dates = tournament.end_date && tournament.end_date !== tournament.start_date
        ? `${tournament.start_date}—${tournament.end_date}`
        : tournament.start_date
      const fileName = `${tournament.name} ${dates}`
        .replace(/[\\/:*?"<>|]+/g, '-')
        .replace(/\s+/g, ' ')
        .trim()
      pdf.save(`${fileName}.pdf`)
    } catch {
      setGenError('Не удалось сформировать PDF.')
    } finally {
      document.body.classList.remove('pdf-export')
      setPdfLoading(false)
    }
  }

  async function handleBracketMove(from: BracketSlot, to: BracketTarget) {
    if (!tournament) return
    setSwappingBracket(true)
    setBracketSwapError(null)
    try {
      const updated = await moveBracketSide(matches, from, to, {
        tournamentId: tournament.id,
        genderType: tournament.gender_type as GenderType,
      })
      setMatches(updated)
    } catch (err: unknown) {
      const e = err as { data?: { non_field_errors?: string[]; detail?: string }; message?: string }
      setBracketSwapError(
        e.data?.non_field_errors?.[0]
        ?? e.data?.detail
        ?? (err instanceof Error ? err.message : 'Не удалось изменить сетку.')
      )
    } finally {
      setSwappingBracket(false)
    }
  }

  function handleSeedReorder(fromIndex: number, toIndex: number) {
    const ordered = sortedRegs(registrations)
    setSeeds(prev => ({ ...prev, ...reorderSeedsByIndex(ordered, fromIndex, toIndex) }))
  }

  function handlePairReorder(fromIndex: number, toIndex: number) {
    const pairs = buildPairs(registrations)
    const { pairSeeds: nextSeeds, pairIds: nextPairIds } = reorderPairSeeds(pairs, fromIndex, toIndex)
    setPairSeeds(prev => ({ ...prev, ...nextSeeds }))
    setPairIds(prev => ({ ...prev, ...nextPairIds }))
  }

  if (loading) return <p className="state-msg">Загрузка…</p>
  if (error || !tournament) return (
    <div className="empty-state">
      <p>{error ?? 'Турнир не найден.'}</p>
      <button className="btn btn-ghost" onClick={() => navigate('/tournaments')}>← Назад</button>
    </div>
  )

  const isDoubles = tournament.kind === 'doubles'
  const isHistorical = matches.some(match => match.is_historical)
  const scheduledMatches = matches
    .filter(match => !match.is_historical && match.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
  const fmt = tournament.format

  return (
    <div className="bracket-page">
      <div className="bracket-page__header">
        <div>
          <Link to={`/tournaments/${numId}?view=info`} className="back-link">← {tournament.name}</Link>
          <h1 className="page-title">Турнирная сетка</h1>
        </div>
        <span className="badge badge--blue">{tournament.format_display}</span>
      </div>

      {/* ── Seeding panel (editors only; для сетки с подвалом посев автоматический) ── */}
      {canEdit && registrations.length > 0 && fmt !== 'double_elim' && (
        <section className="bracket-section">
          <h2 className="section-title">
            {isDoubles ? 'Пары и посевы' : 'Посевы участников'}
          </h2>

          <p className="seed-hint">
            Перетащите строки, чтобы изменить порядок посева, или введите номера вручную.
          </p>

          {isDoubles ? (
            <DoubleSeedingPanel
              registrations={registrations}
              pairSeeds={pairSeeds}
              pairIds={pairIds}
              dragPairIndex={dragPairIndex}
              onSeedChange={(id, v) => setPairSeeds(prev => ({ ...prev, [id]: v }))}
              onPairChange={(id, v) => setPairIds(prev => ({ ...prev, [id]: v }))}
              onPairReorder={handlePairReorder}
              onDragPairIndexChange={setDragPairIndex}
            />
          ) : (
            <SingleSeedingPanel
              registrations={registrations}
              seeds={seeds}
              dragSeedIndex={dragSeedIndex}
              onSeedChange={(id, v) => setSeeds(prev => ({ ...prev, [id]: v }))}
              onSeedReorder={handleSeedReorder}
              onDragSeedIndexChange={setDragSeedIndex}
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
        <section className="bracket-section bracket-print">
          <div className="bracket-print__header">
            <h1>{tournament.name}</h1>
            <p>
              {tournament.start_date}
              {tournament.end_date ? ` — ${tournament.end_date}` : ''}
              {tournament.location ? ` · ${tournament.location}` : ''}
              {tournament.format_display ? ` · ${tournament.format_display}` : ''}
            </p>
          </div>
          <h2 className="section-title">
            Сетка
            <span className="section-count">{matches.length}</span>
          </h2>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginBottom: '0.75rem' }}
            disabled={pdfLoading}
            onClick={handleDownloadPdf}
          >
            {pdfLoading ? 'Формируем PDF…' : 'Скачать PDF'}
          </button>
          <label className="schedule-toggle">
            <input
              type="checkbox"
              checked={showSchedule}
              onChange={event => toggleSchedule(event.target.checked)}
            />
            Показывать расписание
          </label>
          {canEdit && fmt === 'double_elim' && !isHistorical && (
            <label className="only-seeded-toggle" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginRight: '0.75rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={onlySeeded}
                onChange={event => setOnlySeeded(event.target.checked)}
              />
              Только сеяные
            </label>
          )}
          {canEdit && fmt === 'double_elim' && !isHistorical && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginBottom: '0.75rem' }}
              disabled={generating}
              onClick={handleGenerate}
            >
              {generating ? 'Генерация…' : 'Перегенерировать сетку'}
            </button>
          )}
          {canEdit && !isHistorical && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginBottom: '0.75rem', marginLeft: '0.5rem' }}
              disabled={scheduling}
              onClick={handleSchedule}
            >
              {scheduling ? 'Составление…' : 'Составить расписание на день'}
            </button>
          )}
          {scheduleMessage && (
            <p className="seed-hint" style={{ marginTop: '-0.25rem' }}>{scheduleMessage}</p>
          )}
          {canEdit && fmt !== 'double_elim' && (
            <p className="seed-hint">
              {swappingBracket
                ? 'Сохранение изменений…'
                : 'Перетащите участников между слотами, в том числе на свободные (TBD).'}
            </p>
          )}
          {bracketSwapError && (
            <p className="form-error-global" style={{ marginBottom: '0.75rem' }}>{bracketSwapError}</p>
          )}
          {isHistorical && fmt === 'double_elim' ? (
            <DoubleElimBracket
              matches={matches}
              registrations={registrations}
              isDoubles={isDoubles}
              editable={canEdit}
              showSchedule={showSchedule}
            />
          ) : isHistorical ? (
            <HistoricalBracket
              matches={matches}
              printTitle={tournament.name}
              printMeta={`${tournament.start_date}${tournament.end_date ? ` — ${tournament.end_date}` : ''}${tournament.location ? ` · ${tournament.location}` : ''}`}
              editable={canEdit}
            />
          ) : fmt === 'round_robin' ? (
            <RoundRobinView
              matches={matches}
              registrations={registrations}
              isDoubles={isDoubles}
              editable={canEdit}
              onMove={handleBracketMove}
            />
          ) : fmt === 'double_elim' ? (
            <DoubleElimBracket
              matches={matches}
              registrations={registrations}
              isDoubles={isDoubles}
              editable={canEdit}
              showSchedule={showSchedule}
            />
          ) : (
            <SingleElimView
              matches={matches}
              registrations={registrations}
              isDoubles={isDoubles}
              editable={canEdit}
              onMove={handleBracketMove}
            />
          )}

          {showSchedule && scheduledMatches.length > 0 && (
            <div className="bracket-print__schedule">
              <h3 className="bracket-print__schedule-title">Расписание</h3>
              <table>
                <thead>
                  <tr>
                    <th>Когда</th>
                    <th>Корт</th>
                    <th>Матч</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduledMatches.map(match => (
                    <tr key={match.id}>
                      <td>{scheduleWhen(match.scheduled_at!)}</td>
                      <td>{match.court ?? '—'}</td>
                      <td>
                        {scheduleSide(match, 1)} — {scheduleSide(match, 2)}
                        {match.score ? ` · ${match.score}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {matches.length === 0 && registrations.length >= 2 && (
        <div className="empty-state" style={{ marginTop: '1rem' }}>
          <p>Сетка ещё не сгенерирована.</p>
          {canEdit && fmt === 'double_elim' && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={onlySeeded}
                onChange={event => setOnlySeeded(event.target.checked)}
              />
              Только сеяные
            </label>
          )}
          {canEdit && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={generating}
              onClick={handleGenerate}
            >
              {generating ? 'Генерация…' : 'Сгенерировать сетку'}
            </button>
          )}
          {genError && <p className="form-error-global">{genError}</p>}
        </div>
      )}
    </div>
  )
}

// ── Seeding panels ─────────────────────────────────────────────────────────────

function SingleSeedingPanel({
  registrations, seeds, dragSeedIndex, onSeedChange, onSeedReorder, onDragSeedIndexChange,
}: {
  registrations: Registration[]
  seeds: Record<number, string>
  dragSeedIndex: number | null
  onSeedChange: (id: number, v: string) => void
  onSeedReorder: (fromIndex: number, toIndex: number) => void
  onDragSeedIndexChange: (index: number | null) => void
}) {
  const ordered = sortedRegsForPanel(registrations)

  function handleDragStart(e: DragEvent<HTMLTableRowElement>, index: number) {
    e.dataTransfer.setData(SEED_DRAG_TYPE, String(index))
    e.dataTransfer.effectAllowed = 'move'
    onDragSeedIndexChange(index)
  }

  function handleDrop(e: DragEvent<HTMLTableRowElement>, toIndex: number) {
    e.preventDefault()
    const fromIndex = Number(e.dataTransfer.getData(SEED_DRAG_TYPE))
    if (!Number.isNaN(fromIndex)) {
      onSeedReorder(fromIndex, toIndex)
    }
    onDragSeedIndexChange(null)
  }

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
          {ordered.map((reg, index) => (
            <tr
              key={reg.id}
              className={[
                'seed-row',
                dragSeedIndex === index ? 'seed-row--dragging' : '',
              ].filter(Boolean).join(' ')}
              draggable
              onDragStart={e => handleDragStart(e, index)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handleDrop(e, index)}
              onDragEnd={() => onDragSeedIndexChange(null)}
            >
              <td className="col-num">
                <span className="seed-drag-handle" title="Перетащите для изменения порядка">⠿</span>
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
  registrations, pairSeeds, pairIds, dragPairIndex,
  onSeedChange, onPairChange, onPairReorder, onDragPairIndexChange,
}: {
  registrations: Registration[]
  pairSeeds: Record<number, string>
  pairIds: Record<number, string>
  dragPairIndex: number | null
  onSeedChange: (id: number, v: string) => void
  onPairChange: (id: number, v: string) => void
  onPairReorder: (fromIndex: number, toIndex: number) => void
  onDragPairIndexChange: (index: number | null) => void
}) {
  const pairs = buildPairs(registrations)

  function handlePairDragStart(e: DragEvent<HTMLDivElement>, index: number) {
    e.dataTransfer.setData(SEED_DRAG_TYPE, String(index))
    e.dataTransfer.effectAllowed = 'move'
    onDragPairIndexChange(index)
  }

  function handlePairDrop(e: DragEvent<HTMLDivElement>, toIndex: number) {
    e.preventDefault()
    const fromIndex = Number(e.dataTransfer.getData(SEED_DRAG_TYPE))
    if (!Number.isNaN(fromIndex)) {
      onPairReorder(fromIndex, toIndex)
    }
    onDragPairIndexChange(null)
  }

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

      {pairs.length > 0 && (
        <div className="pair-seed-list">
          <div className="pair-seed-list__title">Порядок пар (drag &amp; drop)</div>
          {pairs.map((pair, index) => (
            <div
              key={pair.pairId}
              className={[
                'pair-seed-row',
                dragPairIndex === index ? 'pair-seed-row--dragging' : '',
              ].filter(Boolean).join(' ')}
              draggable
              onDragStart={e => handlePairDragStart(e, index)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => handlePairDrop(e, index)}
              onDragEnd={() => onDragPairIndexChange(null)}
            >
              <span className="seed-drag-handle">⠿</span>
              <span className="pair-seed-row__seed">{index + 1}</span>
              <span className="pair-seed-row__names">
                {pair.p1.player_detail.last_name} / {pair.p1.player_detail.first_name}
                {' + '}
                {pair.p2.player_detail.last_name} / {pair.p2.player_detail.first_name}
              </span>
            </div>
          ))}
        </div>
      )}

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
  matches, registrations, isDoubles, editable, onMove,
}: {
  matches: Match[]
  registrations: Registration[]
  isDoubles: boolean
  editable: boolean
  onMove: (from: BracketSlot, to: BracketTarget) => Promise<void>
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

        return (
          <div key={round} className="bracket__round">
            <div className="bracket__round-title">{roundLabel(round)}</div>
            <div className="bracket__slots">
              {Array.from({ length: slotCount }, (_, si) => {
                const match = matchAtSlot(matches, round, si)
                return (
                  <div key={si} className="bracket__slot" style={{ height: slotHeight }}>
                    {match ? (
                      <MatchCard
                        match={match}
                        isDoubles={isDoubles}
                        editable={editable && isMatchEditable(match)}
                        onMove={onMove}
                      />
                    ) : (
                      <TbdMatchCard
                        round={round}
                        slotIndex={si}
                        editable={editable}
                        onMove={onMove}
                      />
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
  matches, registrations, isDoubles, editable, onMove,
}: {
  matches: Match[]
  registrations: Registration[]
  isDoubles: boolean
  editable: boolean
  onMove: (from: BracketSlot, to: BracketTarget) => Promise<void>
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
                  .map(m => (
                    <MatchCard
                      key={m.id}
                      match={m}
                      isDoubles={isDoubles}
                      editable={editable && isMatchEditable(m)}
                      onMove={onMove}
                    />
                  ))}
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
    if (!match.player1_detail) return 'TBD'
    const p2 = match.pair1_player2_detail
    return p2
      ? `${match.player1_detail.last_name} / ${p2.last_name}`
      : `${match.player1_detail.last_name} ${match.player1_detail.first_name}`
  }
  if (!match.player2_detail) return 'TBD'
  const p2 = match.pair2_player2_detail
  return p2
    ? `${match.player2_detail.last_name} / ${p2.last_name}`
    : `${match.player2_detail.last_name} ${match.player2_detail.first_name}`
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

function sortedRegsForPanel(regs: Registration[]) {
  return [...regs].sort((a, b) => {
    if (a.seed === null) return 1
    if (b.seed === null) return -1
    return a.seed - b.seed
  })
}

function sideLabel(match: Match, side: 1 | 2, isDoubles: boolean): string {
  if (isSideEmpty(match, side)) return 'Свободно'
  if (isDoubles) return pairLabel(match, side)
  const detail = side === 1 ? match.player1_detail : match.player2_detail
  return detail ? `${detail.last_name} ${detail.first_name}` : 'TBD'
}

function useBracketDropHandlers(
  editable: boolean,
  onMove: ((from: BracketSlot, to: BracketTarget) => Promise<void>) | undefined,
  target: BracketTarget,
) {
  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!editable || !onMove) return
    e.preventDefault()
    e.currentTarget.classList.add('bracket__player-row--drop-target')
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.currentTarget.classList.remove('bracket__player-row--drop-target')
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    if (!editable || !onMove) return
    e.preventDefault()
    e.currentTarget.classList.remove('bracket__player-row--drop-target')
    const raw = e.dataTransfer.getData(BRACKET_DRAG_TYPE)
    if (!raw) return
    const from = JSON.parse(raw) as BracketSlot
    await onMove(from, target)
  }

  return { handleDragOver, handleDragLeave, handleDrop }
}

function TbdMatchCard({
  round, slotIndex, editable, onMove,
}: {
  round: number
  slotIndex: number
  editable: boolean
  onMove?: (from: BracketSlot, to: BracketTarget) => Promise<void>
}) {
  return (
    <div className={`bracket__match-card bracket__match-card--tbd${editable ? ' bracket__match-card--editable' : ''}`}>
      <EmptyBracketRow side={1} round={round} slotIndex={slotIndex} editable={editable} onMove={onMove} />
      <div className="bracket__divider" />
      <EmptyBracketRow side={2} round={round} slotIndex={slotIndex} editable={editable} onMove={onMove} />
    </div>
  )
}

function EmptyBracketRow({
  side, round, slotIndex, editable, onMove,
}: {
  side: 1 | 2
  round: number
  slotIndex: number
  editable: boolean
  onMove?: (from: BracketSlot, to: BracketTarget) => Promise<void>
}) {
  const target: EmptyBracketSlot = { type: 'empty', round, slotIndex, side }
  const { handleDragOver, handleDragLeave, handleDrop } = useBracketDropHandlers(editable, onMove, target)

  return (
    <div
      className={[
        'bracket__player-row',
        'bracket__player-row--empty-slot',
        editable ? 'bracket__player-row--droppable' : 'bracket__tbd',
      ].filter(Boolean).join(' ')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {editable ? 'Свободно' : 'TBD'}
    </div>
  )
}

function MatchCard({
  match, isDoubles, editable = false, onMove,
}: {
  match: Match
  isDoubles: boolean
  editable?: boolean
  onMove?: (from: BracketSlot, to: BracketTarget) => Promise<void>
}) {
  const p1Win = match.winner !== null && match.player1 !== null && match.winner === match.player1
  const p2Win = match.winner !== null && match.player2 !== null && match.winner === match.player2

  function handleDragStart(e: DragEvent<HTMLDivElement>, side: 1 | 2) {
    if (!editable || !onMove || isSideEmpty(match, side)) return
    e.dataTransfer.setData(BRACKET_DRAG_TYPE, JSON.stringify({ matchId: match.id, side }))
    e.dataTransfer.effectAllowed = 'move'
    e.currentTarget.classList.add('bracket__player-row--dragging')
  }

  function handleDragEnd(e: DragEvent<HTMLDivElement>) {
    e.currentTarget.classList.remove('bracket__player-row--dragging')
    document.querySelectorAll('.bracket__player-row--drop-target').forEach(el => {
      el.classList.remove('bracket__player-row--drop-target')
    })
  }

  function renderRow(side: 1 | 2, winner: boolean) {
    const empty = isSideEmpty(match, side)
    const target: BracketSlot = { matchId: match.id, side }
    const { handleDragOver, handleDragLeave, handleDrop } = useBracketDropHandlers(editable, onMove, target)
    const canDrag = editable && !empty
    const canDrop = editable

    return (
      <div
        className={[
          'bracket__player-row',
          winner ? 'bracket__player-row--winner' : '',
          canDrag ? 'bracket__player-row--draggable' : '',
          empty && canDrop ? 'bracket__player-row--empty-slot bracket__player-row--droppable' : '',
          empty ? 'bracket__tbd' : '',
        ].filter(Boolean).join(' ')}
        draggable={canDrag}
        onDragStart={e => handleDragStart(e, side)}
        onDragEnd={handleDragEnd}
        onDragOver={canDrop ? handleDragOver : undefined}
        onDragLeave={canDrop ? handleDragLeave : undefined}
        onDrop={canDrop ? handleDrop : undefined}
      >
        {canDrag && <span className="seed-drag-handle">⠿</span>}
        <span className="bracket__player-name">{sideLabel(match, side, isDoubles)}</span>
        {match.score && winner && <span className="bracket__score">{match.score}</span>}
      </div>
    )
  }

  return (
    <div className={`bracket__match-card${editable ? ' bracket__match-card--editable' : ''}`}>
      {renderRow(1, p1Win)}
      <div className="bracket__divider" />
      {renderRow(2, p2Win)}
    </div>
  )
}
