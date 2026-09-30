import { chaptersForItem } from './mapping'
import { studyPlan } from './load'
import { allChapters } from './catalog'
import type { Chapter, Kind, RawPlanItem } from './types'
import { addDays } from './dhaka'

export interface PlanItem extends RawPlanItem {
  key: string // `${date}:${itemIdx}` (original date; stable identity)
  date: string
  itemIdx: number
  chapters: Chapter[]
}
export interface PlanDay {
  date: string
  dayNo: number // Day 0 = 30 Sep
  wd: string
  phase: string
  items: PlanItem[]
  isBuffer: boolean
  /** nothing scheduled (work moved elsewhere): never owed, never a catch-up target */
  isFree: boolean
  taskCount: number
}

export const PLAN_START = studyPlan.meta.day0
export const PLAN_LAST = studyPlan.days[studyPlan.days.length - 1].date
export const REVISION_DATES = studyPlan.meta.revision
export const REST_DATE = studyPlan.meta.rest
export const EXAM_DATE = studyPlan.meta.exam
export const ENDGAME_START = REVISION_DATES[0]

export const planDays: PlanDay[] = studyPlan.days.map((d, i) => {
  const items: PlanItem[] = d.items.map((it, ii) => ({
    ...it,
    key: `${d.date}:${ii}`,
    date: d.date,
    itemIdx: ii,
    chapters: chaptersForItem(it),
  }))
  return {
    date: d.date,
    dayNo: i,
    wd: d.wd,
    phase: d.phase,
    items,
    isBuffer: items.every((x) => x.k === 'buf'), // an empty (free) day counts like a buffer: nothing is owed
    isFree: items.length === 0,
    taskCount: items.reduce((n, x) => n + x.topicList.length, 0),
  }
})
export const dayByDate = new Map(planDays.map((d) => [d.date, d]))
export const itemByKey = new Map(planDays.flatMap((d) => d.items.map((i) => [i.key, i] as const)))
export const bufferDays = planDays.filter((d) => d.isBuffer)

/** Every scheduled appearance of a chapter (original, unshifted schedule). */
export interface Slot {
  date: string
  dayNo: number
  item: PlanItem
  kind: Kind
}
export const chapterSlots = new Map<string, Slot[]>()
for (const c of allChapters) chapterSlots.set(c.id, [])
for (const d of planDays)
  for (const it of d.items)
    for (const c of it.chapters) chapterSlots.get(c.id)!.push({ date: d.date, dayNo: d.dayNo, item: it, kind: it.k })

/** Bangla label for how a chapter is scheduled, e.g. "ক্লাস দিন + অনুশীলন". */
export function slotLabel(slots: Slot[]): string {
  const labels: string[] = []
  let sawCls = false
  for (const s of slots) {
    let l: string
    if (s.kind === 'cls') {
      l = 'ক্লাস দিন'
      sawCls = true
    } else if (s.kind === 'half') l = 'আধা দিন'
    else l = sawCls ? 'অনুশীলন' : 'পূর্ণ দিন'
    if (!labels.includes(l)) labels.push(l)
  }
  return labels.join(' + ')
}

/** Last date a chapter appears in the schedule (chapter-end prompt). */
export function lastSlotDate(chapterId: string): string | null {
  const s = chapterSlots.get(chapterId)
  return s && s.length ? s[s.length - 1].date : null
}

/** Full-length endgame rows (not in study-plan.days[]). */
export type EndgameKind = 'revision' | 'rest' | 'exam'
export const endgameRows: { date: string; kind: EndgameKind }[] = [
  ...REVISION_DATES.map((date) => ({ date, kind: 'revision' as const })),
  { date: REST_DATE, kind: 'rest' as const },
  { date: EXAM_DATE, kind: 'exam' as const },
]
export const endgameKind = (iso: string): EndgameKind | null => endgameRows.find((r) => r.date === iso)?.kind ?? null

export const nextDay = (iso: string) => addDays(iso, 1)
