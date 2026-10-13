// "Today" for the watch's progress screen: the day's study blocks with their targets and studied time, and the
// day's total against the goal — the numbers the Study Blocks card shows. The website writes it (src/watch/summary.ts)
// as one field, `day:<date>:watchsum`; the watch reads it through GET /api/watch/today, which returns this field
// for today only and only after passing it through cleanToday(), so the watch token can never see anything else.

export interface TodayBlock {
  id: string
  label: string
  /** minutes after midnight, Asia/Dhaka */
  from: number
  to: number
  /** ms */
  target: number
  studied: number
}
export interface TodaySummary {
  date: string
  blocks: TodayBlock[]
  /** ms studied today (all blocks) and the daily goal */
  total: number
  goal: number
  /** ids of watch sessions already counted in these numbers (the watch adds its newer ones itself) */
  watchIds: string[]
}

export const summaryKey = (date: string) => `day:${date}:watchsum`

const ID_RE = /^[A-Za-z0-9_-]{6,64}$/
const num = (x: unknown, lo: number, hi: number) => (typeof x === 'number' && Number.isFinite(x) && x >= lo && x <= hi ? Math.round(x) : null)
const str = (x: unknown, max: number) => (typeof x === 'string' && x.length > 0 && x.length <= max ? x : null)

/** Keep only the allowed fields, with sane values; anything else in the stored value is dropped. */
export function cleanToday(x: unknown, date: string): TodaySummary | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  if (o.date !== date || !Array.isArray(o.blocks) || o.blocks.length > 8) return null
  const DAY = 86400000
  const blocks: TodayBlock[] = []
  for (const b of o.blocks as Record<string, unknown>[]) {
    if (!b || typeof b !== 'object') return null
    const id = str(b.id, 20)
    const label = str(b.label, 40)
    const from = num(b.from, 0, 1440)
    const to = num(b.to, 0, 1440)
    const target = num(b.target, 0, DAY)
    const studied = num(b.studied, 0, DAY)
    if (id === null || label === null || from === null || to === null || target === null || studied === null) return null
    blocks.push({ id, label, from, to, target, studied })
  }
  const total = num(o.total, 0, DAY)
  const goal = num(o.goal, 0, DAY)
  if (total === null || goal === null) return null
  const watchIds = Array.isArray(o.watchIds) ? (o.watchIds as unknown[]).filter((i): i is string => typeof i === 'string' && ID_RE.test(i)).slice(0, 300) : []
  return { date, blocks, total, goal, watchIds }
}

/** Same numbers? (decides whether the website needs to save a new summary) */
export const sameToday = (a: unknown, b: TodaySummary) => JSON.stringify(a) === JSON.stringify(b)
