// Study artifacts per syllabus chapter (site-source/data/artifacts.json). The Plan's "Open artifact" button and the
// Map's Subject list both read this one file; a plan chapter finds its row by Bangla name.
import { artifactsData } from './load'
import type { ArtifactChapter, PlanSubject, Subject } from './types'

export const artifactChapters: ArtifactChapter[] = artifactsData.chapters

/** Names compared loosely: spacing, commas/dashes, a trailing day number ("যোগজীকরণ-1") and ও / এবং don't matter. */
export function normName(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[-–‐]\s*[0-9০-৯]+\s*$/u, '')
    .replace(/এবং/gu, 'ও')
    .replace(/[\s,.\-–‐·:()‌‍]/gu, '')
}

/** Character-pair overlap (0..1): small spelling differences (চৌম্বক / চৌম্বকীয়) still match. */
function similarity(a: string, b: string): number {
  const pairs = (s: string) => {
    const out: string[] = []
    const ch = [...s]
    for (let i = 0; i < ch.length - 1; i++) out.push(ch[i] + ch[i + 1])
    return out
  }
  const pa = pairs(a)
  const pb = pairs(b)
  if (!pa.length || !pb.length) return a === b ? 1 : 0
  const left = [...pb]
  let hit = 0
  for (const p of pa) {
    const i = left.indexOf(p)
    if (i >= 0) {
      hit++
      left.splice(i, 1)
    }
  }
  return (2 * hit) / (pa.length + pb.length)
}

/** The data row for one chapter name in a subject: exact (loosely compared) first, else the closest clear match. */
export function findArtifact(subject: Subject, name: string): ArtifactChapter | undefined {
  const rows = artifactChapters.filter((c) => c.subject === subject)
  const n = normName(name)
  const exact = rows.find((c) => normName(c.name) === n)
  if (exact) return exact
  let best: ArtifactChapter | undefined
  let score = 0
  for (const c of rows) {
    const s = similarity(normName(c.name), n)
    if (s > score) (best = c), (score = s)
  }
  return score >= 0.8 ? best : undefined
}

const SUBJECT: Record<string, Subject> = { P: 'Phy', C: 'Chem', M: 'Math' }
/** plan chapters that cover two syllabus chapters */
const SPLITS: Record<string, string[]> = {
  'M|ত্রিকোণমিতিক অনুপাত ও সংযুক্ত কোণ': ['ত্রিকোণমিতিক অনুপাত', 'সংযুক্ত কোণের ত্রিকোণমিতিক অনুপাত'],
  'M|সরলরেখা ও কণিক': ['সরলরেখা', 'কণিক'],
}

/** The artifact rows for a plan topic (empty for catch-up / revision days or a name with no row). The first is the
 *  main one; a topic covering two chapters gets both. A day part naming one of them ("সংযুক্ত কোণের …") picks it. */
export function artifactsForPlan(item: { s: PlanSubject; ch: string; part?: string }): ArtifactChapter[] {
  const subject = SUBJECT[item.s]
  if (!subject) return []
  const names = SPLITS[`${item.s}|${item.ch}`]
  if (names) {
    const part = normName(item.part ?? '')
    const named = [...names].sort((a, b) => b.length - a.length).find((n) => part.includes(normName(n)))
    const order = named ? [named, ...names.filter((n) => n !== named)] : names
    return order.map((n) => findArtifact(subject, n)).filter((c): c is ArtifactChapter => !!c)
  }
  const one = findArtifact(subject, item.ch)
  return one ? [one] : []
}

/** "19/21": chapters with an artifact ready, of all in the subject */
export function readyCount(subject: ArtifactChapter['subject']) {
  const rows = artifactChapters.filter((c) => c.subject === subject)
  return { ready: rows.filter((c) => c.status === 'ready').length, total: rows.length }
}
