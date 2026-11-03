import { useState } from 'react'
import { playersApi } from '../api'
import type { Player, PlayerFormData } from '../types'
import './PlayerPicker.css'

interface PlayerPickerProps {
  players: Player[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  excludeIds?: number[]
  allowCreate?: boolean
  onCreated?: (player: Player) => void
  pointsOf?: (player: Player) => number
}

const EMPTY_FORM = {
  last_name: '',
  first_name: '',
  gender: 'male',
  city: '',
  email: '',
}

export function PlayerPicker({
  players,
  value,
  onChange,
  placeholder = 'Выберите игрока',
  excludeIds = [],
  allowCreate = false,
  onCreated,
  pointsOf = player => player.rating,
}: PlayerPickerProps) {
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const excluded = new Set(excludeIds)
  const normalized = query.trim().toLocaleLowerCase('ru-RU')

  const filtered = players
    .filter(player => !excluded.has(player.id))
    .filter(player => {
      if (!normalized) return true
      const fullName = `${player.last_name} ${player.first_name}`.toLocaleLowerCase('ru-RU')
      const reversed = `${player.first_name} ${player.last_name}`.toLocaleLowerCase('ru-RU')
      const city = (player.city || '').toLocaleLowerCase('ru-RU')
      return fullName.includes(normalized) || reversed.includes(normalized) || city.includes(normalized)
    })

  function updateForm(field: keyof typeof EMPTY_FORM, fieldValue: string) {
    setForm(prev => ({ ...prev, [field]: fieldValue }))
    setError(null)
  }

  async function handleCreate() {
    if (!form.last_name.trim() || !form.first_name.trim()) {
      setError('Укажите фамилию и имя.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: PlayerFormData = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || `player_${Date.now()}@tennis.local`,
        phone: '',
        birth_date: null,
        gender: form.gender as PlayerFormData['gender'],
        rating: 1000,
        rating_type: 'elo',
        city: form.city.trim(),
        ntrp_singles: '',
        ntrp_doubles: '',
        points_singles: 0,
        points_doubles: 0,
      }
      const player = await playersApi.create(payload)
      onCreated?.(player)
      onChange(String(player.id))
      setForm(EMPTY_FORM)
      setQuery('')
      setCreating(false)
    } catch (err) {
      const data = (err as { data?: Record<string, string[]> }).data ?? {}
      const firstError = Object.values(data).flat()[0]
      setError(firstError ?? 'Не удалось создать игрока.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="player-picker">
      <input
        className="player-picker__input"
        type="search"
        value={query}
        placeholder="Поиск по фамилии, имени или городу"
        onChange={event => setQuery(event.target.value)}
      />

      <select
        className="player-picker__input"
        value={value}
        onChange={event => onChange(event.target.value)}
      >
        <option value="">{placeholder}</option>
        {filtered.map(player => (
          <option key={player.id} value={player.id}>
            {player.last_name} {player.first_name} ({player.city || '—'}, {pointsOf(player)})
          </option>
        ))}
      </select>

      {normalized && filtered.length === 0 && !creating && (
        <p className="player-picker__hint">Ничего не найдено.</p>
      )}

      {allowCreate && !creating && (
        <button
          className="player-picker__create"
          type="button"
          onClick={() => {
            setCreating(true)
            setError(null)
          }}
        >
          + Новый игрок
        </button>
      )}

      {allowCreate && creating && (
        <div className="player-picker__form">
          <input
            className="player-picker__field"
            placeholder="Фамилия"
            value={form.last_name}
            onChange={event => updateForm('last_name', event.target.value)}
          />
          <input
            className="player-picker__field"
            placeholder="Имя"
            value={form.first_name}
            onChange={event => updateForm('first_name', event.target.value)}
          />
          <select
            className="player-picker__field"
            value={form.gender}
            onChange={event => updateForm('gender', event.target.value)}
          >
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </select>
          <input
            className="player-picker__field"
            placeholder="Город"
            value={form.city}
            onChange={event => updateForm('city', event.target.value)}
          />
          <input
            className="player-picker__field player-picker__field--wide"
            type="email"
            placeholder="Email (необязательно)"
            value={form.email}
            onChange={event => updateForm('email', event.target.value)}
          />
          {error && <p className="player-picker__error">{error}</p>}
          <div className="player-picker__actions">
            <button
              className="btn btn-primary btn-sm"
              type="button"
              disabled={saving}
              onClick={handleCreate}
            >
              {saving ? 'Создание…' : 'Создать'}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              type="button"
              onClick={() => {
                setCreating(false)
                setForm(EMPTY_FORM)
                setError(null)
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
