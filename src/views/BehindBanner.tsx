import { useState } from 'react'
import { dateBn } from '../data/bn'
import { studyPlan } from '../data/load'
import { behindInfo } from '../logic/behind'
import { K } from '../logic/keys'
import { previewShift } from '../logic/shift'
import type { Schedule } from '../logic/schedule'
import { Sheet, toast } from '../components/ui'
import { store } from '../store/store'
import { useReader } from '../hooks'

export function ShiftSheet({ sched, today, onClose }: { sched: Schedule; today: string; onClose: () => void }) {
  const r = useReader()
  const p = previewShift(sched.rows, today, r)
  const apply = () => {
    store.set(K.shift, p.shifts)
    toast('Schedule shifted. You can reset to the original any time from the Plan page.')
    onClose()
  }
  return (
    <Sheet title="Shift remaining days · preview" onClose={onClose}>
      <p>Nothing changes until you press <b>Apply shift</b>. Your original schedule stays available.</p>
      {p.debt === 0 ? (
        <div className="empty">You have no unfinished days before today, so there is nothing to shift.</div>
      ) : (
        <>
          <div className="banner info">
            <span><b>{p.debt}</b> unfinished study day{p.debt === 1 ? '' : 's'} move to start today. Later days slide down.</span>
            <span>Catch-up days absorb the slip first: {p.consumedBuffers.length ? p.consumedBuffers.map((b) => dateBn(b.date)).join(', ') + ' used up' : 'none left to absorb it'}.</span>
          </div>
          {p.unscheduled.length > 0 && (
            <div className="banner bad">
              <b>{p.unscheduled.length} day{p.unscheduled.length === 1 ? '' : 's'} will not fit before 15 December</b>
              <span>15–18 December are protected, so these are parked as "Unscheduled" rather than dropped. Decide what to cut using the order below:</span>
              <ol>{studyPlan.meta.ifBehind.slice(1, 3).map((m, i) => <li key={i}>{m}</li>)}</ol>
              <ul>{p.unscheduled.map((row) => <li key={row.date}>{row.items.map((i) => i.ch).join(' + ')} <span className="muted">(was {dateBn(row.date)})</span></li>)}</ul>
            </div>
          )}
          <div className="tbl">
            <table className="plain">
              <thead><tr><th>Day</th><th>From</th><th>To</th></tr></thead>
              <tbody>
                {p.moves.map((m) => (
                  <tr key={m.row.date}>
                    <td>{m.row.items.map((i) => i.ch).join(' + ')}{m.row.isBuffer && <span className="badge buf"> ধরা-পড়ার দিন</span>}</td>
                    <td>{m.from ? dateBn(m.from) : '—'}</td>
                    <td>{m.to === 'unscheduled' ? <span className="tag zero">Unscheduled</span> : dateBn(m.to)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="row-flex">
        <button className="btn primary" disabled={p.debt === 0} onClick={apply}>Apply shift</button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  )
}

/** Shown when more than 2 days behind. Never reschedules by itself. */
export function BehindBanner({ sched, today }: { sched: Schedule; today: string }) {
  const r = useReader()
  const [open, setOpen] = useState(false)
  const info = behindInfo(today, sched.rows, r)
  if (!info.showBanner) return null
  return (
    <div className="banner warn" role="alert">
      <span><b>You are {info.lag} days behind the plan.</b> Nothing has been rescheduled. Finish the chapter you're on and use the catch-up days first.</span>
      <details>
        <summary style={{ cursor: 'pointer', minHeight: 32 }}>If it isn't recoverable, cut in this order only</summary>
        <ol style={{ marginTop: 6 }}>{studyPlan.meta.ifBehind.map((m, i) => <li key={i}>{m}</li>)}</ol>
      </details>
      <div><button className="btn sm" onClick={() => setOpen(true)}>Preview "shift remaining days"</button></div>
      {open && <ShiftSheet sched={sched} today={today} onClose={() => setOpen(false)} />}
    </div>
  )
}
