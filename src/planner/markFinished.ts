import { planDays } from '../data/plan'
import { markKeyFor } from '../logic/dayStatus'
import { K } from '../logic/keys'
import { partsOf, type PlanEdits } from '../logic/planEdits'
import { store } from '../store/store'
import { getPasscode, onSyncChange, syncStatus } from '../store/syncClient'

/* One-time, when the plan was reorganised (27 Oct): chapters you said you had already finished in the old plan
 * get your own "Done" on every old-plan day they sit on (every part, if you split one). A topic already marked
 * Done is left alone. A synced marker makes it run once across all your devices. */
export const FINISHED_MARKER = 'plan:finished:2026-10-27'
export const FINISHED: [string, string][] = [
  ['P', 'ভেক্টর'],
  ['M', 'ম্যাট্রিক্স ও নির্ণায়ক'],
  ['C', 'পরিবেশ রসায়ন'],
  ['P', 'গতিবিদ্যা'],
  ['P', 'নিউটনিয়ান বলবিদ্যা'],
  ['P', 'কাজ, শক্তি ও ক্ষমতা'],
  ['M', 'অন্তরীকরণ'],
]

/** The marks to write (empty when already done). Pure, for tests. */
export function finishedMarks(get: (key: string) => unknown, now: number): [string, unknown][] {
  if (get(FINISHED_MARKER)) return []
  const edits = get(K.edits) as PlanEdits | undefined
  const out: [string, unknown][] = []
  for (const d of planDays) {
    if (!d.archived) continue
    for (const it of d.items) {
      if (!FINISHED.some(([s, ch]) => it.s === s && it.ch === ch)) continue
      for (const p of partsOf(edits, it.key, it.topicList.length)) {
        const k = markKeyFor(it.key, p.id)
        if (get(k) !== 'done') out.push([k, 'done'])
      }
    }
  }
  out.push([FINISHED_MARKER, now])
  return out
}

function run() {
  if (!store.ready) return
  const marks = finishedMarks((k) => store.get(k), Date.now())
  if (marks.length) store.setMany(marks)
}

/** Runs once this device holds your latest progress: right away without a passcode, else after its first sync. */
export function startMarkFinished() {
  if (!getPasscode()) return run()
  const off = onSyncChange(() => {
    const s = syncStatus()
    if (s === 'synced' || s === 'conflict') {
      off()
      run()
    }
  })
}
