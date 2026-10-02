import { dateBn, dateEn, SUBJ_BN } from '../data/bn'
const bn = (x: string | number) => String(x)
const pctBn = (x: number) => `${Math.round(x * 100)}%`
const fmt1 = (x: number) => String(+x.toFixed(1))
import { addDays, diffDays } from '../data/dhaka'
import { PLAN_LAST, PLAN_START } from '../data/plan'
import { behindInfo, lagLabel } from '../logic/behind'
import { K } from '../logic/keys'
import {
  burnUp, movingAvg, overallCompletion, questionStats, revisionList, streak, subjectChapters, tierChapters, weakestChapters,
} from '../logic/stats'
import { href } from '../router'
import { useReader, useSchedule, useToday } from '../hooks'
import { Chart, type Series } from '../components/charts'
import { Bar, Panel, TierPill } from '../components/ui'
import { RevisionListCard } from './Endgame'
import type { Tier } from '../data/types'
import { EXAM_DATE } from '../data/plan'
import { store } from '../store/store'
import type { LateStart } from '../logic/keys'
import { BLOCK_LABEL, type StudyBlockId } from '../logic/pomo'

const LATE_RE = /^day:(\d{4}-\d{2}-\d{2}):late:(study-[abcd]|revision)$/
/** Late starts of study blocks, newest first, with a per-block summary, to see which block you put off most. */
function LateStarts({ today }: { today: string }) {
  const rows: (LateStart & { date: string; block: StudyBlockId })[] = []
  for (const k of store.fields.keys()) {
    const m = LATE_RE.exec(k)
    const v = m && store.get<LateStart>(k)
    if (m && v) rows.push({ ...v, date: m[1], block: m[2] as StudyBlockId })
  }
  rows.sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at)
  const week = new Set(Array.from({ length: 7 }, (_, i) => addDays(today, -i)))
  return (
    <div className="card">
      <div className="card-h">
        <h2>Late starts</h2>
        <span className="small">From Study Blocks · logged per block</span>
      </div>
      <div className="late-sum">
        {(['study-a', 'study-b', 'study-c', 'study-d'] as StudyBlockId[]).map((id) => ({ id, label: BLOCK_LABEL[id] })).map((b) => {
          const mine = rows.filter((r) => r.block === b.id)
          const avg = mine.length ? Math.round(mine.reduce((n, r) => n + r.min, 0) / mine.length) : 0
          const studied = [...week].reduce((n, d) => n + (store.get<number>(K.focusMs(d, b.id)) ?? 0), 0)
          return (
            <div key={b.id} className="stat">
              <b>{mine.length}</b>
              <span>{b.label}</span>
              <small>{mine.length ? `avg ${avg} min late` : 'never late'} · {Math.round(studied / 60000)} min studied this week</small>
            </div>
          )
        })}
      </div>
      {rows.length === 0 ? (
        <div className="empty">No late starts yet. When you start a study block more than a few minutes after it begins, Study Blocks asks why and it shows up here.</div>
      ) : (
        <div className="late-list">
          {rows.slice(0, 40).map((r) => (
            <div key={`${r.date}-${r.block}`} className="late-r">
              <span className="num">{dateEn(r.date)}</span>
              <b>{BLOCK_LABEL[r.block]}</b>
              <span className="status partial">{r.min} min late</span>
              <span className="late-why">{r.reason}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Meter({ label, pct, sub }: { label: React.ReactNode; pct: number; sub?: string }) {
  return (
    <div className="meter">
      <div className="mh"><span>{label}</span><span className="num">{sub ?? pctBn(pct)}</span></div>
      <Bar pct={pct} />
    </div>
  )
}

export function ProgressView() {
  const r = useReader()
  const sched = useSchedule()
  const today = useToday()
  const info = behindInfo(today, sched.rows, r)
  const overall = overallCompletion(r, sched.rows)
  const st = streak(r, sched.rows, today)
  const qAll = questionStats(r)
  const qAllMT = questionStats(r, undefined, true)

  const end = today < PLAN_LAST ? (today < PLAN_START ? PLAN_START : today) : PLAN_LAST
  const dates = Array.from({ length: diffDays(PLAN_START, end) + 1 }, (_, i) => addDays(PLAN_START, i))
  const burn = burnUp(r, sched.rows, end)
  const burnSeries: Series[] = [
    { name: 'Planned (original)', color: 'var(--muted)', dash: '5 4', values: burn.map((b) => b.planned) },
    { name: 'Actual', color: 'var(--accent)', values: burn.map((b) => b.actual) },
  ]
  // reflections are stored under a day's original date; plot them on the date it actually ran (after a shift)
  const reflDate = (d: string) => sched.byEff.get(d)?.date ?? d
  const hours = dates.map((d) => r.get<number>(K.refl(reflDate(d), 'hours')))
  const focus = dates.map((d) => r.get<number>(K.refl(reflDate(d), 'focus')))
  const hoursSeries: Series[] = [
    { name: 'Hours studied', color: 'var(--accent)', kind: 'bar', values: hours },
    { name: '7-day average', color: 'var(--warn)', values: movingAvg(hours) },
  ]
  const focusSeries: Series[] = [
    { name: 'Focus (1–5)', color: 'var(--accent)', values: focus },
    { name: '7-day average', color: 'var(--warn)', dash: '5 4', values: movingAvg(focus) },
  ]
  const weak = weakestChapters(r)
  const rev = revisionList(r)
  const anyRefl = hours.some((h) => h !== undefined) || focus.some((f) => f !== undefined)
  const fmtL = (l: string) => dateBn(l)

  return (
    <div className="view">
      <div className="page-h">
        <div className="eyebrow">Progress</div>
        <h1>How it's going</h1>
        <p className="small">{lagLabel(info.lag)} · {info.daysLeft} days to the exam ({dateEn(EXAM_DATE)})</p>
      </div>

      <div className="grid2">
        <div className="card">
          <span className="label">Overall completion</span>
          <div className="big-num">{pctBn(overall.pct)}</div>
          <span className="small">{bn(overall.done)} of {bn(overall.total)} study days · {bn(overall.tasks.done)}/{bn(overall.tasks.total)} micro-tasks</span>
          <Bar pct={overall.pct} />
        </div>
        <div className="card">
          <span className="label">Streak</span>
          <div className="big-num">{bn(st)} <span className="small" style={{ fontWeight: 400 }}>day{st === 1 ? '' : 's'} in a row</span></div>
          <span className="small">Consecutive days completed. Today doesn't break it until it ends.</span>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>By subject</h2>
          {(['P', 'C', 'M'] as const).map((s) => {
            const c = subjectChapters(r, sched, s)
            return <Meter key={s} label={<span className={`chip ${s}`}>{SUBJ_BN[s]}</span>} pct={c.pct} sub={`${bn(c.done)}/${bn(c.total)} chapters${c.started ? ` · ${c.started} started` : ''}`} />
          })}
        </div>
        <div className="card">
          <h2>By tier</h2>
          {(['T1', 'T2', 'T3', 'T4'] as Tier[]).map((t) => {
            const c = tierChapters(r, sched, t)
            return <Meter key={t} label={<TierPill tier={t} />} pct={c.pct} sub={`${bn(c.done)}/${bn(c.total)} chapters${c.started ? ` · ${c.started} started` : ''}`} />
          })}
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h2>Past questions</h2>
          <span className="small">Real MIST questions only in the totals · {bn(qAllMT.total - qAll.total)} more are from model tests</span>
        </div>
        <Meter label={<b>All subjects</b>} pct={qAll.total ? qAll.solved / qAll.total : 0} sub={`${bn(qAll.solved)}/${bn(qAll.total)} solved`} />
        {(['Phy', 'Chem', 'Math'] as const).map((s) => {
          const q = questionStats(r, s)
          return <Meter key={s} label={<span className={`chip ${s}`}>{SUBJ_BN[s]}</span>} pct={q.total ? q.solved / q.total : 0} sub={`${bn(q.solved)}/${bn(q.total)} solved · ${bn(q.wrong)} wrong · ${bn(q.revisit)} revisit`} />
        })}
        <div className="row-flex">
          <span className="tag zero">Wrong {bn(qAllMT.wrong)}</span>
          <span className="tag">Revisit {bn(qAllMT.revisit)}</span>
          <span className="small">(including model-test questions)</span>
        </div>
      </div>

      <div className="card">
        <h2>Study days: plan vs actual</h2>
        <p className="small">Cumulative completed study days against the original schedule. A gap under the dashed line means you're behind.</p>
        <Chart title="Cumulative study days" labels={burn.map((b) => b.date)} series={burnSeries} yLabel="days" fmtLabel={fmtL} />
      </div>

      <div className="grid2">
        <div className="card">
          <h2>Hours studied</h2>
          {anyRefl ? <Chart title="Hours studied per day" labels={dates} series={hoursSeries} yLabel="hours" fmtLabel={fmtL} /> : <div className="empty">Fill the end-of-day reflection to see this.</div>}
        </div>
        <div className="card">
          <h2>Focus rating</h2>
          {anyRefl ? <Chart title="Focus rating per day" labels={dates} series={focusSeries} yMax={5} yTicks={5} yLabel="rating" fmtLabel={fmtL} /> : <div className="empty">Fill the end-of-day reflection to see this.</div>}
        </div>
      </div>

      <LateStarts today={today} />

      <div className="card">
        <h2>Weakest chapters</h2>
        <p className="small">Lowest confidence × highest tier. This is what to revise first.</p>
        {weak.length === 0 ? (
          <div className="empty">Rate a chapter's confidence (on its chapter page) and it shows up here.</div>
        ) : (
          <div className="stack" style={{ gap: 0 }}>
            {weak.map((w) => (
              <a key={w.chapter.id} className="rev-item" href={href.chapter(w.chapter.id)} style={{ color: 'inherit', textDecoration: 'none' }}>
                <TierPill tier={w.chapter.tier} />
                <span className="grow"><b>{w.chapter.n}</b><br /><span className="small">{SUBJ_BN[w.chapter.subject]} · র‍্যাংক {bn(w.chapter.rank)}</span></span>
                <span className="status partial">confidence {w.confidence}/5</span>
              </a>
            ))}
          </div>
        )}
      </div>

      <Panel title={`Revision list for 15–17 Dec · ${bn(rev.length)} items`}>
        <RevisionListCard />
      </Panel>
      <p className="small">Average this week's hours: {fmt1(movingAvg(hours).filter((x): x is number => x !== undefined).at(-1) ?? 0)}</p>
    </div>
  )
}
