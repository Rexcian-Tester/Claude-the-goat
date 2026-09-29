import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { SHORT_SYLLABUS_YEARS, YEARS } from '../data/catalog'
import { extras } from '../data/load'
import { bn, SUBJ_BN, TIER_BN, yearBn, qnBn } from '../data/bn'
import type { Chapter, Question, Tier } from '../data/types'
import { K, Q_STATUSES, type QStatus } from '../logic/keys'
import { store, useField } from '../store/store'

export const TierPill = ({ tier }: { tier: Tier }) => <span className={`pill ${tier}`}>{TIER_BN[tier]}</span>
export const SubjectChip = ({ s }: { s: string }) => <span className={`chip ${s}`}>{SUBJ_BN[s]}</span>
export const FullTag = () => <span className="tag full">পূর্ণ সিলেবাস</span>
export const Bar = ({ pct, warn }: { pct: number; warn?: boolean }) => (
  <span className={`bar ${warn ? 'warn' : ''}`} role="presentation">
    <i style={{ width: `${Math.max(0, Math.min(100, pct * 100))}%` }} />
  </span>
)
export const pctBn = (x: number) => bn(Math.round(x * 100)) + '%'

const MISSING: Record<string, string[]> = Object.fromEntries(
  Object.entries(extras.missingPages).map(([k, v]) => [k, v.map((s) => s.slice(0, 7))]),
)
export function YearDots({ chapter }: { chapter: Chapter }) {
  return (
    <span className="dots" role="img" aria-label={`${bn(chapter.years.length)}টি প্রশ্নপত্রে এসেছে`}>
      {YEARS.map((y) => {
        const on = chapter.years.includes(y)
        const na = (MISSING[chapter.subject] ?? []).includes(y)
        const ns = chapter.full && SHORT_SYLLABUS_YEARS.includes(y)
        return <span key={y} className={`${on ? 'on' : ''} ${na ? 'na' : ''} ${ns ? 'ns' : ''}`} title={`${bn(y)}${na ? ' · পৃষ্ঠা নেই' : ''}${ns ? ' · সংক্ষিপ্ত সিলেবাসের বাইরে' : ''}`} />
      })}
    </span>
  )
}

export function Check({ checked, onChange, children, label }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; label?: string }) {
  return (
    <label className={`check ${checked ? 'done' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span>{children}</span>
    </label>
  )
}
/** A checkbox bound directly to a progress field. */
export function FieldCheck({ k, children }: { k: string; children: ReactNode }) {
  const v = useField<boolean>(k, false)
  return <Check checked={v} onChange={(x) => store.set(k, x)}>{children}</Check>
}

export function Rating({ value, onChange, max = 5, label }: { value?: number; onChange: (n: number | undefined) => void; max?: number; label: string }) {
  return (
    <div className="rating" role="group" aria-label={label}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} type="button" aria-pressed={value === n} onClick={() => onChange(value === n ? undefined : n)}>
          {n}
        </button>
      ))}
    </div>
  )
}

const Q_LABEL: Record<QStatus, string> = { unsolved: 'Unsolved', solved: 'Solved', wrong: 'Wrong', revisit: 'Revisit' }
export function QStatusButtons({ k }: { k: string }) {
  const v = useField<QStatus>(k, 'unsolved')
  return (
    <span className="qs" role="group" aria-label="Question status">
      {Q_STATUSES.map((s) => (
        <button key={s} type="button" className={s} aria-pressed={v === s} onClick={() => store.set(k, s)}>
          {Q_LABEL[s]}
        </button>
      ))}
    </span>
  )
}

export function QuestionRow({ q, focus }: { q: Question; focus?: string | null }) {
  const noteKey = K.qNote(q.id)
  const note = useField<string>(noteKey, '')
  const [open, setOpen] = useState(false)
  return (
    <div className={`q-row ${q.m ? 'm' : ''} ${focus === q.id ? 'hl' : ''}`} id={`f-${q.id}`}>
      <div className="q-line">
        <span className="ref">{yearBn(q.y)} · প্রশ্ন {qnBn(q.q)}</span>
        {q.m && <span className="tag mt">মডেল টেস্ট</span>}
      </div>
      <div className="bn" style={{ fontFamily: 'var(--body)' }}>{q.t}</div>
      <div className="row-flex">
        <QStatusButtons k={K.qStatus(q.id)} />
        <button type="button" className="btn sm" onClick={() => setOpen(!open)} aria-expanded={open}>
          {note ? 'Note ✎' : 'Add note'}
        </button>
      </div>
      {(open || note) && (
        <textarea className="input" rows={2} placeholder="Note (e.g. where you got stuck)" value={note} onChange={(e) => store.set(noteKey, e.target.value)} aria-label="Question note" />
      )}
    </div>
  )
}

/* ---------- sheet (modal) ---------- */
export function Sheet({ title, onClose, children, bare, label }: { title: ReactNode; onClose: () => void; children: ReactNode; bare?: boolean; label?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const body = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,textarea,select,summary,[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null)
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) (e.preventDefault(), last.focus())
        else if (!e.shiftKey && document.activeElement === last) (e.preventDefault(), first.focus())
      }
    }
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('keydown', key)
      document.body.style.overflow = body
      prev?.focus?.()
    }
  }, [onClose])
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label ?? (typeof title === 'string' ? title : undefined)} ref={ref} tabIndex={-1}>
        <div className="sheet-h">
          {bare ? <div className="grow row-flex" style={{ flexWrap: 'nowrap' }}>{title}</div> : <h2 className="grow" style={{ fontSize: 18 }}>{title}</h2>}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sheet-b">{children}</div>
      </div>
    </div>
  )
}

/* ---------- toast ---------- */
let toastMsg = ''
const tl = new Set<() => void>()
let tt: ReturnType<typeof setTimeout>
export function toast(msg: string, ms = 3500) {
  toastMsg = msg
  tl.forEach((l) => l())
  clearTimeout(tt)
  tt = setTimeout(() => {
    toastMsg = ''
    tl.forEach((l) => l())
  }, ms)
}
export function Toast() {
  const m = useSyncExternalStore((fn) => (tl.add(fn), () => tl.delete(fn)), () => toastMsg)
  return m ? <div className="toast" role="status">{m}</div> : null
}

export function Panel({ title, children, open }: { title: ReactNode; children: ReactNode; open?: boolean }) {
  return (
    <details className="panel" open={open}>
      <summary>{title}</summary>
      <div className="panel-b">{children}</div>
    </details>
  )
}
