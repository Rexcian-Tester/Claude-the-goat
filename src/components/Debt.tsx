import { dateEn } from '../data/bn'
import { diffDays, weekdayIndex } from '../data/dhaka'
import { artifactsForPlan } from '../data/artifacts'
import { debtItems, type DebtItem } from '../data/plan'
import { useReader } from '../hooks'
import { topicMark } from '../logic/dayStatus'
import type { Reader } from '../logic/reader'
import { store } from '../store/store'
import { ArtifactLinks } from './ArtifactLinks'
import { Check } from './ui'

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** a debt item is paid once every micro-task is ticked, or you mark the topic Done */
export const debtPaid = (r: Reader, d: DebtItem) => topicMark(r, d.item) === 'done' || d.item.tks.every((k) => r.get<boolean>(k) === true)
export const openDebts = (r: Reader) => debtItems.filter((d) => !debtPaid(r, d))

/** Debt (Plan v5): unfinished chapters on no date, each with its deadline. Not counted as days behind. */
export function DebtList({ today, id }: { today: string; id?: string }) {
  const r = useReader()
  const list = openDebts(r)
  if (!list.length) return null
  return (
    <section className="card debt" id={id} aria-label="Debt">
      <div className="card-h">
        <h2>Debt</h2>
        <span className="small">{list.length} unfinished · on no date · not counted as behind</span>
      </div>
      {list.map((d) => {
        const n = diffDays(today, d.deadline)
        const ticked = d.item.tks.filter((k) => r.get<boolean>(k) === true).length
        return (
          <div key={d.id} className={`debt-item ${n < 0 ? 'late' : ''}`}>
            <div className="debt-h">
              <b>{d.item.ch}</b> <span className="small">{d.item.part}</span>
              <span className={`tag debt-dl ${n < 0 ? 'late' : n <= 7 ? 'soon' : ''}`}>
                {n < 0 ? `Deadline passed (${WD[weekdayIndex(d.deadline)]} ${dateEn(d.deadline)})` : `By ${WD[weekdayIndex(d.deadline)]} ${dateEn(d.deadline)}${n === 0 ? ' · today' : n === 1 ? ' · tomorrow' : ` · ${n} days`}`}
              </span>
            </div>
            <p className="small debt-why">{d.why} · {ticked}/{d.item.tks.length} done</p>
            <div className="debt-tasks">
              {d.item.topicList.map((text, i) => (
                <Check key={d.item.tks[i]} checked={r.get<boolean>(d.item.tks[i]) === true} onChange={(v) => store.set(d.item.tks[i], v)}>{text}</Check>
              ))}
            </div>
            <ArtifactLinks rows={artifactsForPlan(d.item)} compact />
          </div>
        )
      })}
    </section>
  )
}
