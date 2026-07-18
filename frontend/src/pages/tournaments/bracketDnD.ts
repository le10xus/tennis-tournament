import { matchesApi } from '../../api'
import type { GenderType, Match, MatchFormData } from '../../types'

export interface BracketSlot {
  matchId: number
  side: 1 | 2
}

export interface EmptyBracketSlot {
  type: 'empty'
  round: number
  slotIndex: number
  side: 1 | 2
}

export type BracketTarget = BracketSlot | EmptyBracketSlot

export interface MoveContext {
  tournamentId: number
  genderType: GenderType
}

interface SidePlayers {
  captain: number
  partner: number | null
}

export function isMatchEditable(match: Match): boolean {
  return match.status !== 'finished' && match.status !== 'walkover' && !match.winner
}

export function isSideEmpty(match: Match, side: 1 | 2): boolean {
  return side === 1 ? match.player1 === null : match.player2 === null
}

function getSidePlayers(match: Match, side: 1 | 2): SidePlayers {
  if (side === 1) {
    return { captain: match.player1!, partner: match.pair1_player2 }
  }
  return { captain: match.player2!, partner: match.pair2_player2 }
}

function sidePatch(side: 1 | 2, players: SidePlayers): Record<string, number | null> {
  if (side === 1) {
    return {
      player1: players.captain,
      pair1_player2: players.partner,
    }
  }
  return {
    player2: players.captain,
    pair2_player2: players.partner,
  }
}

function clearSidePatch(side: 1 | 2): Record<string, null> {
  if (side === 1) {
    return { player1: null, pair1_player2: null }
  }
  return { player2: null, pair2_player2: null }
}

function createMatchPayload(
  context: MoveContext,
  to: EmptyBracketSlot,
  moving: SidePlayers,
): MatchFormData {
  return {
    tournament: context.tournamentId,
    gender_type: context.genderType,
    round_number: to.round,
    slot_index: to.slotIndex,
    status: 'scheduled',
    winner: null,
    scheduled_at: null,
    score: '',
    player1: to.side === 1 ? moving.captain : null,
    pair1_player2: to.side === 1 ? moving.partner : null,
    player2: to.side === 2 ? moving.captain : null,
    pair2_player2: to.side === 2 ? moving.partner : null,
  } as MatchFormData
}

function isMatchFullyEmpty(match: Match): boolean {
  return match.player1 === null && match.player2 === null
}

function replaceMatch(matches: Match[], updated: Match): Match[] {
  return matches.map(m => (m.id === updated.id ? updated : m))
}

function removeMatch(matches: Match[], matchId: number): Match[] {
  return matches.filter(m => m.id !== matchId)
}

async function clearSourceSide(
  matches: Match[],
  from: BracketSlot,
): Promise<Match[]> {
  const matchFrom = matches.find(m => m.id === from.matchId)!
  const updatedFrom = await matchesApi.update(matchFrom.id, {
    ...clearSidePatch(from.side),
    winner: null,
  } as Partial<MatchFormData>)
  if (isMatchFullyEmpty(updatedFrom)) {
    await matchesApi.delete(updatedFrom.id)
    return removeMatch(matches, updatedFrom.id)
  }
  return replaceMatch(matches, updatedFrom)
}

export async function moveBracketSide(
  matches: Match[],
  from: BracketSlot,
  to: BracketTarget,
  context: MoveContext,
): Promise<Match[]> {
  const matchFrom = matches.find(m => m.id === from.matchId)
  if (!matchFrom) {
    throw new Error('Матч не найден.')
  }
  if (!isMatchEditable(matchFrom)) {
    throw new Error('Нельзя менять завершённые матчи.')
  }
  if (isSideEmpty(matchFrom, from.side)) {
    throw new Error('Слот пуст.')
  }

  const moving = getSidePlayers(matchFrom, from.side)

  if ('type' in to && to.type === 'empty') {
    const created = await matchesApi.create(createMatchPayload(context, to, moving))
    const next = await clearSourceSide(matches, from)
    return [...next, created]
  }

  const slotTo = to as BracketSlot

  if (from.matchId === slotTo.matchId && from.side === slotTo.side) {
    return matches
  }

  const matchTo = matches.find(m => m.id === slotTo.matchId)
  if (!matchTo) {
    throw new Error('Матч не найден.')
  }
  if (!isMatchEditable(matchTo)) {
    throw new Error('Нельзя менять завершённые матчи.')
  }

  if (isSideEmpty(matchTo, slotTo.side)) {
    if (from.matchId === slotTo.matchId) {
      const updated = await matchesApi.update(matchFrom.id, {
        ...clearSidePatch(from.side),
        ...sidePatch(slotTo.side, moving),
        winner: null,
      } as Partial<MatchFormData>)
      return replaceMatch(matches, updated)
    }

    const updatedTo = await matchesApi.update(matchTo.id, {
      ...sidePatch(slotTo.side, moving),
      winner: null,
    } as Partial<MatchFormData>)
    let next = replaceMatch(matches, updatedTo)
    next = await clearSourceSide(next, from)
    return next
  }

  return swapBracketSides(matches, from, slotTo)
}

export async function swapBracketSides(
  matches: Match[],
  from: BracketSlot,
  to: BracketSlot,
): Promise<Match[]> {
  if (from.matchId === to.matchId && from.side === to.side) {
    return matches
  }

  const matchA = matches.find(m => m.id === from.matchId)
  const matchB = matches.find(m => m.id === to.matchId)
  if (!matchA || !matchB) {
    throw new Error('Матч не найден.')
  }
  if (!isMatchEditable(matchA) || !isMatchEditable(matchB)) {
    throw new Error('Нельзя менять завершённые матчи.')
  }

  const sideA = getSidePlayers(matchA, from.side)
  const sideB = getSidePlayers(matchB, to.side)

  if (from.matchId === to.matchId) {
    const updated = await matchesApi.update(matchA.id, {
      ...sidePatch(1, from.side === 1 ? sideB : sideA),
      ...sidePatch(2, from.side === 2 ? sideB : sideA),
      winner: null,
    } as Partial<MatchFormData>)
    return replaceMatch(matches, updated)
  }

  const [updatedA, updatedB] = await Promise.all([
    matchesApi.update(matchA.id, { ...sidePatch(from.side, sideB), winner: null } as Partial<MatchFormData>),
    matchesApi.update(matchB.id, { ...sidePatch(to.side, sideA), winner: null } as Partial<MatchFormData>),
  ])

  return matches.map(m => {
    if (m.id === updatedA.id) return updatedA
    if (m.id === updatedB.id) return updatedB
    return m
  })
}

export function reorderSeedsByIndex(
  ordered: { id: number }[],
  fromIndex: number,
  toIndex: number,
): Record<number, string> {
  if (fromIndex === toIndex) return {}
  const next = [...ordered]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  const seeds: Record<number, string> = {}
  next.forEach((item, index) => {
    seeds[item.id] = String(index + 1)
  })
  return seeds
}

export function reorderPairSeeds(
  pairs: { pairId: number; p1: { id: number }; p2: { id: number } }[],
  fromIndex: number,
  toIndex: number,
): { pairSeeds: Record<number, string>; pairIds: Record<number, string> } {
  if (fromIndex === toIndex) {
    return { pairSeeds: {}, pairIds: {} }
  }
  const next = [...pairs]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)

  const pairSeeds: Record<number, string> = {}
  const pairIds: Record<number, string> = {}
  next.forEach((pair, index) => {
    const seed = String(index + 1)
    pairSeeds[pair.p1.id] = seed
    pairSeeds[pair.p2.id] = seed
    pairIds[pair.p1.id] = String(pair.pairId)
    pairIds[pair.p2.id] = String(pair.pairId)
  })
  return { pairSeeds, pairIds }
}

export function matchAtSlot(matches: Match[], round: number, slotIndex: number): Match | undefined {
  const roundMatches = matches.filter(m => m.round_number === round)
  return roundMatches.find(m => m.slot_index === slotIndex) ?? roundMatches[slotIndex]
}
