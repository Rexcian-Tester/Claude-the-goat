// Watch study time as the rest of the site sees it: reads the imported watch sessions and the study stretches
// devices logged from the progress store, and works out each block's share (cached until the store changes).
import { studyBlocks, type StudyBlockId } from '../logic/pomo'
import { store } from '../store/store'
import { addSpan, SPAN_KEY_RE, spanKey, WATCH_KEY_RE, type Span, type WatchRecord } from './session'
import { watchSplit } from './watchTime'

interface DayIndex {
  records: WatchRecord[]
  spans: Span[]
}
let indexVersion = -1
let index = new Map<string, DayIndex>()
const splits = new Map<string, Map<StudyBlockId, number>>()

const isSpan = (x: unknown): x is Span => Array.isArray(x) && x.length === 2 && typeof x[0] === 'number' && typeof x[1] === 'number' && x[0] < x[1]

function dayIndex(date: string): DayIndex | undefined {
  if (indexVersion !== store.version) {
    indexVersion = store.version
    index = new Map()
    splits.clear()
    for (const k of store.fields.keys()) {
      const w = WATCH_KEY_RE.exec(k)
      const s = w ? null : SPAN_KEY_RE.exec(k)
      if (!w && !s) continue
      const d = (w ?? s)![1]
      const v = store.get<unknown>(k)
      const day = index.get(d) ?? { records: [], spans: [] }
      if (w) {
        const parts = (v as WatchRecord | undefined)?.parts
        if (Array.isArray(parts) && parts.every(isSpan)) day.records.push({ parts, src: 'watch' })
      } else if (Array.isArray(v)) day.spans.push(...v.filter(isSpan))
      index.set(d, day)
    }
  }
  return index.get(date)
}

/** Watch study time counted to a block on a day (0 when there is none). `base` is the block's time logged on
 *  the site itself; `target` its target (both as the Study Blocks timer computes them). */
export function watchMs(date: string, id: StudyBlockId, base: (id: StudyBlockId) => number, target: (id: StudyBlockId) => number): number {
  const day = dayIndex(date)
  if (!day || !day.records.length) return 0
  const sig = `${date}|${studyBlocks(date).map((b) => `${b.id}:${base(b.id)}:${target(b.id)}`).join(',')}`
  let split = splits.get(sig)
  if (!split) {
    split = watchSplit(date, day.records, day.spans, base, target)
    splits.set(sig, split)
  }
  return split.get(id) ?? 0
}

/** The field update that records a stretch of study logged on this device (sent with the study time itself). */
export function spanEntry(date: string, from: number, to: number): [string, unknown] {
  const k = spanKey(date, store.deviceId || 'device')
  return [k, addSpan(store.get<Span[]>(k), Math.round(from), Math.round(to))]
}
