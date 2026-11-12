import { useState } from 'react'
import { dateEn } from '../data/bn'
import { diffDays, weekdayIndex } from '../data/dhaka'
import { canUndo, deleteRow, hubHref, isEdited, newId, resetToFile, scheduleNote, scheduleRows, undoLast, upsertRow } from '../data/examSchedule'
import type { ExamRow } from '../data/types'
import { useToday } from '../hooks'
import { Sheet, toast } from '../components/ui'
import { useStoreVersion } from '../store/store'

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const dayLabel = (d: string) => `${WD[weekdayIndex(d)]} ${dateEn(d)}`
const monthOf = (d: string) => `${MONTHS[+d.slice(5, 7) - 1]} ${d.slice(0, 4)}`

/** The Exam tab: a button to the Model Test Hub (its app if installed), then the exam routine. The routine is
 *  locked; "Edit schedule" asks first, then a row opens a form with Save / Delete, and Undo takes back the last change. */
export function ExamsView() {
  useStoreVersion()
  const today = useToday()
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState<ExamRow | null>(null)
  const rows = scheduleRows()
  const todays = rows.filter((r) => r.date === today)
  const next = rows.find((r) => r.date > today)
  const unlock = () => {
    if (confirm('Unlock the exam routine for editing?\n\nChanges save and sync to your other devices. You can Undo the last change.')) setEditing(true)
  }
  let month = ''
  return (
    <div className="view exams-v">
      <div className="page-h">
        <div className="eyebrow">Exam</div>
        <h1>Exam section</h1>
      </div>

      <section className="card hub-card" aria-label="Model Test Hub">
        <a className="btn primary big hub-btn" href={hubHref()} target="_blank" rel="noopener noreferrer">
          <span aria-hidden="true">📝</span> Open Model Test Hub
        </a>
        <p className="small">Opens the Model Test Hub app if it is installed on this phone, otherwise the website.</p>
        {todays.length > 0 ? (
          <div className="ex-today">
            <b>Today</b>
            {todays.map((r) => <span key={r.id}>{r.no && r.no !== '★' ? `${r.no} · ` : ''}{r.title}{r.sub.includes('·') ? ` (${r.sub.split('·').pop()!.trim()})` : ''}</span>)}
          </div>
        ) : next ? (
          <div className="ex-today"><b>Next exam</b><span>{dayLabel(next.date)} ({diffDays(today, next.date) === 1 ? 'tomorrow' : `in ${diffDays(today, next.date)} days`}): {next.title}</span></div>
        ) : null}
      </section>

      <section className="card" aria-label="Exam routine">
        <div className="ex-head">
          <h2>Exam routine</h2>
          {editing ? (
            <button type="button" className="btn sm primary" onClick={() => setEditing(false)}>🔒 Done</button>
          ) : (
            <button type="button" className="btn sm" onClick={unlock}>✏️ Edit schedule</button>
          )}
        </div>
        <p className="small">{rows.filter((r) => !r.real).length} exams · {scheduleNote}{isEdited() ? ' · edited by you' : ''}</p>
        {editing && (
          <div className="ex-tools">
            <p className="small"><b>Editing is on.</b> Tap an exam to change or delete it.</p>
            <div className="row-flex ex-btns">
              <button type="button" className="btn sm" onClick={() => setOpen({ id: newId(), date: today, no: '', title: '', sub: '', len: '' })}>+ Add exam</button>
              {canUndo() && <button type="button" className="btn sm" onClick={() => { undoLast(); toast('Last change undone.') }}>↶ Undo last change</button>}
              {isEdited() && (
                <button type="button" className="btn sm" onClick={() => confirm('Go back to the original schedule? Your edits are replaced (Undo brings them back).') && (resetToFile(), toast('Original schedule restored.'))}>Reset to original</button>
              )}
            </div>
          </div>
        )}
        <ol className="ex-list">
          {rows.map((r) => {
            const head = monthOf(r.date) !== month ? (month = monthOf(r.date)) : null
            const cls = `ex-row ${r.real ? 'real' : ''} ${r.date < today ? 'past' : ''} ${r.date === today ? 'today' : ''} ${editing ? 'editable' : ''}`
            const body = (
              <>
                <span className="ex-date">{dayLabel(r.date)}</span>
                <span className="ex-no">{r.no}</span>
                <span className="ex-main">
                  <span className="ex-title">{r.title}</span>
                  <span className="ex-sub small">{r.sub}</span>
                </span>
                <span className="ex-len small">
                  {r.len}
                  {(r.status || r.real) && <span className={`tag ex-status ${r.real && !r.status ? 'real' : ''}`}>{r.status || 'REAL EXAM'}</span>}
                </span>
              </>
            )
            return (
              <li key={r.id} className="ex-li">
                {head && <h3 className="ex-month">{head}</h3>}
                {editing ? <button type="button" className={cls} onClick={() => setOpen(r)} aria-label={`Edit ${r.title} on ${dayLabel(r.date)}`}>{body}</button> : <div className={cls}>{body}</div>}
              </li>
            )
          })}
        </ol>
      </section>
      {open && <RowEditor row={open} isNew={!rows.some((r) => r.id === open.id)} onClose={() => setOpen(null)} />}
    </div>
  )
}

function RowEditor({ row, isNew, onClose }: { row: ExamRow; isNew: boolean; onClose: () => void }) {
  const [r, setR] = useState<ExamRow>(row)
  const set = (k: keyof ExamRow) => (e: { target: { value: string } }) => setR({ ...r, [k]: e.target.value })
  const ok = /^\d{4}-\d{2}-\d{2}$/.test(r.date) && r.title.trim() !== ''
  const save = () => {
    const out: ExamRow = { ...r, title: r.title.trim(), status: r.status?.trim() || undefined }
    if (!out.status) delete out.status
    if (!out.real) delete out.real
    upsertRow(out)
    toast(isNew ? 'Exam added.' : 'Saved.')
    onClose()
  }
  return (
    <Sheet title={isNew ? 'Add exam' : 'Edit exam'} onClose={onClose}>
      <div className="ex-form">
        <div className="field"><label htmlFor="exd">Date</label><input id="exd" className="input" type="date" value={r.date} onChange={set('date')} /></div>
        <div className="field"><label htmlFor="exn">Number</label><input id="exn" className="input" value={r.no} onChange={set('no')} placeholder="12, E3, PF1, SF, FM…" /></div>
        <div className="field wide"><label htmlFor="ext">Exam</label><input id="ext" className="input" value={r.title} onChange={set('title')} placeholder="জৈব রসায়ন · দিন ১" /></div>
        <div className="field wide"><label htmlFor="exs">Subject / type</label><input id="exs" className="input" value={r.sub} onChange={set('sub')} placeholder="রসায়ন ২ · Written + MCQ" /></div>
        <div className="field"><label htmlFor="exl">Length</label><input id="exl" className="input" value={r.len} onChange={set('len')} placeholder="30 min · 52 marks" /></div>
        <div className="field">
          <label htmlFor="exst">Status</label>
          <input id="exst" className="input" list="ex-status-list" value={r.status ?? ''} onChange={set('status')} placeholder="Done, Skipped, 41/52…" />
          <datalist id="ex-status-list"><option value="Done" /><option value="Skipped" /><option value="Moved" /></datalist>
        </div>
        <label className="row-flex ex-real"><input type="checkbox" checked={!!r.real} onChange={(e) => setR({ ...r, real: e.target.checked })} /> Real admission exam</label>
      </div>
      <div className="row-flex ex-btns">
        <button type="button" className="btn primary" disabled={!ok} onClick={save}>{isNew ? 'Add' : 'Save'}</button>
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        {!isNew && (
          <button type="button" className="btn danger" onClick={() => confirm(`Delete "${row.title}" (${dayLabel(row.date)})?`) && (deleteRow(row.id), toast('Exam deleted. Undo brings it back.'), onClose())}>Delete</button>
        )}
      </div>
    </Sheet>
  )
}
