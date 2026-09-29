import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { bn, fmt2, SUBJ_BN } from '../data/bn'
import { search, type SearchResult } from '../search'
import { closeSearch, searchInitial } from '../ui-state'
import { goFromSheet, href } from '../router'
import { useReader, useSchedule } from '../hooks'
import { FullTag, Sheet, TierPill } from '../components/ui'
import { chapterProgressFor } from './chapterInfo'

function hl(text: string, q: string) {
  const t = q.trim()
  if (t.length < 2) return text
  const i = text.toLowerCase().indexOf(t.toLowerCase())
  if (i < 0) return text
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + t.length)}</mark>{text.slice(i + t.length)}</>
}
const TYPE_LABEL = { topic: 'Topic', sub: 'Subtopic', question: 'Question', chapter: 'Chapter' } as const

/** Follow a result link in place of the sheet's history entry, so Back returns to the page you searched from. */
function follow(e: React.MouseEvent<HTMLAnchorElement>) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  goFromSheet(e.currentTarget.getAttribute('href')!)
  closeSearch()
}

function Card({ res, q }: { res: SearchResult; q: string }) {
  const r = useReader()
  const sched = useSchedule()
  const c = res.chapter
  const info = chapterProgressFor(c, sched, r)
  const subs = c.topics.flatMap((t) => t.subs).slice(0, 3)
  return (
    <div className="stack" style={{ gap: 6 }}>
      <a className="result" href={href.chapter(c.id)} onClick={follow}>
        <div className="top">
          <span className={`chip ${c.subject}`}>{SUBJ_BN[c.subject]}</span>
          <span className="small">{c.p}</span>
          <TierPill tier={c.tier} />
          <span className="small">র‍্যাংক {bn(c.rank)}</span>
          {c.full && <FullTag />}
        </div>
        <div className="nm">{hl(c.n, q)}</div>
        <div className="stats">
          <span>প্রতি প্রশ্নপত্রে গড় {fmt2(c.rate)}টি</span>
          <span>{c.en.trim()}</span>
        </div>
        <div className="sched bn" style={{ fontFamily: 'var(--body)' }}>{info.text}</div>
        <div className="row-flex">
          <span className={`status ${info.state === 'done' ? 'done' : info.state === 'in progress' ? 'partial' : ''}`}>{info.state === 'done' ? 'Done' : info.state === 'in progress' ? 'In progress' : 'Not started'}</span>
        </div>
        {subs.length > 0 && <ol>{subs.map((s) => <li key={s.id}>{s.n}</li>)}</ol>}
      </a>
      {res.hits.slice(0, 3).map((h) => (
        <a key={h.id} className="hitrow" href={href.chapter(c.id, h.id)} onClick={follow}>
          <span className="ty">{TYPE_LABEL[h.type]}</span>
          <span>{hl(h.text, q)}</span>
        </a>
      ))}
    </div>
  )
}

export function SearchSheet() {
  const [q, setQ] = useState(searchInitial())
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  const results = useMemo(() => {
    const all = search(q, 10)
    if (!all.length) return all
    const top = all[0].score
    return all.filter((r) => r.score >= Math.max(0.45, top * 0.6))
  }, [q])
  const empty = q.trim().length >= 2 && !results.length
  return (
    <Sheet
      bare
      label="Search"
      onClose={closeSearch}
      title={
        <input
          ref={input}
          className="search-in"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results[0]) {
              // otherwise the key's default action lands on the search button focus returns to, and reopens search
              e.preventDefault()
              goFromSheet(href.chapter(results[0].chapter.id, results[0].direct ? undefined : results[0].hits[0]?.id))
              closeSearch()
            }
          }}
          placeholder="Search: গতিবিদ্যা · dynamics · gotibidda · lami · cannizzaro"
          aria-label="Search chapters, topics, subtopics and questions"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
        />
      }
    >
      {q.trim().length < 2 && <p className="small">Type Bangla (গতিবিদ্যা), English (dynamics), Banglish (gotibidda) or part of a word. Searches chapters, topics, subtopics and past questions.</p>}
      {results.map((r) => <Fragment key={r.chapter.id}><Card res={r} q={q} /></Fragment>)}
      {empty && <div className="empty">No match for "{q}". Try fewer letters, or another spelling.</div>}
    </Sheet>
  )
}
