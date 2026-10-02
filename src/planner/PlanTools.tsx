import { useEffect, useState } from 'react'
import { dateBn, dateEn, WD_BN } from '../data/bn'
import { addDays, weekdayIndex } from '../data/dhaka'
import { itemByKey, PLAN_LAST, PLAN_START, type PlanItem } from '../data/plan'
import { duesList, topicOn, type Due } from '../logic/dues'
import { markKeyFor, topicMarkKey } from '../logic/dayStatus'
import { evenSplit, movePart, partsOf, resetTopic, splitPart, undoTarget, versionBefore, type PlanEdits } from '../logic/planEdits'
import type { Row, Schedule } from '../logic/schedule'
import { go, href } from '../router'
import { store, useStoreVersion } from '../store/store'
import { syncNow } from '../store/syncClient'
import { useReader } from '../hooks'
import { Sheet, SubjectChip, toast } from '../components/ui'
import { commitEdits, currentEdits, planHistory, resetPlan, restoreVersion, undoLast, useCanEdit, versionTime } from './actions'

export type PlanTab = 'plan' | 'dues' | 'edit'
const TABS: [PlanTab, string][] = [['plan', 'Plan'], ['dues', 'Dues'], ['edit', 'Edit planner']]

export function PlanTabs({ tab }: { tab: PlanTab }) {
  const i = TABS.findIndex(([t]) => t === tab)
  return (
    <div className="seg slide plan-tabs" role="tablist" aria-label="Plan views" style={{ ['--i' as string]: i, ['--n' as string]: TABS.length }}>
      {TABS.map(([t, label]) => (
        <button key={t} type="button" role="tab" aria-selected={t === tab} aria-pressed={t === tab} onClick={() => go(t === 'plan' ? href.plan() : href.planTab(t), true)}>{label}</button>
      ))}
    </div>
  )
}

/* ---------- small pieces ---------- */
const srcOf = (it: PlanItem) => it.src ?? it.key
const pidOf = (it: PlanItem) => it.pid ?? '0'
const original = (it: PlanItem) => itemByKey.get(srcOf(it))!
const dayLabel = (iso: string) => `${dateBn(iso)} · ${WD_BN[weekdayIndex(iso)]}বার`

export function PartTag({ item }: { item: PlanItem }) {
  return item.parts ? <span className="tag part-tag">Part {item.partNo}/{item.parts}</span> : null
}
export function EditNote({ item }: { item: PlanItem }) {
  return item.editNote ? <div className="edit-note"><span aria-hidden="true">📝</span> {item.editNote}</div> : null
}

/** "Day X already has: …" before adding a topic to a day that has plans */
function ConfirmDays({ days, onYes, onNo }: { days: { date: string; items: PlanItem[] }[]; onYes: () => void; onNo: () => void }) {
  return (
    <div className="dlg-scrim" role="presentation">
      <div className="dlg pe-dlg" role="alertdialog" aria-modal="true" aria-label="This day already has plans">
        <div className="dlg-ic" aria-hidden="true">📌</div>
        <p className="dlg-t">{days.length === 1 ? 'This day already has plans' : 'These days already have plans'}</p>
        {days.map((d) => (
          <div key={d.date} className="pe-has">
            <b>{dayLabel(d.date)}</b>
            {d.items.map((it) => (
              <span key={it.key} className="pe-has-r"><SubjectChip s={it.s} /> {it.ch}{it.parts ? ` (Part ${it.partNo}/${it.parts})` : ''}</span>
            ))}
          </div>
        ))}
        <button type="button" className="fc-done" autoFocus onClick={onYes}>Yes, add it {days.length === 1 ? 'to this day' : 'to these days'}</button>
        <button type="button" className="fc-b ghost" onClick={onNo}>Pick another day</button>
      </div>
    </div>
  )
}

/* ---------- move / split one topic ---------- */
type Mode = 'move' | 'split'
interface DraftPart {
  date: string
  subs: number[]
  note: string
}

export function TopicSheet({ row, item, sched, today, mode: initial = 'move', onClose }: { row: Row; item: PlanItem; sched: Schedule; today: string; mode?: Mode; onClose: () => void }) {
  const can = useCanEdit()
  const orig = original(item)
  const src = srcOf(item)
  const pid = pidOf(item)
  const nSubs = orig.topicList.length
  const subs = item.subs ?? orig.topicList.map((_, i) => i)
  const start = row.eff && row.eff >= today ? row.eff : today
  const [mode, setMode] = useState<Mode>(initial)
  const [date, setDate] = useState(start)
  const [note, setNote] = useState(item.editNote ?? '')
  const [n, setN] = useState(2)
  const draft = (k: number): DraftPart[] =>
    evenSplit(subs, k).map((s, j) => ({ date: j === 0 ? start : addDays(start, j) <= PLAN_LAST ? addDays(start, j) : PLAN_LAST, subs: s, note: j === 0 ? item.editNote ?? '' : '' }))
  const [parts, setParts] = useState<DraftPart[]>(() => draft(2))
  const [ask, setAsk] = useState<{ days: { date: string; items: PlanItem[] }[]; apply: () => void } | null>(null)
  /** Move to an upcoming day, or send it to a past day (to record that you did it then) */
  const [when, setWhen] = useState<'up' | 'past'>('up')
  const [doneThen, setDoneThen] = useState(true)
  const yesterday = addDays(today, -1)

  const rowFor = (d: string) => sched.byEff.get(d)
  const dateError = (d: string, allowPast = true) =>
    !d ? 'Pick a day.'
    : d < PLAN_START ? `The plan starts on ${dateEn(PLAN_START)}.`
    : !allowPast && d < today ? 'Pick today or a later day.'
    : d > PLAN_LAST ? `The study plan ends on ${dateEn(PLAN_LAST)}.`
    : !rowFor(d) ? 'There is no plan day on that date.' : ''
  const moveError = when === 'past' ? (date >= today ? 'Pick a day before today.' : dateError(date)) : dateError(date, false)
  /** other topics on a day (not this part itself) */
  const others = (d: string) => (rowFor(d)?.items ?? []).filter((x) => !(srcOf(x) === src && pidOf(x) === pid))
  const edits = () => currentEdits()
  const save = (next: PlanEdits, label: string, marks: [string, unknown][] = []) => {
    if (!commitEdits(next, label)) return toast('Too many changes to save. Reset some topics first.')
    if (marks.length) store.setMany(marks)
    toast('Saved. Undo it any time from Edit planner.')
    onClose()
  }

  const doMove = () => {
    const target = rowFor(date)!
    const sameDay = target.date === row.date
    const past = when === 'past'
    const apply = () =>
      save(
        movePart(edits(), src, nSubs, pid, target.date, note),
        sameDay ? `Note on ${item.ch}` : `${past ? 'Sent' : 'Moved'} ${item.ch}${item.parts ? ` (Part ${item.partNo})` : ''} to ${dateEn(date)}`,
        past && doneThen ? [[markKeyFor(src, pid), 'done']] : [],
      )
    const has = sameDay ? [] : others(date)
    if (has.length) setAsk({ days: [{ date, items: has }], apply })
    else apply()
  }
  const missing = subs.filter((s) => !parts.some((p) => p.subs.includes(s)))
  const splitError = parts.some((p) => !p.subs.length) ? 'Every part needs at least one subtopic.' : missing.length ? `Not in any part yet: ${missing.map((s) => orig.topicList[s]).join(', ')}` : parts.map((p) => dateError(p.date)).find(Boolean) ?? ''
  const anyPast = parts.some((p) => p.date && p.date < today)
  const doSplit = () => {
    const into = parts.map((p) => ({ row: rowFor(p.date)!.date, subs: p.subs, note: p.note }))
    const apply = () => {
      const before = partsOf(edits(), src, nSubs)
      const next = splitPart(edits(), src, nSubs, pid, into)
      // parts sent to a past day can be marked Done right away (you did them then)
      const fresh = partsOf(next, src, nSubs).slice(before.findIndex((p) => p.id === pid))
      const marks: [string, unknown][] = doneThen ? parts.flatMap((p, k) => (p.date < today && fresh[k] ? [[markKeyFor(src, fresh[k].id), 'done'] as [string, unknown]] : [])) : []
      save(next, `Split ${item.ch} into ${parts.length} parts`, marks)
    }
    const days = [...new Set(parts.map((p) => p.date))].filter((d) => d !== row.eff).map((d) => ({ date: d, items: others(d) })).filter((d) => d.items.length)
    if (days.length) setAsk({ days, apply })
    else apply()
  }
  const setPart = (k: number, patch: Partial<DraftPart>) => setParts(parts.map((p, j) => (j === k ? { ...p, ...patch } : p)))
  const toggleSub = (k: number, s: number) => {
    const has = parts[k].subs.includes(s)
    setPart(k, { subs: has ? parts[k].subs.filter((x) => x !== s) : subs.filter((x) => x === s || parts[k].subs.includes(x)) })
  }
  const quick = when === 'past' ? [1, 2, 3].map((k) => addDays(today, -k)).filter((d) => d >= PLAN_START) : [0, 1, 2, 3].map((k) => addDays(start, k)).filter((d) => d <= PLAN_LAST)
  const pickWhen = (w: 'up' | 'past') => (setWhen(w), setDate(w === 'past' ? (yesterday >= PLAN_START ? yesterday : PLAN_START) : start))

  return (
    <Sheet title="Edit topic" onClose={onClose}>
      <div className="pe-head">
        <div className="top"><SubjectChip s={item.s} /> <b className="ch">{item.ch}</b> <PartTag item={item} /></div>
        <div className="small">{item.part} · now on {row.eff ? dayLabel(row.eff) : 'Unscheduled'}{item.date !== row.date ? ` · planned for ${dateBn(item.date)}` : ''}</div>
        <ul className="pe-subs">{item.topicList.map((t, j) => <li key={j}>{t}</li>)}</ul>
        <EditNote item={item} />
      </div>
      {!can.ok && <div className="banner warn"><span>🔒 {can.why}</span></div>}

      <div className="seg slide" role="group" aria-label="What to do" style={{ ['--i' as string]: mode === 'move' ? 0 : 1, ['--n' as string]: 2, alignSelf: 'center' }}>
        <button type="button" aria-pressed={mode === 'move'} onClick={() => setMode('move')}>Move / note</button>
        <button type="button" aria-pressed={mode === 'split'} onClick={() => setMode('split')}>Split</button>
      </div>

      {mode === 'move' ? (
        <div className="stack pe-pane" key="move">
          <div className="seg slide pe-when" role="group" aria-label="Upcoming or past day" style={{ ['--i' as string]: when === 'up' ? 0 : 1, ['--n' as string]: 2 }}>
            <button type="button" aria-pressed={when === 'up'} onClick={() => pickWhen('up')}>Upcoming day</button>
            <button type="button" aria-pressed={when === 'past'} disabled={today <= PLAN_START} onClick={() => pickWhen('past')}>Send to past</button>
          </div>
          {when === 'past' && <p className="small">Already did it on an earlier day? Send it there so the plan shows when you really studied it.</p>}
          <div className="field">
            <label htmlFor="pe-date">Day</label>
            <div className="pe-quick">
              {quick.map((d) => <button key={d} type="button" className="btn sm" aria-pressed={d === date} onClick={() => setDate(d)}>{d === today ? 'Today' : d === addDays(today, 1) ? 'Tomorrow' : d === yesterday ? 'Yesterday' : dateBn(d)}</button>)}
              <input id="pe-date" className="input pe-date" type="date" min={when === 'past' ? PLAN_START : today} max={when === 'past' ? yesterday : PLAN_LAST} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {date && !moveError && <span className="small">{dayLabel(date)}{others(date).length ? ` · already has ${others(date).map((x) => x.ch).join(', ')}` : ' · nothing else that day'}</span>}
            {moveError && <span className="small bad-t">{moveError}</span>}
          </div>
          {when === 'past' && (
            <label className="pe-check"><input type="checkbox" checked={doneThen} onChange={(e) => setDoneThen(e.target.checked)} /> I finished it that day (mark it Done)</label>
          )}
          <div className="field">
            <label htmlFor="pe-note">Note for future you (optional)</label>
            <textarea id="pe-note" className="input" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. only the velocity–time graph" />
          </div>
          <button type="button" className="btn primary big" disabled={!can.ok || !!moveError} onClick={doMove}>
            {rowFor(date)?.date === row.date ? 'Save note' : `${when === 'past' ? 'Send' : 'Move'} to ${date ? dateBn(date) : '…'}`}
          </button>
        </div>
      ) : (
        <div className="stack pe-pane" key="split">
          <div className="pe-n">
            <span>Split into</span>
            <button type="button" className="btn sm" aria-label="Fewer parts" disabled={n <= 2} onClick={() => (setN(n - 1), setParts(draft(n - 1)))}>−</button>
            <b>{n}</b>
            <button type="button" className="btn sm" aria-label="More parts" disabled={n >= 8} onClick={() => (setN(n + 1), setParts(draft(n + 1)))}>+</button>
            <span>parts</span>
          </div>
          <p className="small">Tap subtopics to choose what goes in each part. A subtopic can be in more than one part; use the note to say which bit (e.g. "only the velocity graph").</p>
          {parts.map((p, k) => (
            <div key={k} className="pe-part">
              <div className="pe-part-h"><b>Part {k + 1}</b>
                <input className="input pe-date" type="date" aria-label={`Part ${k + 1} day`} min={PLAN_START} max={PLAN_LAST} value={p.date} onChange={(e) => setPart(k, { date: e.target.value })} />
              </div>
              {p.date && !dateError(p.date) ? <span className="small">{dayLabel(p.date)}</span> : <span className="small bad-t">{dateError(p.date)}</span>}
              <div className="pe-chips">
                {subs.map((s) => <button key={s} type="button" className="pe-chip" aria-pressed={p.subs.includes(s)} onClick={() => toggleSub(k, s)}>{orig.topicList[s]}</button>)}
              </div>
              <input className="input" maxLength={300} value={p.note} onChange={(e) => setPart(k, { note: e.target.value })} placeholder="Note for this part (optional)" aria-label={`Part ${k + 1} note`} />
            </div>
          ))}
          <p className="small">A part can go on a past day too, for the bit you already did.</p>
          {anyPast && <label className="pe-check"><input type="checkbox" checked={doneThen} onChange={(e) => setDoneThen(e.target.checked)} /> Mark parts on past days as Done</label>}
          {splitError && <p className="small bad-t">{splitError}</p>}
          <button type="button" className="btn primary big" disabled={!can.ok || !!splitError} onClick={doSplit}>Split into {parts.length} parts</button>
        </div>
      )}

      {item.src && (
        <button type="button" className="btn danger" disabled={!can.ok} onClick={() => confirm(`Put ${item.ch} back exactly as the plan had it (all parts and notes)?`) && save(resetTopic(edits(), src), `Put ${item.ch} back to its plan day`)}>
          Put this topic back as planned
        </button>
      )}
      {ask && <ConfirmDays days={ask.days} onYes={() => (ask.apply(), setAsk(null))} onNo={() => setAsk(null)} />}
    </Sheet>
  )
}

/* ---------- Dues ---------- */
/** Due / Done for one topic on one day. Your choice wins over its ticks, and the ticks are left as they are. */
export function StatusSwitch({ row, item, rows }: { row: Row; item: PlanItem; rows: Row[] }) {
  const r = useReader()
  const d = topicOn(r, row, item, rows)
  const set = (m: 'due' | 'done') => store.set(topicMarkKey(item), m)
  return (
    <div className={`seg slide due-seg ${d.done ? 'is-done' : 'is-due'}`} role="group" aria-label={`${item.ch}: due or done`} style={{ ['--i' as string]: d.done ? 1 : 0, ['--n' as string]: 2 }}>
      <button type="button" aria-pressed={!d.done} onClick={() => d.done && set('due')}>Due</button>
      <button type="button" aria-pressed={d.done} onClick={() => !d.done && set('done')}>Done</button>
    </div>
  )
}

/** Due / Done plus Reschedule, for a topic in the Plan list or inside a day. */
export function TopicControls({ row, item, sched, today }: { row: Row; item: PlanItem; sched: Schedule; today: string }) {
  const can = useCanEdit()
  const [open, setOpen] = useState(false)
  const live = open ? sched.rows.find((x) => x.date === row.date)?.items.find((x) => x.key === item.key) : undefined
  return (
    <div className="topic-ctl">
      <StatusSwitch row={row} item={item} rows={sched.rows} />
      <button type="button" className="btn sm ghost-btn" disabled={!can.ok} title={can.ok ? 'Move, split or add a note' : can.why} onClick={() => setOpen(true)}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12h12M12 6l6 6-6 6" /><path d="M20 5v14" /></svg>
        Reschedule
      </button>
      {open && live && <TopicSheet row={row} item={live} sched={sched} today={today} onClose={() => setOpen(false)} />}
    </div>
  )
}

function DueRow({ d, can, rows, onReschedule }: { d: Due; can: boolean; rows: Row[]; onReschedule: () => void }) {
  const { row, item } = d
  return (
    <div className={`due ${d.done ? 'done' : ''}`}>
      <div className="due-main">
        <div className="top"><SubjectChip s={item.s} /> <b className="ch">{item.ch}</b> <PartTag item={item} /></div>
        <div className="small">
          {item.part} · {row.eff ? dayLabel(row.eff) : 'Unscheduled'}
          {item.src && item.date !== row.date ? ` · planned for ${dateBn(item.date)}` : ''} · {d.ticked}/{d.total}
        </div>
        <EditNote item={item} />
      </div>
      <div className="due-act">
        <StatusSwitch row={row} item={item} rows={rows} />
        {!d.done && <button type="button" className="btn sm" disabled={!can} title={can ? undefined : 'Editing needs you online and synced'} onClick={onReschedule}>Reschedule</button>}
      </div>
    </div>
  )
}

function DueGroup({ title, sub, list, can, rows, open }: { title: string; sub: string; list: Due[]; can: boolean; rows: Row[]; open: (d: Due) => void }) {
  if (!list.length) return null
  return (
    <section className="card due-g">
      <div className="card-h"><h2>{title} · {list.length}</h2><span className="small">{sub}</span></div>
      <div className="due-list">{list.map((d) => <DueRow key={d.item.key} d={d} can={can} rows={rows} onReschedule={() => open(d)} />)}</div>
    </section>
  )
}

export function DuesView({ sched, today }: { sched: Schedule; today: string }) {
  const r = useReader()
  const can = useCanEdit()
  const [sel, setSel] = useState<Due | null>(null)
  useEffect(() => void syncNow(), [])
  const d = duesList(r, sched.rows, today)
  const n = d.overdue.length + d.rescheduled.length + d.unscheduled.length
  // the sheet keeps working on a fresh copy of the topic after ticks change underneath it
  const live = sel && sched.rows.find((x) => x.date === sel.row.date)?.items.find((x) => x.key === sel.item.key)
  return (
    <div className="stack pe-view">
      <p className="small pe-intro">Every topic you haven't finished from past days, and every topic you moved or split, stays here until it's done. Mark <b>Done</b> when you've finished it; it fades in Plan and counts in Progress. Your Due / Done choice wins over the ticks.</p>
      {!can.ok && <div className="banner warn"><span>🔒 Rescheduling: {can.why}</span></div>}
      {n === 0 && <div className="empty">Nothing due. Every past topic is done. 💪</div>}
      <DueGroup title="Overdue" sub="from days that have passed" list={d.overdue} can={can.ok} rows={sched.rows} open={setSel} />
      <DueGroup title="Rescheduled" sub="moved or split, still to do" list={d.rescheduled} can={can.ok} rows={sched.rows} open={setSel} />
      <DueGroup title="Unscheduled" sub="days that no longer fit before 15 Dec" list={d.unscheduled} can={can.ok} rows={sched.rows} open={setSel} />
      {d.recentDone.length > 0 && (
        <details className="panel">
          <summary>Done in the last week · {d.recentDone.length}</summary>
          <div className="panel-b due-list">{d.recentDone.map((x) => <DueRow key={x.item.key} d={x} can={can.ok} rows={sched.rows} onReschedule={() => setSel(x)} />)}</div>
        </details>
      )}
      {sel && live && <TopicSheet row={sel.row} item={live} sched={sched} today={today} onClose={() => setSel(null)} />}
    </div>
  )
}

/* ---------- Edit planner ---------- */
function History({ can }: { can: boolean }) {
  useStoreVersion()
  const hist = planHistory()
  const nEdited = Object.keys(currentEdits()?.topics ?? {}).length
  const day = versionBefore(hist, Date.now())
  return (
    <div className="card pe-hist">
      <div className="card-h">
        <h2>Your changes</h2>
        <span className="small">{nEdited ? `${nEdited} topic${nEdited === 1 ? '' : 's'} moved or split` : 'The plan is as it was made'}</span>
      </div>
      <div className="row-flex">
        <button type="button" className="btn sm" disabled={!can || !undoTarget(hist)} onClick={() => undoLast() && toast('Last change undone.')}>Undo last change</button>
        <button type="button" className="btn sm" disabled={!can || !day} onClick={() => day && confirm(`Go back to how the plan was before ${versionTime(day.at)} (undo the last 24 hours of changes)?`) && (restoreVersion(day), toast('Back to the version from 24 hours ago.'))}>Undo the last 24 hours</button>
        <button type="button" className="btn sm danger" disabled={!can || !nEdited} onClick={() => confirm('Reset to the original plan? Every move, split and note is removed. Your ticks stay, and you can undo this from the history.') && (resetPlan(), toast('Back to the original plan.'))}>Reset to original plan</button>
      </div>
      {hist.length > 0 && (
        <details className="pe-vers">
          <summary>Version history · {hist.length}</summary>
          <ol className="plain">
            {hist.map((h) => (
              <li key={h.at}>
                <span className="grow"><b>{versionTime(h.at)}</b><span className="small">Before: {h.label}</span></span>
                <button type="button" className="btn sm" disabled={!can} onClick={() => confirm(`Go back to the plan as it was on ${versionTime(h.at)}?`) && (restoreVersion(h), toast('Version restored.'))}>Restore</button>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}

export function EditorView({ sched, today }: { sched: Schedule; today: string }) {
  const r = useReader()
  const can = useCanEdit()
  const [past, setPast] = useState(false)
  const [sel, setSel] = useState<{ row: Row; item: PlanItem } | null>(null)
  useEffect(() => void syncNow(), [])
  const rows = sched.rows.filter((x) => x.eff && (past || x.eff >= today)).sort((a, b) => a.eff!.localeCompare(b.eff!))
  const live = sel && sched.rows.find((x) => x.date === sel.row.date)?.items.find((x) => x.key === sel.item.key)
  return (
    <div className="stack pe-view">
      {!can.ok && <div className="banner warn"><span>🔒 {can.why}</span></div>}
      <History can={can.ok} />
      <div className="row-flex" style={{ justifyContent: 'space-between' }}>
        <span className="small">Tap a topic to move it, split it or add a note.</span>
        <label className="pe-past"><input type="checkbox" checked={past} onChange={(e) => setPast(e.target.checked)} /> Show earlier days</label>
      </div>
      <div className="pe-days">
        {rows.map((row) => (
          <div key={row.date} className={`pe-day ${row.eff === today ? 'is-today' : ''} ${row.eff! < today ? 'past' : ''}`}>
            <div className="pe-date">
              <b>{dateBn(row.eff!)}</b>
              <span>{WD_BN[weekdayIndex(row.eff!)]}বার · {row.eff === today ? 'Today' : `Day ${row.dayNo}`}</span>
            </div>
            <div className="pe-topics">
              {row.items.length === 0 && <span className="small muted">{row.note ? `খালি দিন · ${row.note}` : 'খালি দিন'}</span>}
              {row.items.map((item) => {
                const done = topicOn(r, row, item, sched.rows).done
                return (
                  <button key={item.key} type="button" className={`pe-topic ${done ? 'done' : ''}`} disabled={!can.ok} onClick={() => setSel({ row, item })}>
                    <span className="top"><SubjectChip s={item.s} /> <b>{item.ch}</b> <PartTag item={item} /></span>
                    <span className="small">{item.part}{item.src && item.date !== row.date ? ` · planned for ${dateBn(item.date)}` : ''}</span>
                    {item.editNote && <span className="edit-note"><span aria-hidden="true">📝</span> {item.editNote}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {sel && live && <TopicSheet row={sel.row} item={live} sched={sched} today={today} onClose={() => setSel(null)} />}
    </div>
  )
}
