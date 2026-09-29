import { useEffect, useState } from 'react'
import { bn, dateSpanBn, dayRangeBn, fmt1, fmt2, SUBJ_BN, yearBn } from '../data/bn'
import { chaptersBySubject } from '../data/catalog'
import { extras } from '../data/load'
import { repeats } from '../data/repeats'
import type { Chapter, Subject } from '../data/types'
import { K } from '../logic/keys'
import { chapterProgress } from '../logic/stats'
import { go, href, useRoute } from '../router'
import { useReader, useSchedule } from '../hooks'
import { TopicTree } from '../components/TopicTree'
import { Bar, FullTag, Panel, pctBn, QStatusButtons, TierPill, YearDots } from '../components/ui'
import { chapterProgressFor } from './chapterInfo'

const TABS = ['Phy', 'Chem', 'Math', 'Eng', 'Rep'] as const
type Tab = (typeof TABS)[number]

function ChapterRow({ c, maxRate, open, onToggle }: { c: Chapter; maxRate: number; open: boolean; onToggle: () => void }) {
  const sched = useSchedule()
  const r = useReader()
  const slots = sched.slots.get(c.id) ?? []
  const prog = chapterProgress(r, sched.rows, slots)
  const dates = [...new Set(slots.map((s) => s.date))]
  const nos = [...new Set(slots.map((s) => s.dayNo))]
  return (
    <>
      <div className="mrow" onClick={onToggle}>
        <span className="rank">{bn(c.rank)}</span>
        <span className="cname">
          <span className="ln1">
            <button className="rowbtn" aria-expanded={open} onClick={(e) => { e.stopPropagation(); onToggle() }} style={{ width: 'auto', fontWeight: 600 }}>
              <span className="chev" aria-hidden="true">▸</span><span>{c.n}</span>
            </button>
            {c.full && <FullTag />}
            {c.wr === 0 && c.wm === 0 && <span className="tag zero">কোথাও আসেনি</span>}
            {c.wr === 0 && c.wm > 0 && <span className="tag zero">আসল প্রশ্নে আসেনি</span>}
            {!slots.length && <span className="tag">পরিকল্পনায় নেই</span>}
          </span>
          <span className="ln2">{c.p} · অধ্যায় {bn(c.no)} · আসল প্রশ্ন {fmt1(c.wr)}টি</span>
        </span>
        <span className="tier"><TierPill tier={c.tier} /></span>
        <span className="barwrap"><Bar pct={maxRate ? c.rate / maxRate : 0} />{fmt2(c.rate)}</span>
        <YearDots chapter={c} />
        <span className="cnum mtc">{c.wm ? fmt1(c.wm) : '–'}</span>
        <span className="cnum">{c.days ? bn(c.days) : '–'}</span>
        <span className="sched-c">
          {slots.length ? (
            <>
              <a href={href.plan(slots[0].row.date)} onClick={(e) => e.stopPropagation()}>{dateSpanBn(dates)}</a>
              <span className="muted">{dayRangeBn(nos)} · {pctBn(prog.ratio)}</span>
              <Bar pct={prog.ratio} />
            </>
          ) : <span className="muted">–</span>}
        </span>
      </div>
      {open && (
        <div className="detail">
          <div className="row-flex">
            <a className="btn sm primary" href={href.chapter(c.id)}>Open chapter page</a>
            <span className="small">Per-question status here also shows on the chapter page and Progress.</span>
          </div>
          <TopicTree chapter={c} />
          {c.notTestedInTextbook && <div className="never"><b>পাঠ্যবইয়ে আছে, প্রশ্নপত্রে আসেনি:</b> {c.notTestedInTextbook}</div>}
        </div>
      )}
    </>
  )
}

function Ranking({ subject }: { subject: Subject }) {
  const list = chaptersBySubject[subject]
  const maxRate = Math.max(...list.map((c) => c.rate))
  const [openId, setOpenId] = useState<string | null>(list[0]?.id ?? null)
  useEffect(() => setOpenId(list[0]?.id ?? null), [subject, list])
  return (
    <>
      <p className="summary" dangerouslySetInnerHTML={{ __html: extras.subjectSummary[subject] }} />
      <div className="legend">
        <span><span className="pill T1">স্তর-১</span> অবশ্যই আয়ত্ত করতে হবে</span>
        <span><span className="pill T2">স্তর-২</span> উচ্চ</span>
        <span><span className="pill T3">স্তর-৩</span> মাঝারি</span>
        <span><span className="pill T4">স্তর-৪</span> কম</span>
        <span className="pd"><span className="dots"><span className="on" /></span> এসেছে</span>
        <span className="pd"><span className="dots"><span className="na" /></span> বছরের পৃষ্ঠা PDF-এ নেই</span>
        <span className="pd"><span className="dots"><span className="ns" /></span> সংক্ষিপ্ত সিলেবাসের বাইরে</span>
      </div>
      <div className="tbl">
        <div className="mhead">
          <span>#</span><span>অধ্যায়</span><span>স্তর</span><span>প্রতি প্রশ্নপত্রে গড়</span><span>'১৬–'২৪ প্রশ্নপত্র</span>
          <span style={{ textAlign: 'right' }}>মডেল টেস্ট</span><span style={{ textAlign: 'right' }}>ট্র্যাকার দিন</span><span>পরিকল্পনা</span>
        </div>
        {list.map((c) => <ChapterRow key={c.id} c={c} maxRate={maxRate} open={openId === c.id} onToggle={() => setOpenId(openId === c.id ? null : c.id)} />)}
      </div>
    </>
  )
}

function Repeats() {
  const r = useReader()
  void r
  return (
    <>
      <p className="summary"><b>যেসব প্রশ্ন MIST একাধিকবার করেছে বা মডেল টেস্টে হুবহু এসেছে।</b> এগুলো নিশ্চিতভাবে অনুশীলন করবে। এগুলো ১৫–১৭ ডিসেম্বরের রিভিশন তালিকায় স্বয়ংক্রিয়ভাবে যুক্ত হয়।</p>
      <div className="stack" style={{ gap: 0 }}>
        {repeats.map((rep) => (
          <div key={rep.id} className="q-row">
            <div className="q-line">
              <span className="chip Phy" style={{ background: 'var(--line)', color: 'var(--ink)' }}>{rep.subject}</span>
              <span className="tag mt">{rep.match}</span>
            </div>
            <div>{rep.question}</div>
            <div className="small">{rep.where}</div>
            <div className="row-flex">
              <QStatusButtons k={K.qStatus(rep.id)} />
              {rep.chapterIds.slice(0, 2).map((id) => {
                const ch = Object.values(chaptersBySubject).flat().find((c) => c.id === id)!
                return <a key={id} className="btn sm" href={href.chapter(id, rep.questionIds.find((q) => q.startsWith(id)))}>{ch.n}</a>
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function English() {
  return (
    <div className="tbl">
      <table className="plain">
        <thead><tr><th>প্রশ্নের ধরন</th><th>কতবার এসেছে</th></tr></thead>
        <tbody>{extras.english.map((e, i) => <tr key={i}><td>{e.type}</td><td>{e.frequency}</td></tr>)}</tbody>
      </table>
    </div>
  )
}

function HotTopics() {
  const all = (Object.keys(chaptersBySubject) as Subject[]).flatMap((S) => chaptersBySubject[S].flatMap((c) => c.topics.map((t) => ({ S, c: c.n, t }))))
  all.sort((a, b) => b.t.wr - a.t.wr || b.t.years.length - a.t.years.length || b.t.wm - a.t.wm)
  return (
    <div className="hot">
      {all.slice(0, 15).map((x, i) => (
        <div key={i}>
          <span className="s">{SUBJ_BN[x.S]} · {x.c}</span>
          <span className="t">{x.t.n}</span>
          <span className="y">{fmt1(x.t.wr)}টি প্রশ্ন · {x.t.years.map((y) => "'" + bn(y.slice(5))).join(' ')}</span>
        </div>
      ))}
    </div>
  )
}

export function MapView() {
  const route = useRoute()
  const stored = (() => {
    try {
      return localStorage.getItem('mist-tab')
    } catch {
      return null
    }
  })()
  const tab: Tab = (TABS as readonly string[]).includes(route.param ?? '') ? (route.param as Tab) : (TABS as readonly string[]).includes(stored ?? '') ? (stored as Tab) : 'Phy'
  const setTab = (t: Tab) => {
    try {
      localStorage.setItem('mist-tab', t)
    } catch {
      /* ignore */
    }
    go(href.map(t))
  }
  return (
    <div className="view">
      <div className="page-h">
        <div className="eyebrow">MIST Unit-A · বিগত বছরের প্রশ্ন বিশ্লেষণ</div>
        <h1>MIST অধ্যায়ভিত্তিক গুরুত্ব তালিকা</h1>
        <p className="small">২০১৫-১৬ থেকে ২০২৩-২৪ সালের প্রশ্ন এবং ৫টি মডেল টেস্ট। প্রতিটি অধ্যায়ের পাশে পরিকল্পনার তারিখ ও অগ্রগতি দেখানো আছে।</p>
      </div>
      <Panel title="বিশ্লেষণ থেকে যা পাওয়া গেল">
        <ol className="find">{extras.findings.map((f, i) => <li key={i} dangerouslySetInnerHTML={{ __html: f }} />)}</ol>
      </Panel>
      <Panel title="তিন বিষয়ে সবচেয়ে বেশি আসা টপিক"><HotTopics /></Panel>
      <div>
        <div className="tabs" role="tablist" aria-label="Subjects">
          {TABS.map((k) => (
            <button key={k} className="tab" role="tab" id={`tab-${k}`} aria-selected={tab === k} aria-controls="map-panel" onClick={() => setTab(k)}>{SUBJ_BN[k]}</button>
          ))}
        </div>
        <div className="panel-box" role="tabpanel" id="map-panel" aria-labelledby={`tab-${tab}`}>
          {tab === 'Eng' ? <English /> : tab === 'Rep' ? <Repeats /> : <Ranking subject={tab} />}
        </div>
      </div>
      <p className="small">{yearBn('2015-16')}–{yearBn('2023-24')} · র‍্যাংকিং: ৮৫% আসল প্রশ্নপত্র, ১৫% মডেল টেস্ট।</p>
    </div>
  )
}
export { chapterProgressFor }
