import { dateSpanBn, dayRangeBn } from '../data/bn'
import type { Chapter } from '../data/types'
import { slotLabel } from '../data/plan'
import type { Schedule } from '../logic/schedule'
import { chapterProgress } from '../logic/stats'
import type { Reader } from '../logic/reader'

/** Everything the search card / chapter header need about how a chapter sits in the plan. */
export function chapterProgressFor(c: Chapter, sched: Schedule, r: Reader) {
  const slots = sched.slots.get(c.id) ?? []
  const dates = [...new Set(slots.map((s) => s.date))]
  const nos = [...new Set(slots.map((s) => s.dayNo))]
  const prog = chapterProgress(r, sched.rows, slots)
  return {
    slots,
    dates,
    text: dates.length ? `${dateSpanBn(dates)} (${dayRangeBn(nos)}) · ${slotLabel(slots.map((s) => ({ date: s.date, dayNo: s.dayNo, item: s.item, kind: s.kind })))}` : 'পরিকল্পনায় নেই',
    ...prog,
  }
}
