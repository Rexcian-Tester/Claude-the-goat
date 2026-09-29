// The single link between study-plan.json and priority-map.json.
// A plan item's `ch` (Bangla) equals a priority-map chapter `n` for the same subject,
// apart from the documented exceptions below.
import { chapterByName } from './catalog'
import { studyPlan } from './load'
import type { Chapter, PlanSubject, RawPlanItem, Subject } from './types'

export const SUBJECT_OF: Record<Exclude<PlanSubject, 'X'>, Subject> = { P: 'Phy', C: 'Chem', M: 'Math' }

/** plan (subject, ch) -> priority-map chapters it covers, when it isn't a 1:1 name match */
export const PLAN_EXCEPTIONS: Record<string, { subject: Subject; n: string }[]> = {
  'P|ভেক্টর': [
    { subject: 'Phy', n: 'ভেক্টর' },
    { subject: 'Math', n: 'ভেক্টর' },
  ],
  'M|সরলরেখা ও কণিক': [
    { subject: 'Math', n: 'সরলরেখা' },
    { subject: 'Math', n: 'কণিক' },
  ],
  'M|বিস্তার পরিমাপ ও সম্ভাবনা': [
    { subject: 'Math', n: 'বিস্তার পরিমাপ' },
    { subject: 'Math', n: 'সম্ভাবনা' },
  ],
}

/** Priority-map chapters deliberately absent from the plan (meta.intentionallyExcluded). */
export const INTENTIONALLY_UNSCHEDULED: { subject: Subject; n: string }[] = [{ subject: 'Chem', n: 'ল্যাবরেটরির নিরাপদ ব্যবহার' }]

/** Priority-map chapters a plan item covers. Catch-up items (X) cover none. */
export function chaptersForItem(item: Pick<RawPlanItem, 's' | 'ch'>): Chapter[] {
  if (item.s === 'X') return []
  const ex = PLAN_EXCEPTIONS[`${item.s}|${item.ch}`]
  if (ex) return ex.map((e) => chapterByName(e.subject, e.n)).filter((c): c is Chapter => !!c)
  const c = chapterByName(SUBJECT_OF[item.s], item.ch)
  return c ? [c] : []
}

/** Plan items (excluding catch-up) that match no chapter, or an exception that resolves to too few chapters. */
export function unmatchedPlanItems(): { date: string; ch: string; s: PlanSubject }[] {
  const out: { date: string; ch: string; s: PlanSubject }[] = []
  for (const d of studyPlan.days)
    for (const it of d.items) {
      if (it.s === 'X') continue
      const ex = PLAN_EXCEPTIONS[`${it.s}|${it.ch}`]
      const found = chaptersForItem(it)
      if (found.length === 0 || (ex && found.length !== ex.length)) out.push({ date: d.date, ch: it.ch, s: it.s })
    }
  return out
}
