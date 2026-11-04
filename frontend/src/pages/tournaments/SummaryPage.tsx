import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { matchesApi, tournamentsApi } from '../../api'
import { useAuth } from '../../auth/AuthContext'
import type { Match, PlayerBrief, Tournament } from '../../types'
import './SummaryPage.css'

function sideName(match: Match, side: 1 | 2): string {
  const captain = side === 1 ? match.player1_detail : match.player2_detail
  const partner = side === 1 ? match.pair1_player2_detail : match.pair2_player2_detail
  if (!captain) return 'TBD'
  if (partner) return `${captain.last_name} / ${partner.last_name}`
  return `${captain.last_name} ${captain.first_name}`
}

function fullName(player: PlayerBrief | null): string {
  if (!player) return '—'
  return `${player.last_name} ${player.first_name}`
}

function sidePlayers(match: Match | undefined, side: 1 | 2): PlayerBrief[] {
  if (!match) return []
  const captain = side === 1 ? match.player1_detail : match.player2_detail
  const partner = side === 1 ? match.pair1_player2_detail : match.pair2_player2_detail
  return [captain, partner].filter((p): p is PlayerBrief => Boolean(p))
}

interface Podium {
  first: PlayerBrief[]
  second: PlayerBrief[]
  third: PlayerBrief[]
  fourth: PlayerBrief[]
}

function computePodium(matches: Match[]): Podium | null {
  const winners = matches.filter(m => m.bracket === 'winners')
  if (!winners.length) return null
  const maxRound = Math.max(...winners.map(m => m.round_number))
  const finalMatch = winners.find(m => m.round_number === maxRound)
  if (!finalMatch || !finalMatch.winner) return null

  const winnerSide: 1 | 2 = finalMatch.winner === finalMatch.player1 ? 1 : 2
  const loserSide: 1 | 2 = winnerSide === 1 ? 2 : 1

  const thirdMatch = matches.find(m => m.bracket === 'third_place')
  let third: PlayerBrief[] = []
  let fourth: PlayerBrief[] = []
  if (thirdMatch && thirdMatch.winner) {
    const thirdSide: 1 | 2 = thirdMatch.winner === thirdMatch.player1 ? 1 : 2
    third = sidePlayers(thirdMatch, thirdSide)
    fourth = sidePlayers(thirdMatch, thirdSide === 1 ? 2 : 1)
  } else {
    // 3-е место не сыграно — оба проигравших полуфинала делят третье место
    const semis = winners.filter(m => m.round_number === maxRound - 1 && m.winner)
    third = semis.flatMap(m => {
      const winSide: 1 | 2 = m.winner === m.player1 ? 1 : 2
      return sidePlayers(m, winSide === 1 ? 2 : 1)
    })
  }

  return {
    first: sidePlayers(finalMatch, winnerSide),
    second: sidePlayers(finalMatch, loserSide),
    third,
    fourth,
  }
}

export function SummaryPage() {
  const { id } = useParams()
  const { canEdit } = useAuth()
  const numId = Number(id)

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [summaryText, setSummaryText] = useState('')
  const [savingText, setSavingText] = useState(false)
  const [textSaved, setTextSaved] = useState(false)

  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingRegulation, setUploadingRegulation] = useState(false)
  const [awarding, setAwarding] = useState(false)
  const [contentError, setContentError] = useState<string | null>(null)

  const photoInputRef = useRef<HTMLInputElement>(null)
  const regulationInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      tournamentsApi.get(numId),
      matchesApi.list({ tournament: String(numId), page_size: '200' }),
    ])
      .then(([t, matchData]) => {
        setTournament(t)
        setSummaryText(t.summary_text ?? '')
        setMatches(matchData.results)
      })
      .catch(() => setError('Турнир не найден.'))
      .finally(() => setLoading(false))
  }, [numId])

  const podium = useMemo(() => computePodium(matches), [matches])
  const maxWinnersRound = useMemo(
    () => Math.max(0, ...matches.filter(m => m.bracket === 'winners').map(m => m.round_number)),
    [matches],
  )

  async function handleSaveText() {
    if (!tournament) return
    setSavingText(true)
    setContentError(null)
    try {
      const updated = await tournamentsApi.update(tournament.id, { summary_text: summaryText })
      setTournament(updated)
      setTextSaved(true)
      window.setTimeout(() => setTextSaved(false), 2000)
    } catch {
      setContentError('Не удалось сохранить итоги.')
    } finally {
      setSavingText(false)
    }
  }

  async function handlePhotoUpload(file: File) {
    if (!tournament) return
    setUploadingPhoto(true)
    setContentError(null)
    try {
      const photo = await tournamentsApi.uploadPhoto(tournament.id, file)
      setTournament(current => current ? { ...current, photos: [...current.photos, photo] } : current)
    } catch {
      setContentError('Не удалось загрузить фото.')
    } finally {
      setUploadingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  async function handlePhotoDelete(photoId: number) {
    if (!tournament) return
    if (!confirm('Удалить это фото?')) return
    setContentError(null)
    try {
      await tournamentsApi.deletePhoto(tournament.id, photoId)
      setTournament(current => current
        ? { ...current, photos: current.photos.filter(p => p.id !== photoId) }
        : current)
    } catch {
      setContentError('Не удалось удалить фото.')
    }
  }

  async function handleRegulationUpload(file: File) {
    if (!tournament) return
    setUploadingRegulation(true)
    setContentError(null)
    try {
      const updated = await tournamentsApi.uploadRegulation(tournament.id, file)
      setTournament(updated)
    } catch {
      setContentError('Не удалось загрузить регламент.')
    } finally {
      setUploadingRegulation(false)
      if (regulationInputRef.current) regulationInputRef.current.value = ''
    }
  }

  async function handleAwardPoints() {
    if (!tournament) return
    const question = tournament.points_awards.length
      ? 'Пересчитать очки? Прежние начисления будут сняты и начислены заново.'
      : 'Начислить очки участникам по итогам турнира?'
    if (!confirm(question)) return
    setAwarding(true)
    setContentError(null)
    try {
      await tournamentsApi.awardPoints(tournament.id)
      const updated = await tournamentsApi.get(tournament.id)
      setTournament(updated)
    } catch (err) {
      const data = (err as { data?: { detail?: string } }).data
      setContentError(data?.detail ?? 'Не удалось начислить очки.')
    } finally {
      setAwarding(false)
    }
  }

  if (loading) return <p className="state-msg">Загрузка…</p>
  if (error || !tournament) {
    return (
      <div className="empty-state">
        <p>{error ?? 'Турнир не найден.'}</p>
        <Link to="/tournaments" className="btn btn-ghost">← Турниры</Link>
      </div>
    )
  }

  const finished = tournament.status === 'finished' || tournament.status === 'summing_up'
  return (
    <div className="summary-page">
      <div className="summary-topbar">
        <Link to={`/tournaments/${tournament.id}`} className="back-link">← Турнир</Link>
        <Link to={`/tournaments/${tournament.id}/bracket`} className="btn btn-ghost">Сетка</Link>
      </div>

      <header className="summary-hero">
        <p className="summary-hero__eyebrow">Итоги турнира</p>
        <h1 className="summary-hero__title">{tournament.name}</h1>
        <div className="summary-hero__meta">
          <span>{tournament.start_date}{tournament.end_date ? ` — ${tournament.end_date}` : ''}</span>
          {tournament.location && <span>{tournament.location}</span>}
          <span>{tournament.format_display}</span>
        </div>
      </header>

      {podium ? (
        <section className="summary-podium">
          <PodiumCard place={1} players={podium.first} />
          <PodiumCard place={2} players={podium.second} />
          <PodiumCard place={3} players={podium.third} />
          {podium.fourth.length > 0 && (
            <PodiumCard place={4} players={podium.fourth} />
          )}
        </section>
      ) : (
        <p className="summary-pending">Победители появятся здесь после завершения финала.</p>
      )}

      <section className="summary-block">
        <h2 className="summary-block__title">Что было на турнире</h2>
        {canEdit ? (
          <div className="summary-editor">
            <textarea
              className="summary-editor__area"
              rows={8}
              value={summaryText}
              placeholder="Расскажите, как прошёл турнир: победители, яркие матчи, атмосфера…"
              onChange={event => setSummaryText(event.target.value)}
            />
            <div className="summary-editor__actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={savingText}
                onClick={handleSaveText}
              >
                {savingText ? 'Сохранение…' : 'Сохранить текст'}
              </button>
              {textSaved && <span className="summary-editor__saved">Сохранено</span>}
            </div>
          </div>
        ) : summaryText ? (
          <div className="summary-text">
            {summaryText.split(/\n{2,}/).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <p className="state-msg">Итоги пока не опубликованы.</p>
        )}
      </section>

      <section className="summary-block">
        <div className="summary-block__head">
          <h2 className="summary-block__title">Фотографии</h2>
          {canEdit && (
            <>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (file) handlePhotoUpload(file)
                }}
              />
              <button
                type="button"
                className="btn btn-ghost"
                disabled={uploadingPhoto}
                onClick={() => photoInputRef.current?.click()}
              >
                {uploadingPhoto ? 'Загрузка…' : 'Добавить фото'}
              </button>
            </>
          )}
        </div>

        {tournament.photos.length === 0 ? (
          <p className="state-msg">Фотографий пока нет.</p>
        ) : (
          <div className="summary-gallery">
            {tournament.photos.map(photo => (
              <figure className="summary-gallery__item" key={photo.id}>
                <a href={photo.image} target="_blank" rel="noreferrer">
                  <img src={photo.image} alt={photo.caption || 'Фото турнира'} loading="lazy" />
                </a>
                {photo.caption && <figcaption>{photo.caption}</figcaption>}
                {canEdit && (
                  <button
                    type="button"
                    className="summary-gallery__remove"
                    title="Удалить фото"
                    onClick={() => handlePhotoDelete(photo.id)}
                  >
                    ×
                  </button>
                )}
              </figure>
            ))}
          </div>
        )}
      </section>

      <section className="summary-block">
        <div className="summary-block__head">
          <h2 className="summary-block__title">Регламент</h2>
          {canEdit && (
            <>
              <input
                ref={regulationInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                hidden
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (file) handleRegulationUpload(file)
                }}
              />
              <button
                type="button"
                className="btn btn-ghost"
                disabled={uploadingRegulation}
                onClick={() => regulationInputRef.current?.click()}
              >
                {uploadingRegulation
                  ? 'Загрузка…'
                  : tournament.regulation ? 'Заменить регламент' : 'Загрузить регламент'}
              </button>
            </>
          )}
        </div>
        {tournament.regulation ? (
          <a className="summary-regulation" href={tournament.regulation} target="_blank" rel="noreferrer">
            Скачать регламент (PDF)
          </a>
        ) : (
          <p className="state-msg">Регламент не загружен.</p>
        )}
      </section>

      {matches.length > 0 && (
        <section className="summary-block">
          <h2 className="summary-block__title">Результаты матчей</h2>
          <div className="table-wrap">
            <table className="table summary-results">
              <thead>
                <tr>
                  <th>Круг</th>
                  <th>Матч</th>
                  <th className="col-num">Счёт</th>
                </tr>
              </thead>
              <tbody>
                {matches
                  .filter(m => m.winner && m.player1 && m.player2)
                  .map(match => (
                    <tr key={match.id}>
                      <td className="col-secondary">{roundLabel(match, maxWinnersRound)}</td>
                      <td>
                        <span className={isWinner(match, 1) ? 'summary-results__win' : ''}>
                          {sideName(match, 1)}
                        </span>
                        <span className="col-secondary"> — </span>
                        <span className={isWinner(match, 2) ? 'summary-results__win' : ''}>
                          {sideName(match, 2)}
                        </span>
                      </td>
                      <td className="col-num">{match.score || '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tournament.points_category && (
        <section className="summary-block summary-block--points">
          <div className="summary-block__head">
            <h2 className="summary-block__title">Кому сколько очков начислено</h2>
            {canEdit && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={awarding}
                onClick={handleAwardPoints}
              >
                {awarding
                  ? 'Начисление…'
                  : tournament.points_awards.length ? 'Пересчитать очки' : 'Начислить очки'}
              </button>
            )}
          </div>

          <p className="summary-block__hint">
            Категория: {tournament.points_category_display}
            {tournament.points_awarded_at && (
              <> · начислено {new Date(tournament.points_awarded_at).toLocaleDateString('ru-RU')}</>
            )}
            {!finished && <> · турнир ещё не завершён</>}
          </p>

          {tournament.points_awards.length === 0 ? (
            <p className="state-msg">Очки ещё не начислены.</p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="table summary-points">
                  <thead>
                    <tr>
                      <th>Игрок</th>
                      <th>Место</th>
                      <th className="col-num">Очки</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tournament.points_awards.map(award => (
                      <tr key={award.id}>
                        <td>
                          {award.player_detail.last_name} {award.player_detail.first_name}
                        </td>
                        <td className="col-secondary">{placeLabel(award.place)}</td>
                        <td className="col-num summary-points__value">+{award.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tournament.kind === 'doubles' && (
                <p className="summary-block__hint">
                  В парном разряде очки начисляются каждому игроку пары.
                </p>
              )}
            </>
          )}
        </section>
      )}

      {contentError && <p className="form-error">{contentError}</p>}
    </div>
  )
}

function placeLabel(place: string): string {
  if (place === 'Q') return 'Квалификация'
  if (place.includes('/')) return `${place} финала`
  if (place.includes('-')) return `${place.replace('-', '–')} место`
  if (place === '1') return '1-е место'
  if (place === '2') return '2-е место'
  if (place === '3') return '3-е место'
  if (place === '4') return '4-е место'
  return `${place}-е место`
}

function isWinner(match: Match, side: 1 | 2): boolean {  const captain = side === 1 ? match.player1 : match.player2
  return Boolean(match.winner && captain && match.winner === captain)
}

function roundLabel(match: Match, maxRound: number): string {
  if (match.bracket === 'third_place') return 'За 3-е место'
  if (match.bracket === 'consolation') {
    return `${match.group ? `Подвал ${match.group}` : 'Подвал'} · R${match.round_number}`
  }
  if (match.round_number === maxRound) return 'Финал'
  if (maxRound - match.round_number === 1) return '1/2 финала'
  if (maxRound - match.round_number === 2) return '1/4 финала'
  if (maxRound - match.round_number === 3) return '1/8 финала'
  return `R${match.round_number}`
}

function PodiumCard({ place, players }: { place: number; players: PlayerBrief[] }) {
  const label = place === 1 ? 'Победитель' : place === 2 ? 'Финалист' : place === 3 ? '3-е место' : '4-е место'
  const medal = place === 1 ? '🥇' : place === 2 ? '🥈' : place === 3 ? '🥉' : '4'
  return (
    <div className={`podium-card podium-card--${place}`}>
      <span className="podium-card__medal">{medal}</span>
      <span className="podium-card__label">{label}</span>
      <span className="podium-card__names">
        {players.length ? players.map(fullName).join(' / ') : '—'}
      </span>
    </div>
  )
}
