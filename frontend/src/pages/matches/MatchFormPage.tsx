import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { matchesApi, playersApi, registrationsApi, tournamentsApi } from '../../api'
import { FormField } from '../../components/FormField'
import { categoryLabel } from '../../utils/categories'
import type { Registration } from '../../api/registrations'
import type { MatchApiErrors, MatchFormData, Player, TournamentListItem } from '../../types'
import { playerName } from './matchUtils'
import './MatchFormPage.css'

const EMPTY: MatchFormData = {
  tournament: '',
  gender_type: 'male',
  player1: '',
  pair1_player2: '',
  player2: '',
  pair2_player2: '',
  winner: null,
  status: 'scheduled',
  round_number: 1,
  court: null,
  scheduled_at: '',
  score: '',
  set1_home: null,
  set1_away: null,
  set2_home: null,
  set2_away: null,
  set3_home: null,
  set3_away: null,
}

// datetime-local должен получать локальное время, иначе при сохранении сдвиг на часовой пояс
function toLocalInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function MatchFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()

  const [form, setForm] = useState<MatchFormData>(EMPTY)
  const [errors, setErrors] = useState<MatchApiErrors>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [players, setPlayers] = useState<Player[]>([])
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])

  useEffect(() => {
    const loadRef = Promise.all([
      playersApi.list({ page_size: '500' }).then(d => setPlayers(d.results)),
      tournamentsApi.list({ page_size: '200' }).then(d => setTournaments(d.results)),
    ])

    if (isEdit) {
      Promise.all([loadRef, matchesApi.get(Number(id))])
        .then(([, m]) => setForm({
          tournament: m.tournament,
          gender_type: m.gender_type,
          player1: m.player1 ?? '',
          pair1_player2: m.pair1_player2 ?? '',
          player2: m.player2 ?? '',
          pair2_player2: m.pair2_player2 ?? '',
          winner: m.winner,
          status: m.status,
          round_number: m.round_number,
          court: m.court,
          scheduled_at: toLocalInput(m.scheduled_at),
          score: m.score,
          set1_home: m.set1_home,
          set1_away: m.set1_away,
          set2_home: m.set2_home,
          set2_away: m.set2_away,
          set3_home: m.set3_home,
          set3_away: m.set3_away,
        }))
        .catch(() => navigate('/matches'))
        .finally(() => setLoading(false))
    } else {
      loadRef.finally(() => setLoading(false))
    }
  }, [id, isEdit, navigate])

  function set<K extends keyof MatchFormData>(field: K, value: MatchFormData[K]) {
    setForm(prev => {
      const next = { ...prev, [field]: value }

      // при смене турнира — сбросить игроков и взять категорию турнира
      if (field === 'tournament') {
        next.player1 = ''
        next.pair1_player2 = ''
        next.player2 = ''
        next.pair2_player2 = ''
        next.winner = null
        const chosen = tournaments.find(t => t.id === value)
        if (chosen) {
          next.gender_type = chosen.gender_type as MatchFormData['gender_type']
        }
      }

      // сбросить winner если сменили игроков-капитанов
      if ((field === 'player1' || field === 'player2') && next.winner) {
        if (next.winner !== next.player1 && next.winner !== next.player2) {
          next.winner = null
        }
      }
      return next
    })
    setErrors(prev => ({ ...prev, [field]: undefined }))
  }

  useEffect(() => {
    const tournamentId = form.tournament === '' ? 0 : form.tournament
    if (!tournamentId) {
      setRegistrations([])
      return
    }
    registrationsApi.listForTournament(tournamentId, 'approved')
      .then(data => setRegistrations(data.results))
      .catch(() => setRegistrations([]))
  }, [form.tournament])

  const selectedTournament = tournaments.find(t => t.id === form.tournament)
  const isDoubles = selectedTournament?.kind === 'doubles'

  // пары турнира — для выбора пары целиком, а не двух игроков по отдельности
  const pairs = useMemo(() => {
    const grouped = new Map<number, Registration[]>()
    registrations.forEach(reg => {
      if (reg.pair_id === null) return
      const list = grouped.get(reg.pair_id) ?? []
      list.push(reg)
      grouped.set(reg.pair_id, list)
    })
    return [...grouped.entries()]
      .filter(([, regs]) => regs.length >= 2)
      .sort((a, b) => a[0] - b[0])
      .map(([pairId, regs]) => ({
        pairId,
        players: [regs[0].player, regs[1].player] as [number, number],
        label: `${regs[0].player_detail.last_name} / ${regs[1].player_detail.last_name}`,
      }))
  }, [registrations])

  const pair1Id = pairs.find(pair => (
    Boolean(form.player1 && form.pair1_player2) && (
      (pair.players[0] === form.player1 && pair.players[1] === form.pair1_player2) ||
      (pair.players[0] === form.pair1_player2 && pair.players[1] === form.player1)
    )
  ))?.pairId ?? ''

  const pair2Id = pairs.find(pair => (
    Boolean(form.player2 && form.pair2_player2) && (
      (pair.players[0] === form.player2 && pair.players[1] === form.pair2_player2) ||
      (pair.players[0] === form.pair2_player2 && pair.players[1] === form.player2)
    )
  ))?.pairId ?? ''

  function selectPair(side: 1 | 2, value: string) {
    const pair = pairs.find(item => item.pairId === Number(value))
    setForm(prev => {
      const next = { ...prev }
      if (side === 1) {
        next.player1 = pair ? pair.players[0] : ''
        next.pair1_player2 = pair ? pair.players[1] : ''
      } else {
        next.player2 = pair ? pair.players[0] : ''
        next.pair2_player2 = pair ? pair.players[1] : ''
      }
      if (next.winner !== null && next.winner !== next.player1 && next.winner !== next.player2) {
        next.winner = null
      }
      return next
    })
    setErrors(prev => ({
      ...prev,
      player1: undefined,
      pair1_player2: undefined,
      player2: undefined,
      pair2_player2: undefined,
    }))
  }

  // для winners: только капитаны (player1 и player2)
  const p1 = players.find(p => p.id === form.player1)
  const p2 = players.find(p => p.id === form.player2)
  const captains = [p1, p2].filter(Boolean) as Player[]

  // все задействованные ID в форме
  const usedIds = new Set(
    [form.player1, form.pair1_player2, form.player2, form.pair2_player2].filter(Boolean)
  )

  function playerOptions(excludeExtra?: number | '') {
    return players.map(p => (
      <option
        key={p.id}
        value={p.id}
        disabled={usedIds.has(p.id) && p.id !== excludeExtra}
      >
        {p.last_name} {p.first_name} ({p.rating})
      </option>
    ))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const payload = {
        ...form,
        pair1_player2: (form.pair1_player2 || null) as unknown as number | '',
        pair2_player2: (form.pair2_player2 || null) as unknown as number | '',
        scheduled_at: (form.scheduled_at || null) as unknown as string,
        score: form.score || '',
      }
      if (isEdit) {
        await matchesApi.update(Number(id), payload)
      } else {
        await matchesApi.create(payload as MatchFormData)
      }
      navigate('/matches')
    } catch (err: unknown) {
      const apiErr = err as { data?: MatchApiErrors }
      if (apiErr.data) setErrors(apiErr.data)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="state-msg">Загрузка…</p>

  return (
    <div className="form-page">
      <h1 className="page-title">{isEdit ? 'Редактировать матч' : 'Новый матч'}</h1>

      <form className="form-card" onSubmit={handleSubmit} noValidate>

        <div className="form-row">
          <FormField as="select" label="Турнир" required
            value={String(form.tournament)}
            onChange={e => set('tournament', Number(e.target.value) || '')}
            error={errors.tournament}
          >
            <option value="">— выбрать —</option>
            {tournaments.map(t => (
              <option key={t.id} value={t.id}>
                {t.name} {t.kind === 'doubles' ? '(парный)' : ''}
              </option>
            ))}
          </FormField>

          <FormField
            label="Раунд" type="number" min={1} required
            value={form.round_number}
            onChange={e => set('round_number', Number(e.target.value))}
            error={errors.round_number}
          />

          <FormField
            label="Дата и время" type="datetime-local"
            value={form.scheduled_at ?? ''}
            onChange={e => set('scheduled_at', e.target.value)}
            error={errors.scheduled_at}
          />

          <FormField
            label="Корт" type="number" min={1} max={20}
            value={form.court ?? ''}
            onChange={e => set('court', e.target.value === '' ? null : Number(e.target.value))}
            error={errors.court}
          />
        </div>

        {selectedTournament && (
          <p className="seed-hint">
            Категория матча — «{categoryLabel(selectedTournament.kind, selectedTournament.gender_type)}» —
            задаётся турниром. Статус выставляется сам: есть счёт или победитель — матч завершён,
            иначе он ещё не игрался.
          </p>
        )}

        {/* ── Одиночный: 2 игрока ────────────────────────────────────────── */}
        {!isDoubles && (
          <div className="form-row">
            <FormField as="select" label="Игрок 1" required
              value={String(form.player1)}
              onChange={e => set('player1', Number(e.target.value) || '')}
              error={errors.player1}
            >
              <option value="">— выбрать —</option>
              {playerOptions(form.player1)}
            </FormField>

            <FormField as="select" label="Игрок 2" required
              value={String(form.player2)}
              onChange={e => set('player2', Number(e.target.value) || '')}
              error={errors.player2}
            >
              <option value="">— выбрать —</option>
              {playerOptions(form.player2)}
            </FormField>
          </div>
        )}

        {/* ── Парный: 2 пары ─────────────────────────────────────────────── */}
        {isDoubles && (
          <>
            <div className="form-row">
              <FormField as="select" label="Пара 1" required
                value={String(pair1Id)}
                onChange={e => selectPair(1, e.target.value)}
                error={errors.player1 ?? errors.pair1_player2}
              >
                <option value="">— выбрать —</option>
                {pairs.map(pair => (
                  <option
                    key={pair.pairId}
                    value={pair.pairId}
                    disabled={pair.pairId === pair2Id}
                  >
                    {pair.label}
                  </option>
                ))}
              </FormField>

              <FormField as="select" label="Пара 2" required
                value={String(pair2Id)}
                onChange={e => selectPair(2, e.target.value)}
                error={errors.player2 ?? errors.pair2_player2}
              >
                <option value="">— выбрать —</option>
                {pairs.map(pair => (
                  <option
                    key={pair.pairId}
                    value={pair.pairId}
                    disabled={pair.pairId === pair1Id}
                  >
                    {pair.label}
                  </option>
                ))}
              </FormField>
            </div>
            {pairs.length === 0 && (
              <p className="seed-hint">
                В турнире нет пар — сначала распределите игроков по парам на странице турнира.
              </p>
            )}
          </>
        )}

        {/* ── Счёт по сетам ──────────────────────────────────────────────── */}
        <div className="sets-table">
          <div className="sets-table__head">
            <span className="sets-table__label" />
            <span>{isDoubles ? 'Пара 1' : 'Игрок 1'}</span>
            <span>{isDoubles ? 'Пара 2' : 'Игрок 2'}</span>
          </div>
          {([
            { label: 'Сет 1', home: 'set1_home', away: 'set1_away' },
            { label: 'Сет 2', home: 'set2_home', away: 'set2_away' },
            { label: 'Сет 3', home: 'set3_home', away: 'set3_away' },
          ] as const).map(field => (
            <div className="sets-table__row" key={field.home}>
              <span className="sets-table__label">{field.label}</span>
              <input
                type="number"
                min={0}
                max={99}
                className="sets-table__input"
                value={form[field.home] ?? ''}
                onChange={event => set(field.home, event.target.value === '' ? null : Number(event.target.value))}
              />
              <input
                type="number"
                min={0}
                max={99}
                className="sets-table__input"
                value={form[field.away] ?? ''}
                onChange={event => set(field.away, event.target.value === '' ? null : Number(event.target.value))}
              />
            </div>
          ))}
          <p className="sets-table__hint">
            {selectedTournament
              ? `Сет до ${selectedTournament.set_games}, тай-брейк при ${selectedTournament.set_games === 4 ? '3:3' : '6:6'} до 7. `
              : ''}
            {selectedTournament?.third_set_super_tiebreak
              ? '3-й сет — тай-брейк до 10.'
              : '3-й сет — полный.'}
          </p>
        </div>

        {errors.score && <p className="form-error">{errors.score}</p>}

        <div className="form-row">
          <FormField as="select" label={isDoubles ? 'Победившая пара' : 'Победитель'}
            value={String(form.winner ?? '')}
            onChange={e => set('winner', Number(e.target.value) || null)}
            error={errors.winner}
            disabled={!form.player1 || !form.player2}
          >
            <option value="">— не выбран —</option>
            {isDoubles ? (
              <>
                {p1 && (
                  <option value={p1.id}>
                    Пара 1: {playerName(p1)}{players.find(p => p.id === form.pair1_player2) ? ` / ${playerName(players.find(p => p.id === form.pair1_player2)!)}` : ''}
                  </option>
                )}
                {p2 && (
                  <option value={p2.id}>
                    Пара 2: {playerName(p2)}{players.find(p => p.id === form.pair2_player2) ? ` / ${playerName(players.find(p => p.id === form.pair2_player2)!)}` : ''}
                  </option>
                )}
              </>
            ) : (
              captains.map(p => (
                <option key={p.id} value={p.id}>{playerName(p)}</option>
              ))
            )}
          </FormField>
        </div>

        {form.winner && (
          <p className="seed-hint">
            Победитель автоматически перейдёт в следующий круг, проигравший — в подвал.
          </p>
        )}

        {errors.non_field_errors && (
          <p className="form-error-global">{errors.non_field_errors.join(' ')}</p>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/matches')}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохранение…' : isEdit ? 'Сохранить' : 'Создать матч'}
          </button>
        </div>
      </form>
    </div>
  )
}
