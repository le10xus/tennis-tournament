import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { matchesApi } from '../../api'
import { FormField } from '../../components/FormField'
import type { Match, MatchApiErrors, MatchStatistics } from '../../types'
import { emptyMatchStatistics, hasMatchStatistics } from './matchStatisticsUtils'
import { MatchStatisticsForm } from './MatchStatisticsForm'
import './MatchFormPage.css'
import './MatchStatisticsEditPage.css'

export function MatchStatisticsEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const matchId = Number(id)

  const [match, setMatch] = useState<Match | null>(null)
  const [statistics, setStatistics] = useState<MatchStatistics>(emptyMatchStatistics())
  const [statisticsUrl, setStatisticsUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [errors, setErrors] = useState<MatchApiErrors>({})
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    matchesApi.get(matchId)
      .then(m => {
        setMatch(m)
        setStatistics(m.statistics ?? emptyMatchStatistics())
        setStatisticsUrl(m.statistics_url ?? '')
      })
      .catch(() => navigate(`/matches/${matchId}`))
      .finally(() => setLoading(false))
  }, [matchId, navigate])

  async function handleImport() {
    const url = statisticsUrl.trim()
    if (!url) {
      setMessage('Укажите ссылку на JSON.')
      return
    }
    setImporting(true)
    setMessage(null)
    setErrors({})
    try {
      const updated = await matchesApi.importStatistics(matchId, url)
      setMatch(updated)
      setStatistics(updated.statistics ?? emptyMatchStatistics())
      setStatisticsUrl(updated.statistics_url ?? url)
      setMessage('Статистика загружена. При необходимости отредактируйте поля ниже.')
    } catch (err: unknown) {
      const apiErr = err as { data?: { detail?: string } & MatchApiErrors }
      setMessage(apiErr.data?.detail ?? apiErr.data?.statistics?.join(' ') ?? 'Не удалось загрузить.')
    } finally {
      setImporting(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!match) return
    setSaving(true)
    setMessage(null)
    setErrors({})
    try {
      await matchesApi.update(matchId, {
        statistics: hasMatchStatistics(statistics) ? statistics : null,
        statistics_url: statisticsUrl.trim(),
      })
      navigate(`/matches/${matchId}`)
    } catch (err: unknown) {
      const apiErr = err as { data?: MatchApiErrors }
      if (apiErr.data) setErrors(apiErr.data)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="state-msg">Загрузка…</p>
  if (!match) return null

  const isDoubles = match.kind === 'doubles'

  return (
    <div className="match-stats-edit form-page">
      <div className="match-stats-edit__header">
        <div>
          <Link to={`/matches/${matchId}`} className="back-link">← К матчу</Link>
          <h1 className="page-title">Статистика матча</h1>
          <p className="seed-hint">
            {match.tournament_name} · раунд {match.round_number}
          </p>
        </div>
      </div>

      <form className="form-card" onSubmit={handleSave} noValidate>
        <section className="match-stats-edit__import">
          <h2 className="match-stats-edit__section-title">Загрузка по ссылке</h2>
          <FormField
            label="URL JSON"
            type="url"
            value={statisticsUrl}
            onChange={e => setStatisticsUrl(e.target.value)}
            error={errors.statistics_url}
            placeholder="https://…"
          />
          <div className="match-stats-import__actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={importing}
              onClick={handleImport}
            >
              {importing ? 'Загрузка…' : 'Получить статистику'}
            </button>
          </div>
        </section>

        <section>
          <h2 className="match-stats-edit__section-title">Ручной ввод</h2>
          <MatchStatisticsForm
            match={{
              ...match,
              kind: isDoubles ? 'doubles' : 'singles',
            }}
            value={statistics}
            onChange={setStatistics}
          />
        </section>

        {message && (
          <p className={message.includes('загружена') ? 'form-hint' : 'form-error'}>{message}</p>
        )}
        {errors.statistics && (
          <p className="form-error">{errors.statistics.join(' ')}</p>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={() => navigate(`/matches/${matchId}`)}>
            Отмена
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </form>
    </div>
  )
}
