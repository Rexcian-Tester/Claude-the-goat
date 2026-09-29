import { useState } from 'react'
import { dateBn, dateEn, dateLongBn, WD_BN } from '../data/bn'
import { addDays, diffDays, weekdayIndex } from '../data/dhaka'
import { studyPlan } from '../data/load'
import { ENDGAME_START, PLAN_START, endgameKind } from '../data/plan'
import { isEndgame, phaseOf } from '../logic/behind'
import type { Row } from '../logic/schedule'
import { useSchedule, useToday } from '../hooks'
import { Countdown } from '../components/Countdown'
import { Timer } from '../components/Timer'
import { href } from '../router'
import { BehindBanner } from './BehindBanner'
import { DayBody, DayMini, ItemHeader, OverdueJump, OverdueList } from './day'
import { EndgameView } from './Endgame'
import { Accountability, RemindersCard } from './Habits'

const RECALL_MIN = 'mist-recall-minutes'
function YesterdayCard({ row }: { row: Row }) {
  const [minutes, setMinutesState] = useState(() => {
    try {
      const n = Number(localStorage.getItem(RECALL_MIN))
      return n >= 1 && n <= 300 ? n : 15
    } catch {
      return 15
    }
  })
  const setMinutes = (n: number) => {
    setMinutesState(n)
    try {
      localStorage.setItem(RECALL_MIN, String(n))
    } catch {
      /* ignore */
    }
  }
  return (
    <div className="card">
      <div className="card-h">
        <h2>Yesterday's formulas</h2>
        <span className="small">{dateBn(row.eff!)} · {dateEn(row.eff!)}</span>
      </div>
      <p className="small">Before opening anything new: rewrite the key formulas from these topics from memory.</p>
      {row.items.map((it) => (
        <div key={it.key} className="stack" style={{ gap: 4 }}>
          <ItemHeader item={it} />
          <ul className="plain small" style={{ color: 'var(--ink)' }}>{it.topicList.map((t, i) => <li key={i}>{t}</li>)}</ul>
          <div className="row-flex">
            {it.chapters.map((c) => <a key={c.id} className="btn sm" href={href.chapter(c.id, 'formula-sheet')}>Formula sheet · {c.n}</a>)}
          </div>
        </div>
      ))}
      <Timer id="recall" minutes={minutes} onMinutes={setMinutes} label="Recall time is up. Check your rewrite against your formula sheet." />
    </div>
  )
}

export function TodayView() {
  const today = useToday()
  const sched = useSchedule()
  const phase = phaseOf(today)

  if (isEndgame(today) || phase === 'after') return <EndgameView today={today} />

  const row = sched.byEff.get(today)
  const prev = [...sched.rows].filter((x) => x.eff !== null && x.eff < today && !x.isBuffer).sort((a, b) => b.eff!.localeCompare(a.eff!))[0]
  const tomorrowISO = addDays(today, 1)
  const tomorrow = sched.byEff.get(tomorrowISO)
  const tmrEg = endgameKind(tomorrowISO)

  return (
    <div className="view">
      <div className="page-h">
        <div className="eyebrow">Today · Bangladesh time</div>
        <h1>{WD_BN[weekdayIndex(today)]}বার, {dateLongBn(today)}</h1>
        <p className="small">
          {dateEn(today)}
          {row && ` · Day ${row.dayNo} · ${row.phase}`}
          {phase === 'before' && ` · plan starts ${dateEn(PLAN_START)} (in ${diffDays(today, PLAN_START)} day${diffDays(today, PLAN_START) === 1 ? '' : 's'})`}
        </p>
      </div>

      <Countdown target={ENDGAME_START} from={PLAN_START} title={`Countdown to ${dateBn(ENDGAME_START)}`} sub="Study plan ends · endgame begins" />

      <div className="grid2 habits">
        <RemindersCard />
        <Accountability sched={sched} />
      </div>

      <BehindBanner sched={sched} today={today} />
      <OverdueJump sched={sched} today={today} />

      {phase === 'before' && (
        <div className="banner info">
          <b>The plan starts on {dateBn(PLAN_START)} (Day ০).</b> Nothing is due yet. Have a look at tomorrow's items below, and set your passcode in <a href={href.settings()}>Settings</a> so your phone and laptop stay in sync.
        </div>
      )}

      {prev && phase === 'study' && <YesterdayCard row={prev} />}

      {phase === 'study' && (
        row ? (
          <div className="card accent">
            <div className="card-h">
              <span className="today-when">Today · Day {row.dayNo} · {row.phase}</span>
              {row.isBuffer && <span className="badge buf">ধরা-পড়ার দিন</span>}
            </div>
            <DayBody row={row} sched={sched} today={today} />
          </div>
        ) : (
          <div className="empty">No study day sits on today's date (the plan was shifted). Check the <a href={href.plan()}>Plan</a>.</div>
        )
      )}

      <OverdueList sched={sched} today={today} />

      <div className="card">
        <h2>Tomorrow · {dateBn(tomorrowISO)}</h2>
        {tomorrow ? <DayMini row={tomorrow} /> : tmrEg === 'revision' ? <p>Endgame begins: revision list and timed model tests only.</p> : <p className="muted">Nothing scheduled.</p>}
        {tomorrow?.isBuffer && <p className="small">A catch-up day: finish anything left over, or solve the Repeats list.</p>}
      </div>

      <details className="panel">
        <summary>Daily method</summary>
        <div className="panel-b"><ol className="plain method">{studyPlan.meta.dailyMethod.map((m, i) => <li key={i}>{m}</li>)}</ol></div>
      </details>
    </div>
  )
}
