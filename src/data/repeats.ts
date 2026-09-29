import { extras } from './load'
import { allQuestions } from './catalog'
import { unbn } from './bn'
import type { Question, Repeat, Subject } from './types'

export interface LinkedRepeat extends Repeat {
  idx: number
  id: string // progress id for this repeat entry itself
  questionIds: string[] // best-effort links into the priority map
  chapterIds: string[]
}

const SUBJ_WORD: [string, Subject][] = [
  ['পদার্থ', 'Phy'],
  ['রসায়ন', 'Chem'],
  ['গণিত', 'Math'],
]
const subjectsOf = (s: string): Subject[] => SUBJ_WORD.filter(([w]) => s.includes(w)).map(([, k]) => k)

/** "২০২২-২৩ প্রশ্ন ৮(খ)" | "২০২১-২২ পদার্থ ৭(খ)" | "মডেল টেস্ট-০২ প্রশ্ন ১" | "২০২০-২১" */
function parseSegment(seg: string): { y: string; q?: string; subs?: Subject[] } | null {
  const s = unbn(seg.trim())
  let m = s.match(/মডেল টেস্ট-(\d+)(?:\s+(?:প্রশ্ন\s+)?(\S+))?/)
  let y: string | undefined
  let rest = ''
  if (m) {
    y = 'MT' + Number(m[1])
    rest = m[2] ?? ''
  } else {
    m = s.match(/^(\d{4}-\d{2})\s*(.*)$/)
    if (!m) return null
    y = m[1]
    rest = m[2]
  }
  const subs = subjectsOf(rest)
  const qm = rest.match(/(\d+)(?:\(([কখগঘঙ])\))?/)
  const L: Record<string, string> = { ক: 'a', খ: 'b', গ: 'c', ঘ: 'd', ঙ: 'e' }
  const q = qm ? qm[1] + (qm[2] ? L[qm[2]] : '') : undefined
  return { y, q, subs: subs.length ? subs : undefined }
}

export const repeats: LinkedRepeat[] = extras.repeats.map((r, idx) => {
  const rowSubs = subjectsOf(r.subject)
  const found = new Map<string, Question>()
  for (const seg of r.where.split('·')) {
    const p = parseSegment(seg)
    if (!p || !p.q) continue
    const subs = p.subs ?? rowSubs
    for (const q of allQuestions) {
      if (q.y !== p.y) continue
      if (q.q !== p.q && q.q.replace(/[a-z]$/, '') !== p.q) continue
      const subj = q.chapterId.split('-')[0] as Subject
      if (subs.length && !subs.includes(subj)) continue
      found.set(q.id, q)
    }
  }
  const qs = [...found.values()]
  return { ...r, idx, id: `rep-${idx}`, questionIds: qs.map((q) => q.id), chapterIds: [...new Set(qs.map((q) => q.chapterId))] }
})
