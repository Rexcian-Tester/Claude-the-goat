import { diffDays } from '../data/dhaka'
import { EXAM_DATE, PLAN_LAST, PLAN_START, ENDGAME_START } from '../data/plan'
import { dayProgress } from './dayStatus'
import type { Reader } from './reader'
import type { Row } from './schedule'

export type Phase = 'before' | 'study' | 'endgame' | 'rest' | 'exam' | 'after'

export function phaseOf(today: string): Phase {
  if (today < PLAN_START) return 'before'
  if (today <= PLAN_LAST) return 'study'
  if (today === EXAM_DATE) return 'exam'
  if (today > EXAM_DATE) return 'after'
  if (today >= ENDGAME_START && today < '2026-12-18') return 'endgame'
  return 'rest'
}
export const isEndgame = (today: string) => today >= ENDGAME_START && today <= EXAM_DATE

export interface BehindInfo {
  /** study rows whose (effective) date is before today */
  elapsed: number
  /** study rows completed, on any date */
  completed: number
  /** >0 behind, <0 ahead, in whole days */
  lag: number
  daysLeft: number
  showBanner: boolean
  phase: Phase
}

/**
 * Behind/ahead = study days that should be finished by now (rows dated before today, catch-up rows excluded)
 * minus study days actually finished. A day is finished when all its tasks are ticked/moved/cleared or it is
 * marked done. Catch-up rows are never counted as owed, so an unused buffer costs nothing.
 */
export function behindInfo(today: string, rows: Row[], r: Reader): BehindInfo {
  const study = rows.filter((x) => !x.isBuffer && x.eff !== null)
  let elapsed = 0
  let completed = 0
  for (const row of study) {
    if (row.eff! < today) elapsed++
    if (dayProgress(r, row, rows).complete) completed++
  }
  const lag = elapsed - completed
  return {
    elapsed,
    completed,
    lag,
    daysLeft: diffDays(today, EXAM_DATE),
    showBanner: today >= PLAN_START && lag > 2,
    phase: phaseOf(today),
  }
}
export function lagLabel(lag: number): string {
  if (lag === 0) return 'On plan'
  return lag > 0 ? `${lag} day${lag === 1 ? '' : 's'} behind` : `${-lag} day${lag === -1 ? '' : 's'} ahead`
}
