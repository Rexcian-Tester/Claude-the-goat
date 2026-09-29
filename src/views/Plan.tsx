import { memo, useCallback, useState } from 'react'
import { bn, dateBn, dateEn, MONTHS_BN as MONTH_BN, WD_BN } from '../data/bn'
import { addDays, weekdayIndex } from '../data/dhaka'
import { studyPlan } from '../data/load'
import { endgameKind, endgameRows, planDays } from '../data/plan'
import { dayProgress } from '../logic/dayStatus'
import { behindInfo, lagLabel } from '../logic/behind'
import { K } from '../logic/keys'
import type { Reader } from '../logic/reader'
import type { Row, Schedule } from '../logic/schedule'
import { itemTier } from '../logic/stats'
import { closeTo, href, useRoute } from '../router'
import { store } from '../store/store'
import { useReader, useSchedule, useToday } from '../hooks'
import { Panel, Sheet, SubjectChip, TierPill } from '../components/ui'
import { BehindBanner } from './BehindBanner'
import { DayBody, KindBadges, Methods } from './day'

type St = 'done' | 'partial' | 'overdue' | 'todo'
function rowStatus(r: Reader, row: Row, rows: Row[], today: string) {
  const p = dayProgress(r, row, rows)
  const st: St = p.complete ? 'done' : row.eff !== null && row.eff < today && !row.isBuffer ? 'overdue' : p.ticked > 0 || p.resolved > 0 ? 'partial' : 'todo'
  return { p, st }
}
const STATUS_LABEL: Record<St, string> = { done: 'Done', partial: 'In progress', overdue: 'Overdue', todo: '' }

function ItemLine({ row }: { row: Row }) {
  return (
    <>
      {row.items.map((it) => {
        const tier = itemTier(it)
        return (
          <div key={it.key} className="item">
            <div className="top">
              <SubjectChip s={it.s} />
              <span className="ch">{it.ch}</span>
            </div>
            <div className="meta">
              {tier && <TierPill tier={tier} />}
              <span className="part">{it.part}</span>
              <KindBadges item={it} />
            </div>
            <div className="topics-t">{it.t}</div>
            {it.m && <div className="note">{it.m}</div>}
          </div>
        )
      })}
    </>
  )
}

function DayRow({ row, today, sched }: { row: Row; today: string; sched: Schedule }) {
  const r = useReader()
  const { p, st } = rowStatus(r, row, sched.rows, today)
  const eff = row.eff
  return (
    <a className={`day st-${st} ${eff === today ? 'is-today' : ''}`} href={href.plan(row.date)} aria-label={`${eff ? dateBn(eff) : 'Unscheduled'}, day ${row.dayNo}, ${row.items.map((i) => i.ch).join(', ')}`}>
      <div className="date">
        <span className="dd">{eff ? bn(Number(eff.slice(8))) : '—'}</span>
        <span className="mm">{eff ? `${MONTH_BN[Number(eff.slice(5, 7)) - 1]} · ${WD_BN[weekdayIndex(eff)]}বার` : 'Unscheduled'}</span>
        <span className="ix">Day {row.dayNo}{eff === today ? ' · today' : ''}{eff && eff !== row.date ? ` · was ${dateEn(row.date)}` : ''}</span>
      </div>
      <div className="body"><ItemLine row={row} /></div>
      <div className="ratio">
        <span className="num">{bn(p.ticked)}/{bn(p.total)}</span>
        {STATUS_LABEL[st] && <span className={`status ${st}`}>{STATUS_LABEL[st]}</span>}
      </div>
    </a>
  )
}

const MONTHS = [
  { y: 2026, m: 9, name: 'সেপ্টেম্বর' },
  { y: 2026, m: 10, name: 'অক্টোবর' },
  { y: 2026, m: 11, name: 'নভেম্বর' },
  { y: 2026, m: 12, name: 'ডিসেম্বর' },
]
const WD_SHORT = ['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র']
const SUB_LETTER: Record<string, string> = { P: 'প', C: 'র', M: 'গ', X: 'ধ' }

function MonthGrid({ sched, today }: { sched: Schedule; today: string }) {
  const r = useReader()
  return (
    <div className="stack" style={{ gap: 32 }}>
      <div className="legend">
        <span className="pd"><span className="chip P">প</span> পদার্থ</span>
        <span className="pd"><span className="chip C">র</span> রসায়ন</span>
        <span className="pd"><span className="chip M">গ</span> গণিত</span>
        <span className="pd"><span className="chip X">ধ</span> ধরা-পড়ার দিন</span>
        <span className="pd"><span className="status done">Done</span><span className="status partial">In progress</span><span className="status overdue">Overdue</span></span>
      </div>
      {MONTHS.map(({ y, m, name }) => {
        const first = `${y}-${String(m).padStart(2, '0')}-01`
        const nDays = new Date(Date.UTC(y, m, 0)).getUTCDate()
        const lead = (weekdayIndex(first) + 1) % 7 // Saturday-first
        const all: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: nDays }, (_, i) => `${y}-${String(m).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`)]
        while (all.length % 7) all.push(null)
        // drop weeks with nothing scheduled (September only has the 30th)
        const cells: (string | null)[] = []
        for (let w = 0; w < all.length; w += 7) {
          const week = all.slice(w, w + 7)
          if (week.some((d) => d && (sched.byEff.has(d) || endgameKind(d)))) cells.push(...week)
        }
        if (!cells.length) return null
        return (
          <section key={m} className="month" aria-label={`${name} ${bn(y)}`}>
            <h3>{name} {bn(y)}</h3>
            <div className="mgrid">
              {WD_SHORT.map((w) => <div key={w} className="wdh">{w}</div>)}
              {cells.map((d, i) => {
                if (!d) return <div key={i} className="cell empty-c" />
                const row = sched.byEff.get(d)
                const eg = endgameKind(d)
                const day = Number(d.slice(8))
                if (row) {
                  const { p, st } = rowStatus(r, row, sched.rows, today)
                  return (
                    <a key={d} className={`cell st-${st} ${d === today ? 'is-today' : ''}`} href={href.plan(row.date)} aria-label={`${dateBn(d)}: ${row.items.map((x) => x.ch).join(', ')}. ${STATUS_LABEL[st]}`}>
                      <span className="cn">{bn(day)}</span>
                      <span className="cs">{row.items.map((it) => <i key={it.key} className={it.s}>{SUB_LETTER[it.s]}</i>)}</span>
                      <span className="pr"><i style={{ width: `${p.ratio * 100}%` }} /></span>
                    </a>
                  )
                }
                if (eg) return (
                  <a key={d} className={`cell eg ${eg === 'exam' ? 'exam' : ''} ${d === today ? 'is-today' : ''}`} href={href.plan(d)} aria-label={`${dateBn(d)}: ${eg}`}>
                    <span className="cn">{bn(day)}</span>
                    <span style={{ fontSize: 10 }}>{eg === 'revision' ? 'রিভিশন' : eg === 'rest' ? 'বিশ্রাম' : 'MIST'}</span>
                  </a>
                )
                return <div key={d} className="cell empty-c" />
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function DaySheet({ date, sched, today }: { date: string; sched: Schedule; today: string }) {
  const row = sched.byOrig.get(date)
  const close = () => closeTo(href.plan())
  if (!row) {
    const eg = endgameKind(date)
    const what = studyPlan.meta.endgame.find((e) => e.date.includes(date) || (e.date.includes('..') && date >= e.date.split('..')[0] && date <= e.date.split('..')[1]))
    return (
      <Sheet routed title={`${dateBn(date)} · ${eg === 'exam' ? 'MIST exam' : eg === 'rest' ? 'Rest day' : 'Revision'}`} onClose={close}>
        <p>{what?.what ?? 'Nothing scheduled.'}</p>
        <a className="btn" href={href.today()}>Open Today</a>
      </Sheet>
    )
  }
  return (
    <Sheet routed title={<>দিন {bn(row.dayNo)} · {row.eff ? dateBn(row.eff) : 'Unscheduled'} <span className="small">{row.eff ? dateEn(row.eff) : ''}</span></>} onClose={close}>
      {row.eff !== row.date && <div className="banner info">Originally planned for {dateBn(row.date)}.</div>}
      {row.eff === null && <div className="banner bad">This day no longer fits before 15 December. Decide what to cut using the "If you fall behind" rules.</div>}
      <DayBody row={row} sched={sched} today={today} />
    </Sheet>
  )
}

type Layout = 'list' | 'month'

export function PlanView() {
  const today = useToday()
  const sched = useSchedule()
  const route = useRoute()
  const [view, setViewState] = useState<Layout>(() => {
    try {
      return localStorage.getItem('mist-plan-view') === 'month' ? 'month' : 'list'
    } catch {
      return 'list'
    }
  })
  const setView = useCallback((v: Layout) => {
    setViewState(v)
    try {
      localStorage.setItem('mist-plan-view', v)
    } catch {
      /* ignore */
    }
  }, [])
  return (
    <div className="view">
      <PlanBody today={today} sched={sched} view={view} setView={setView} />
      {route.param && <DaySheet date={route.param} sched={sched} today={today} />}
    </div>
  )
}

/** Everything under the sheet. Memoised so opening or closing a day doesn't rebuild the whole plan. */
const PlanBody = memo(function PlanBody({ today, sched, view, setView }: { today: string; sched: Schedule; view: Layout; setView: (v: Layout) => void }) {
  const r = useReader()
  const info = behindInfo(today, sched.rows, r)
  const counts = {
    days: planDays.length,
    study: planDays.filter((d) => !d.isBuffer).length,
    cls: planDays.reduce((n, d) => n + d.items.filter((i) => i.k === 'cls').length, 0),
    half: planDays.filter((d) => d.items.some((i) => i.k === 'half')).length,
    buf: planDays.filter((d) => d.isBuffer).length,
  }
  const inPhase = (name: string) => sched.rows.filter((x) => x.phase === name && x.eff).sort((a, b) => a.eff!.localeCompare(b.eff!))
  const phases = studyPlan.meta.phases
  const day0 = sched.rows[0]

  return (
    <>
      <div className="page-h">
        <div className="eyebrow">Study plan · 30 Sep – 19 Dec 2026</div>
        <h1>Plan</h1>
        <p className="small">{counts.days} rows (Day 0 + 1 Oct–14 Dec) · {counts.study} study days · {counts.cls} class days · {counts.half} half days · {counts.buf} catch-up days · <b>{lagLabel(info.lag)}</b></p>
      </div>

      <BehindBanner sched={sched} today={today} />
      {sched.shifted && (
        <div className="banner info">
          <span><b>This schedule has been shifted.</b> {sched.absorbed.length > 0 && `Catch-up day${sched.absorbed.length === 1 ? '' : 's'} used: ${sched.absorbed.map((b) => dateBn(b.date)).join(', ')}. `}{sched.unscheduled.length > 0 && `${sched.unscheduled.length} day(s) no longer fit before 15 Dec and are parked as Unscheduled. `}The original plan is untouched and can be restored.</span>
          <div><button className="btn sm" onClick={() => confirm('Restore the original schedule? Your ticks stay.') && store.set(K.shift, null)}>Reset to original schedule</button></div>
        </div>
      )}

      <div className="row-flex" style={{ justifyContent: 'space-between' }}>
        <div className="seg" role="group" aria-label="Plan layout">
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}>List</button>
          <button aria-pressed={view === 'month'} onClick={() => setView('month')}>Month grid</button>
        </div>
        <span className="small">Tap a day to open it.</span>
      </div>

      {view === 'month' ? (
        <MonthGrid sched={sched} today={today} />
      ) : (
        <div className="phases">
          {day0 && day0.eff && (
            <section className="phase">
              <div className="phase-h"><span className="ph-n">Start</span><h2>দিন ০</h2><span className="ph-d">{dateBn(day0.eff)}</span></div>
              <div className="days"><DayRow row={day0} today={today} sched={sched} /></div>
            </section>
          )}
          {phases.map((ph, idx) => {
            const list = inPhase(ph.name)
            return (
              <section key={ph.name} className="phase">
                <div className="phase-h">
                  <span className="ph-n">Phase {idx + 1}</span>
                  <h2>{ph.name}</h2>
                  <span className="ph-d">{list.length ? `${dateBn(list[0].eff!)} – ${dateBn(list[list.length - 1].eff!)} · ${bn(list.length)} দিন` : ''}</span>
                </div>
                <p className="ph-about">{ph.about}</p>
                <div className="days">{list.map((row) => <DayRow key={row.date} row={row} today={today} sched={sched} />)}</div>
              </section>
            )
          })}
          {sched.unscheduled.length > 0 && (
            <section className="phase">
              <div className="phase-h"><span className="ph-n">Parked</span><h2>Unscheduled</h2><span className="ph-d">did not fit before 15 Dec</span></div>
              <div className="days">{sched.unscheduled.map((row) => <DayRow key={row.date} row={row} today={today} sched={sched} />)}</div>
            </section>
          )}
        </div>
      )}

      <section className="stack" style={{ gap: 8 }}>
        <h2>Endgame</h2>
        <div className="endgame-grid">
          {endgameRows.length > 0 && studyPlan.meta.endgame.map((e) => {
            const ds = e.date.split('..')
            const label = ds.length === 2 ? `${dateBn(ds[0])} – ${dateBn(ds[1])}` : dateBn(ds[0])
            return (
              <a key={e.date} className={`eg ${e.date === '2026-12-19' ? 'exam' : ''}`} href={href.plan(ds[0])} style={{ color: 'inherit', textDecoration: 'none' }}>
                <span className="dn">{label}</span>
                <p className="small">{e.what}</p>
              </a>
            )
          })}
        </div>
      </section>

      <Methods />
      <Panel title="What changed from your tracker">
        <p className="small">Chapters where the plan gives more or fewer days than your original tracker. Chapters not listed keep their original days.</p>
        <div className="tbl">
          <table className="plain">
            <thead><tr><th>Chapter</th><th>Tracker</th><th>Plan</th></tr></thead>
            <tbody>
              {studyPlan.trackerChanges.map(([s, ch, oldD, newD], i) => (
                <tr key={i}>
                  <td><SubjectChip s={s} /> {ch}</td>
                  <td className="num" style={{ textAlign: 'center' }}>{bn(oldD)}</td>
                  <td className="num" style={{ textAlign: 'center', fontWeight: 700, color: newD > oldD ? 'var(--accent)' : 'var(--warn)' }}>{bn(newD)} {newD > oldD ? '↑' : '↓'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  )
})
export { addDays }
