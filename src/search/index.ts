import Fuse from 'fuse.js'
import { allChapters, chapterById } from '../data/catalog'
import type { Chapter } from '../data/types'
import { ALIASES } from './aliases'
import { bnKey, latKey, lev, vowelSim } from './romanize'
import { hasBangla, norm, words } from './normalize'

export type DocType = 'chapter' | 'topic' | 'sub' | 'question'
interface SDoc {
  id: string // chapter id, topic id, sub id or question id (also the focus target)
  type: DocType
  chapterId: string
  text: string // normalized Bangla / mixed text
  en: string // normalized English name + aliases (chapters only)
  ws: string[]
  keys: { cons: string; vow: string }[]
}
export interface Hit {
  type: DocType
  id: string
  chapterId: string
  text: string
  score: number
}
export interface SearchResult {
  chapter: Chapter
  score: number
  /** matches below chapter level (topics, subtopics, questions), best first */
  hits: Hit[]
  /** the chapter's own name/alias matched (vs only something inside it) */
  direct: boolean
}

const TYPE_MULT: Record<DocType, number> = { chapter: 1, topic: 0.92, sub: 0.88, question: 0.72 }

const rawText = new Map<string, string>() // id -> original text for display
let docs: SDoc[] | null = null
let fuse: Fuse<SDoc> | null = null

function mkDoc(id: string, type: DocType, chapterId: string, text: string, en: string[] = []): SDoc {
  const t = norm(text)
  const ws = words(t)
  rawText.set(id, text)
  return { id, type, chapterId, text: t, en: en.map(norm).filter(Boolean).join(' | '), ws, keys: ws.map(bnKey) }
}

function build(): SDoc[] {
  const aliasByChapter = new Map<string, string[]>()
  for (const [subject, en, list] of ALIASES) {
    const c = allChapters.find((x) => x.subject === subject && x.en.trim() === en)
    if (!c) throw new Error(`alias target not found: ${subject} ${en}`)
    aliasByChapter.set(c.id, [...(aliasByChapter.get(c.id) ?? []), ...list])
  }
  const out: SDoc[] = []
  for (const c of allChapters) {
    out.push(mkDoc(c.id, 'chapter', c.id, c.n, [c.en.trim(), ...(aliasByChapter.get(c.id) ?? [])]))
    for (const t of c.topics) {
      out.push(mkDoc(t.id, 'topic', c.id, t.n))
      for (const s of t.subs) {
        out.push(mkDoc(s.id, 'sub', c.id, s.n))
        for (const q of s.qs) out.push(mkDoc(q.id, 'question', c.id, q.t))
      }
    }
  }
  return out
}
export function ensureIndex() {
  if (!docs) {
    docs = build()
    fuse = new Fuse(
      docs.filter((d) => d.type !== 'question'),
      { keys: ['text', 'en'], threshold: 0.32, ignoreLocation: true, minMatchCharLength: 3, includeScore: true },
    )
  }
  return docs
}
export const displayText = (id: string) => rawText.get(id) ?? ''

/** direct substring score of one token in a text (0 if absent) */
function direct(token: string, text: string, ws: string[]): number {
  if (!text.includes(token)) return 0
  if (ws.some((w) => w.startsWith(token))) return ws.includes(token) ? 1 : 0.92
  return 0.72
}

function scoreDoc(d: SDoc, qNorm: string, tokens: string[], qKeys: ReturnType<typeof latKey>[], latin: boolean[]): number {
  // 1) whole phrase in Bangla/mixed text or English names
  let best = 0
  if (qNorm.length >= 2) {
    if (d.text === qNorm) best = 1.05
    else if (d.text.includes(qNorm)) best = Math.max(best, d.ws.some((w) => qNorm.startsWith(w) || w.startsWith(qNorm)) || d.text.startsWith(qNorm) ? 0.95 : 0.78)
    if (d.en) {
      const parts = d.en.split(' | ')
      for (const p of parts) {
        if (p === qNorm) best = Math.max(best, 1.05)
        else if (p.startsWith(qNorm)) best = Math.max(best, 0.97)
        else if (p.includes(qNorm)) best = Math.max(best, qNorm.length >= 4 ? 0.82 : 0)
      }
    }
  }
  // 2) every token present (any order) in text or english names
  if (tokens.length > 1) {
    let sum = 0
    let ok = true
    for (const tk of tokens) {
      const s = Math.max(direct(tk, d.text, d.ws), d.en ? direct(tk, d.en, words(d.en.replace(/ \| /g, ' '))) : 0)
      if (!s) {
        ok = false
        break
      }
      sum += s
    }
    if (ok) best = Math.max(best, (sum / tokens.length) * 0.9)
  }
  // 3) phonetic (Banglish) match, per Latin token, prefix of a word skeleton
  if (!hasBangla(qNorm) || latin.some(Boolean)) {
    let sum = 0
    let ok = true
    const used = new Set<number>()
    for (let i = 0; i < tokens.length; i++) {
      if (!latin[i]) {
        // Bangla token inside a mixed query: plain substring
        const s = direct(tokens[i], d.text, d.ws)
        if (!s) ok = false
        sum += s
        continue
      }
      const qk = qKeys[i]
      if (qk.cons.length < 2) {
        ok = false
        break
      }
      let tokBest = 0
      let bestIdx = -1
      d.keys.forEach((wk, wi) => {
        if (used.has(wi) || !wk.cons) return
        let s = 0
        if (wk.cons === qk.cons) s = 0.78
        else if (wk.cons.startsWith(qk.cons)) s = 0.6 + Math.min(0.12, (qk.cons.length / wk.cons.length) * 0.12)
        else if (qk.cons.length >= 5 && lev(wk.cons.slice(0, qk.cons.length), qk.cons) <= 1) s = 0.5
        if (s) {
          s += 0.1 * vowelSim(qk.vow, wk.vow)
          if (s > tokBest) {
            tokBest = s
            bestIdx = wi
          }
        }
      })
      if (!tokBest) {
        ok = false
        break
      }
      used.add(bestIdx)
      sum += tokBest
    }
    if (ok && tokens.length) best = Math.max(best, sum / tokens.length)
  }
  return best * TYPE_MULT[d.type]
}

export function search(query: string, limit = 8): SearchResult[] {
  const qNorm = norm(query)
  if (qNorm.length < 2) return []
  const all = ensureIndex()
  const tokens = words(qNorm)
  const latin = tokens.map((t) => !hasBangla(t))
  const qKeys = tokens.map((t, i) => (latin[i] ? latKey(t) : bnKey(t)))

  const scored = new Map<string, number>()
  for (const d of all) {
    const s = scoreDoc(d, qNorm, tokens, qKeys, latin)
    if (s > 0.3) scored.set(d.id, s)
  }
  // typo tolerance: only when nothing solid was found
  const top = Math.max(0, ...scored.values())
  if (top < 0.6 && fuse) {
    for (const r of fuse.search(qNorm, { limit: 30 })) {
      const s = (1 - (r.score ?? 1)) * 0.7 * TYPE_MULT[r.item.type]
      if (s > (scored.get(r.item.id) ?? 0)) scored.set(r.item.id, s)
    }
  }

  const byChapter = new Map<string, { score: number; direct: boolean; hits: Hit[] }>()
  for (const d of all) {
    const s = scored.get(d.id)
    if (!s) continue
    const e = byChapter.get(d.chapterId) ?? { score: 0, direct: false, hits: [] }
    if (d.type === 'chapter') {
      e.direct = true
      e.score = Math.max(e.score, s)
    } else {
      e.score = Math.max(e.score, s * 0.96)
      e.hits.push({ type: d.type, id: d.id, chapterId: d.chapterId, text: rawText.get(d.id) ?? '', score: s })
    }
    byChapter.set(d.chapterId, e)
  }
  return [...byChapter.entries()]
    .map(([id, e]) => ({ chapter: chapterById.get(id)!, score: e.score, direct: e.direct, hits: e.hits.sort((a, b) => b.score - a.score) }))
    .sort((a, b) => b.score - a.score || a.chapter.rank - b.chapter.rank)
    .slice(0, limit)
}
