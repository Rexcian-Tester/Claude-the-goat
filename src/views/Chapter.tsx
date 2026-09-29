import { useEffect, useState } from 'react'
import { bn, dateBn, dateEn, fmt1, fmt2, SUBJ_BN, TIER_BN } from '../data/bn'
import { chapterById } from '../data/catalog'
import { dayProgress } from '../logic/dayStatus'
import { K } from '../logic/keys'
import { chapterQuestionStats } from '../logic/stats'
import { href, useRoute } from '../router'
import { store, useField } from '../store/store'
import { useReader, useSchedule, useToday } from '../hooks'
import { Markdown } from '../components/Markdown'
import { TopicTree } from '../components/TopicTree'
import { Bar, FullTag, pctBn, TierPill, YearDots } from '../components/ui'
import { chapterProgressFor } from './chapterInfo'

function FormulaSheet({ id }: { id: string }) {
  const k = K.formula(id)
  const text = useField<string>(k, '')
  const [preview, setPreview] = useState(true)
  return (
    <div className="card" id="f-formula-sheet">
      <div className="card-h">
        <h2>Formula sheet</h2>
        <span className="small">Markdown · inline math <code>$E=\tfrac12 LI^2$</code> · block <code>$$…$$</code></span>
      </div>
      <div className="split">
        <div className="field">
          <label htmlFor="formula-ed">Write your own</label>
          <textarea id="formula-ed" className="input" rows={10} style={{ fontFamily: 'var(--mono)', fontSize: 14 }} value={text} onChange={(e) => store.set(k, e.target.value)} placeholder={'## Key formulas\n- Self-inductance: $E = L\\,\\frac{di}{dt}$\n- Energy: $U = \\tfrac{1}{2}LI^2$'} spellCheck={false} />
        </div>
        <div className="field">
          <span className="label">Preview <button className="btn sm" onClick={() => setPreview(!preview)}>{preview ? 'Hide' : 'Show'}</button></span>
          {preview && (text ? <div className="card"><Markdown text={text} /></div> : <div className="empty">Your rendered sheet appears here.</div>)}
        </div>
      </div>
    </div>
  )
}

function Confidence({ id }: { id: string }) {
  const k = K.conf(id)
  const v = useField<number | undefined>(k, undefined)
  return (
    <div className="card">
      <div className="card-h">
        <h2>Confidence</h2>
        <span className="status">{v ? `${v} / 5` : 'Not rated yet'}</span>
      </div>
      <label className="sr-only" htmlFor="conf">Confidence 1 to 5</label>
      <input id="conf" type="range" min={1} max={5} step={1} value={v ?? 3} onChange={(e) => store.set(k, +e.target.value)} aria-valuetext={v ? `${v} of 5` : 'not rated'} style={{ opacity: v ? 1 : 0.5 }} />
      <div className="row-flex" style={{ justifyContent: 'space-between' }}>
        <span className="small">1 · shaky</span><span className="small">5 · solid</span>
      </div>
      <div className="small">Update this after each revision. Chapters at 2 or below join the 15–17 Dec revision list.</div>
      {v !== undefined && <div><button className="btn sm" onClick={() => store.set(k, null)}>Clear rating</button></div>}
    </div>
  )
}

export function ChapterView() {
  const route = useRoute()
  const r = useReader()
  const sched = useSchedule()
  const today = useToday()
  const c = route.param ? chapterById.get(route.param) : undefined
  const focus = route.query.get('focus')
  useEffect(() => {
    if (!focus) return
    const t = setTimeout(() => document.getElementById(`f-${focus}`)?.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }), 80)
    return () => clearTimeout(t)
  }, [focus, c?.id])
  if (!c) return <div className="empty">Chapter not found. <a href={href.map()}>Back to the map</a></div>
  const info = chapterProgressFor(c, sched, r)
  const qs = chapterQuestionStats(r, c)
  return (
    <div className="view">
      <div className="page-h">
        <div className="eyebrow"><a href={href.map(c.subject)}>Priority Map</a> › <span className="eb-bn">{SUBJ_BN[c.subject]}</span></div>
        <h1>{c.n}</h1>
        <div className="row-flex">
          <span className={`chip ${c.subject}`}>{SUBJ_BN[c.subject]}</span>
          <TierPill tier={c.tier} />
          <span className="small">{TIER_BN[c.tier]} · র‍্যাংক {bn(c.rank)}</span>
          {c.full && <FullTag />}
          <span className="small">{c.p} · অধ্যায় {bn(c.no)}</span>
          <span className="small">{c.en.trim()}</span>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat"><b>{fmt2(c.rate)}</b><span>প্রতি প্রশ্নপত্রে গড় প্রশ্ন</span></div>
        <div className="stat"><b>{fmt1(c.wr)}</b><span>আসল প্রশ্ন</span></div>
        <div className="stat"><b>{c.wm ? fmt1(c.wm) : '–'}</b><span>মডেল টেস্ট</span></div>
        <div className="stat"><b>{c.days ? bn(c.days) : '–'}</b><span>ট্র্যাকার দিন</span></div>
        <div className="stat"><b>{bn(qs.solved)}/{bn(qs.total)}</b><span>সমাধান করা</span></div>
        <div className="stat"><b>{bn(qs.wrong + qs.revisit)}</b><span>ভুল / আবার দেখো</span></div>
      </div>
      <div className="row-flex"><YearDots chapter={c} /><span className="small">২০১৫-১৬ → ২০২৩-২৪</span></div>

      <div className="card">
        <div className="card-h">
          <h2>Scheduled days</h2>
          <span className="small">{pctBn(info.ratio)} of micro-tasks · {info.state}</span>
        </div>
        {info.slots.length === 0 ? (
          <p className="muted">This chapter has no day in the plan.</p>
        ) : (
          <div className="stack" style={{ gap: 6 }}>
            <p><b className="bn">{info.text}</b></p>
            <Bar pct={info.ratio} />
            <div className="row-flex">
              {[...new Map(info.slots.map((s) => [s.row.date, s])).values()].map((s) => {
                const p = dayProgress(r, s.row, sched.rows)
                return (
                  <a key={s.row.date} className="btn sm" href={href.plan(s.row.date)}>
                    {dateBn(s.date)} · {s.item.part} · {bn(p.ticked)}/{bn(p.total)}{s.date === today ? ' · today' : ''}
                  </a>
                )
              })}
            </div>
            <span className="small">{dateEn(info.slots[0].date)} → {dateEn(info.slots[info.slots.length - 1].date)}</span>
          </div>
        )}
      </div>

      <div className="grid2">
        <Confidence id={c.id} />
        <div className="card">
          <h2>Questions</h2>
          <div className="meter"><div className="mh"><span>Real MIST questions solved</span><span className="num">{bn(qs.solved)}/{bn(qs.total)}</span></div><Bar pct={qs.total ? qs.solved / qs.total : 0} /></div>
          <div className="small">{qs.mtTotal ? `${bn(qs.mtTotal)} more from model tests (tracked, not counted above).` : 'No model-test questions for this chapter.'}</div>
        </div>
      </div>

      <FormulaSheet id={c.id} />

      <div className="stack">
        <h2>Topics, subtopics and MIST questions</h2>
        <p className="small">Most-asked first. Tick what you've done for each subtopic, and track every past question.</p>
        <TopicTree chapter={c} focus={focus} ticks />
        {c.notTestedInTextbook && <div className="never"><b>পাঠ্যবইয়ে আছে, প্রশ্নপত্রে আসেনি:</b> {c.notTestedInTextbook}</div>}
      </div>
    </div>
  )
}
