import { useEffect, useState } from 'react'
import { dateEn, dateLongBn, WD_BN } from '../data/bn'
import { weekdayIndex } from '../data/dhaka'
import { K } from '../logic/keys'
import { store, useField } from '../store/store'
import { useReader, useToday } from '../hooks'

type Kind = 'wake' | 'study' | 'break' | 'agency' | 'sleep'
interface Block {
  id: string
  /** minutes after midnight, Asia/Dhaka */
  from: number
  to: number
  label: string
  kind: Kind
}
const hm = (h: number, m = 0) => h * 60 + m
/** Your fixed day, in order. Sleep runs past midnight into the next morning. */
export const ROUTINE: Block[] = [
  { id: 'wake', from: hm(3, 30), to: hm(4), label: 'Wake up', kind: 'wake' },
  { id: 'study-a', from: hm(4), to: hm(8), label: 'Study Block A', kind: 'study' },
  { id: 'breakfast', from: hm(8), to: hm(9), label: 'Breakfast & shower', kind: 'break' },
  { id: 'study-b', from: hm(9), to: hm(12), label: 'Study Block B', kind: 'study' },
  { id: 'revision', from: hm(12), to: hm(13), label: 'Revision', kind: 'study' },
  { id: 'lunch', from: hm(13), to: hm(14), label: 'Lunch & rest', kind: 'break' },
  { id: 'agency-1', from: hm(14), to: hm(17), label: 'Agency Block 1', kind: 'agency' },
  { id: 'refresh', from: hm(17), to: hm(18), label: 'Refresh', kind: 'break' },
  { id: 'agency-2', from: hm(18), to: hm(20), label: 'Agency Block 2', kind: 'agency' },
  { id: 'dinner', from: hm(20), to: hm(21), label: 'Dinner & wind down', kind: 'break' },
  { id: 'sleep', from: hm(21), to: hm(3, 30), label: 'Sleep', kind: 'sleep' },
]

const len = (b: Block) => (b.to - b.from + 1440) % 1440
function clock(min: number) {
  const h = Math.floor(min / 60) % 24
  const m = min % 60
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}
function hours(min: number) {
  const h = min / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)}h`
}
/** block that covers a minute of the day */
export function blockAt(min: number): Block {
  return ROUTINE.find((b) => (b.from < b.to ? min >= b.from && min < b.to : min >= b.from || min < b.to))!
}
const totalOf = (k: Kind) => ROUTINE.filter((b) => b.kind === k).reduce((n, b) => n + len(b), 0)

/** minutes since midnight in Bangladesh (UTC+6, no daylight saving) */
function useDhakaMinute() {
  const get = () => Math.floor(((Date.now() + 6 * 3600000) % 86400000) / 60000)
  const [m, setM] = useState(get)
  useEffect(() => {
    const id = setInterval(() => setM(get()), 20000)
    const vis = () => document.visibilityState === 'visible' && setM(get())
    document.addEventListener('visibilitychange', vis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])
  return m
}

function Row({ b, date, now }: { b: Block; date: string; now: boolean }) {
  const k = K.routine(date, b.id)
  const done = useField<boolean>(k, false)
  return (
    <label className={`rt-row ${b.kind} ${done ? 'done' : ''} ${now ? 'now' : ''}`}>
      <input type="checkbox" checked={done} onChange={(e) => store.set(k, e.target.checked)} />
      <span className="rt-time">{clock(b.from)} – {clock(b.to)}</span>
      <span className="rt-label">
        <b>{b.label}</b>
        {now && <span className="rt-now">Now</span>}
      </span>
      <span className="rt-len">{hours(len(b))}</span>
    </label>
  )
}

export function RoutineView() {
  const today = useToday()
  const minute = useDhakaMinute()
  const cur = blockAt(minute)
  const r = useReader()
  const doneCount = ROUTINE.filter((b) => r.get<boolean>(K.routine(today, b.id))).length
  const left = (cur.to - minute + 1440) % 1440
  return (
    <div className="view">
      <div className="page-h">
        <div className="eyebrow">Daily routine</div>
        <h1>Today's skeleton</h1>
        <p className="small">{WD_BN[weekdayIndex(today)]}বার, {dateLongBn(today)} · {dateEn(today)} · tick each block as you finish it. Ticks reset every day.</p>
      </div>

      <div className="card rt-head">
        <div className="rt-sum">
          <div>
            <span className="label">Done today</span>
            <div className="big-num">{doneCount}<span className="rt-of"> / {ROUTINE.length}</span></div>
          </div>
          <div className="rt-cur">
            <span className="label">Right now</span>
            <b>{cur.label}</b>
            <span className="small">{clock(cur.from)} – {clock(cur.to)} · {left >= 60 ? `${Math.floor(left / 60)}h ${left % 60}m` : `${left}m`} left</span>
          </div>
        </div>
        <span className="bar"><i style={{ width: `${(doneCount / ROUTINE.length) * 100}%` }} /></span>
        <div className="rt-totals">
          <span><i className="dot study" />Study {hours(totalOf('study'))}</span>
          <span><i className="dot agency" />Agency {hours(totalOf('agency'))}</span>
          <span><i className="dot sleep" />Sleep {hours(totalOf('sleep'))}</span>
          <span><i className="dot break" />Breaks {hours(totalOf('break') + totalOf('wake'))}</span>
        </div>
      </div>

      <div className="rt-list" role="group" aria-label="Routine blocks">
        {ROUTINE.map((b) => <Row key={b.id} b={b} date={today} now={b.id === cur.id} />)}
      </div>
      <p className="small">Ticks sync to your other devices like the rest of your progress.</p>
    </div>
  )
}
