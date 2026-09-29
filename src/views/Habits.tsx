import { useEffect, useState, type MouseEvent } from 'react'
import { bn, dateEn } from '../data/bn'
import { addDays, weekdayIndex } from '../data/dhaka'
import { dayProgress } from '../logic/dayStatus'
import { K, type GoalAnswer } from '../logic/keys'
import type { Schedule } from '../logic/schedule'
import { goFromSheet, href } from '../router'
import { store, useField } from '../store/store'
import { useReader, useToday } from '../hooks'
import { Sheet } from '../components/ui'

/* ---------- standing reminders ---------- */
interface Reminder {
  id: string
  title: string
  when: string
  why: string
  to: string
  open: string
  /** shown in the pop-up every time the app is opened */
  nag: boolean
}
export const REMINDERS: Reminder[] = [
  { id: 'english', title: 'Study English', when: 'Whenever you get time', why: 'English is in the exam and needs no heavy setup: a few questions in any spare 15 minutes.', to: href.map('Eng'), open: 'English question types', nag: true },
  { id: 'semi', title: 'Study Semiconductor', when: 'Whenever you get time', why: 'সেমিকন্ডাক্টর ও ইলেকট্রনিক্স: short, formula-light, and easy marks once it clicks.', to: href.chapter('Phy-2-10-semiconductor'), open: 'Semiconductor chapter', nag: true },
  { id: 'revise', title: 'Revise', when: 'Every day', why: "Rewrite yesterday's formulas from memory before opening anything new.", to: href.today(), open: '', nag: false },
]

function ReminderRow({ it, date, onOpen }: { it: Reminder; date: string; onOpen?: (e: MouseEvent<HTMLAnchorElement>) => void }) {
  const k = K.rem(date, it.id)
  const done = useField<boolean>(k, false)
  return (
    <div className={`rem ${done ? 'is-done' : ''}`}>
      <span className={`rem-ic ${it.id}`} aria-hidden="true">{it.id === 'english' ? 'En' : it.id === 'semi' ? 'Si' : '↻'}</span>
      <div className="rem-t">
        <b>{it.title}</b>
        <span className="rem-when">{it.when}</span>
        {it.open && <a href={it.to} onClick={onOpen} className="rem-link">{it.open} →</a>}
      </div>
      <button type="button" className="rem-done" aria-pressed={done} onClick={() => store.set(k, !done)} aria-label={`${it.title}: ${done ? 'done today, tap to undo' : 'mark done today'}`}>
        <span className="c" aria-hidden="true">✓</span>
        <span className="t" aria-hidden="true">{done ? 'Done today' : 'Mark done'}</span>
      </button>
    </div>
  )
}

export function RemindersCard() {
  const today = useToday()
  return (
    <section className="card" aria-labelledby="rem-h">
      <div className="card-h">
        <h2 id="rem-h">Reminders</h2>
        <span className="small">Tick them off for {dateEn(today)}</span>
      </div>
      <div className="rems">{REMINDERS.map((it) => <ReminderRow key={it.id} it={it} date={today} />)}</div>
    </section>
  )
}

/* Pop-up each time the app is opened, and again when you come back after a while away. */
const AWAY_MS = 15 * 60000
let lastSeen = Date.now()
export function ReminderPopup() {
  const today = useToday()
  useReader()
  const pending = REMINDERS.filter((x) => x.nag && !store.get<boolean>(K.rem(today, x.id)))
  const [open, setOpen] = useState(pending.length > 0)
  useEffect(() => {
    const vis = () => {
      if (document.visibilityState === 'hidden') lastSeen = Date.now()
      else if (Date.now() - lastSeen > AWAY_MS) setOpen(true)
    }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [])
  if (!open || pending.length === 0) return null
  const follow = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    goFromSheet(e.currentTarget.getAttribute('href')!)
    setOpen(false)
  }
  return (
    <Sheet title="Before you start" onClose={() => setOpen(false)}>
      <p className="small">Two things to fit in whenever you get time today. Tick one off and it stops reminding you until tomorrow.</p>
      <div className="rems">{pending.map((it) => <ReminderRow key={it.id} it={it} date={today} onOpen={follow} />)}</div>
      <p className="rem-note"><b>And revise every day.</b> Yesterday's formulas from memory, first thing.</p>
      <div><button className="btn primary" onClick={() => setOpen(false)}>Got it</button></div>
    </Sheet>
  )
}

/* ---------- accountability ---------- */
const ANSWERS: { v: GoalAnswer; label: string; mark: string }[] = [
  { v: 'yes', label: 'Yes', mark: '✓' },
  { v: 'close', label: 'Close', mark: '◐' },
  { v: 'no', label: 'No', mark: '✕' },
]
const WD_SHORT = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি']

export function Accountability({ sched }: { sched: Schedule }) {
  const today = useToday()
  const r = useReader()
  const [sel, setSel] = useState(today)
  useEffect(() => setSel(today), [today])
  const answer = (d: string) => r.get<GoalAnswer>(K.goal(d))
  const cur = answer(sel)
  const set = (v: GoalAnswer) => store.set(K.goal(sel), cur === v ? null : v)

  // 4 days up to today, then the next 3
  const strip = Array.from({ length: 7 }, (_, i) => addDays(today, i - 3))
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
  const count = (v: GoalAnswer) => last7.filter((d) => answer(d) === v).length
  let streak = 0
  for (let d = answer(today) === 'yes' ? today : addDays(today, -1); answer(d) === 'yes'; d = addDays(d, -1)) streak++

  return (
    <section className="card acct" aria-labelledby="acct-h">
      <div className="card-h">
        <h2 id="acct-h">Accountability</h2>
        <span className="small">{streak > 0 ? `${streak}-day streak` : 'Answer honestly, every day'}</span>
      </div>
      <p className="acct-q">{sel === today ? "Have you completed today's goal?" : `Did you complete your goal on ${dateEn(sel)}?`}</p>
      <div className="acct-btns" role="group" aria-label="Goal completed?">
        {ANSWERS.map((a) => (
          <button key={a.v} type="button" className={`acct-b ${a.v}`} aria-pressed={cur === a.v} onClick={() => set(a.v)}>
            <span aria-hidden="true">{a.mark}</span> {a.label}
          </button>
        ))}
      </div>
      <div className="acct-strip" role="list" aria-label="Last four days and the next three">
        {strip.map((d) => {
          const future = d > today
          const a = answer(d)
          const row = sched.byEff.get(d)
          const p = row && !future ? dayProgress(r, row, sched.rows) : null
          return (
            <button
              key={d}
              type="button"
              role="listitem"
              className={`acct-d ${a ?? ''} ${d === today ? 'today' : ''} ${d === sel ? 'sel' : ''} ${future ? 'future' : ''}`}
              disabled={future}
              onClick={() => setSel(d)}
              aria-label={`${dateEn(d)}${d === today ? ' (today)' : ''}: ${future ? 'upcoming' : a ?? 'not answered'}${p ? `, ${Math.round(p.ratio * 100)}% of planned tasks` : ''}`}
            >
              <span className="wd">{d === today ? 'আজ' : WD_SHORT[weekdayIndex(d)]}</span>
              <span className="dn">{bn(Number(d.slice(8)))}</span>
              <span className="mk" aria-hidden="true">{future ? '' : a ? ANSWERS.find((x) => x.v === a)!.mark : '·'}</span>
              <span className="pb" aria-hidden="true">{p && <i style={{ width: `${p.ratio * 100}%` }} />}</span>
            </button>
          )
        })}
      </div>
      <div className="acct-sum">
        <span>Last 7 days:</span>
        <span className="yes">{count('yes')} yes</span>
        <span className="close">{count('close')} close</span>
        <span className="no">{count('no')} no</span>
        {7 - count('yes') - count('close') - count('no') > 0 && <span className="muted">{7 - count('yes') - count('close') - count('no')} unanswered</span>}
      </div>
      <p className="small">Tap an earlier day to answer for it. The thin bar under each day is how much of that day's plan you ticked.</p>
    </section>
  )
}
