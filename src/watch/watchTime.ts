// How much watch study time each study block gets on a day. Pure, so it is easy to test.
// Watch time follows the same rules as time logged on the site (P.splitStudy): it counts to the block it falls in,
// and once a block is full it fills the earliest block still short. Minutes that overlap time a phone/tablet already
// logged with the Study Blocks timer (its recorded stretches) are counted once, by that device, not again here.
import { splitStudy, type StudyBlockId } from '../logic/pomo'
import { subtract, union, type Span, type WatchRecord } from './session'

export function watchSplit(
  date: string,
  records: WatchRecord[],
  deviceSpans: Span[],
  base: (id: StudyBlockId) => number,
  target: (id: StudyBlockId) => number,
): Map<StudyBlockId, number> {
  const added = new Map<StudyBlockId, number>()
  let covered = union(deviceSpans)
  const parts = records.flatMap((r) => r.parts).sort((a, b) => a[0] - b[0])
  for (const part of parts) {
    for (const [from, to] of subtract(part, covered)) {
      const pieces = splitStudy(from, to, date, (id) => base(id) + (added.get(id) ?? 0), target)
      for (const [id, ms] of pieces) added.set(id, (added.get(id) ?? 0) + ms)
    }
    // two watch sessions never count the same minute twice either
    covered = union([...covered, part])
  }
  return added
}
