import { beforeAll, describe, expect, it, vi } from 'vitest'
import { applyHub, linkRows, parseCatalog, type HubExam } from '../data/hubCatalog'
import { defaultRows, saveEdited, scheduleRows, shownRows, resetToFile, deleteRow, upsertRow } from '../data/examSchedule'
import { K } from '../logic/keys'
import { store } from '../store/store'

vi.mock('../store/idb', () => ({ loadAll: async () => ({ fields: {}, meta: {} }), putFields: async () => {}, putMeta: async () => {}, clearFields: async () => {} }))

// a pretend hub catalog shaped like the owner's: every built-in exam, by its own hub id, 2 days later
const add2 = (d: string) => new Date(Date.parse(d + 'T00:00:00Z') + 2 * 86400000).toISOString().slice(0, 10)
const kindOf = (sub: string) => (sub.endsWith('Written + MCQ') ? 'chapter' : sub.endsWith('MCQ') ? 'mcq' : sub.endsWith('Written') ? 'written' : 'chapter')
const hubFrom = (f: (r: (typeof defaultRows)[number]) => Partial<HubExam> = () => ({})): HubExam[] =>
  defaultRows.filter((r) => !r.real).map((r, i) => ({ id: `h${i}`, n: r.no, title: r.title, kind: kindOf(r.sub), date: r.debt ? '' : add2(r.date), debt: r.debt ? add2(r.date) : '', ...f(r) }))
const text = (exams: unknown) => `window.CAT=${JSON.stringify({ version: 1, exams })};`

describe('reading the Model Test Hub catalog', () => {
  it('takes off "window.CAT=" and the last ";" and reads JSON; never runs code', () => {
    const exams = hubFrom()
    expect(parseCatalog(text(exams))).toHaveLength(exams.length)
    expect(parseCatalog(`window.CAT = ${JSON.stringify({ exams })}`)).toHaveLength(exams.length)
    ;(globalThis as Record<string, unknown>).__ran = false
    expect(parseCatalog('window.CAT=(globalThis.__ran=true,{"exams":[]});')).toBeNull()
    expect((globalThis as Record<string, unknown>).__ran).toBe(false)
  })
  it('a broken or empty catalog is refused', () => {
    expect(parseCatalog('')).toBeNull()
    expect(parseCatalog('<html>Not found</html>')).toBeNull()
    expect(parseCatalog('window.CAT={"exams":[]};')).toBeNull()
    expect(parseCatalog(text([{ id: 'a', title: 'x', date: 'soon' }]))).toBeNull()
    expect(parseCatalog(text([{ id: 'a', title: 'x', date: '2026-12-01' }, { id: 'a', title: 'y', date: '2026-12-02' }]))).toBeNull()
    expect(parseCatalog(text(hubFrom(() => ({ date: '', debt: '' }))))).toBeNull()
  })
})

describe('Exam tab dates follow the hub', () => {
  beforeAll(() => store.init())
  it('links every exam by hub id (same number and title told apart by Written / MCQ) and takes its date', () => {
    const hub = hubFrom()
    const links = linkRows(defaultRows, hub)
    expect(Object.keys(links)).toHaveLength(defaultRows.filter((r) => !r.real).length)
    expect(new Set(Object.values(links)).size).toBe(Object.keys(links).length)
    const pf1 = defaultRows.filter((r) => r.no === 'PF1')
    expect(pf1.map((r) => hub.find((h) => h.id === links[r.id])!.kind)).toEqual(['written', 'mcq'])
    const rows = applyHub(defaultRows, hub, links)
    for (const r of rows) {
      const d = defaultRows.find((x) => x.id === r.id)!
      expect(r.date).toBe(d.real ? d.date : add2(d.date))
    }
    // real admission exams stay as they are
    expect(rows.filter((r) => r.real).map((r) => r.date)).toEqual(defaultRows.filter((r) => r.real).map((r) => r.date))
  })
  it('no date + a debt date shows as Debt; no date and no debt leaves it out; new hub exams are added', () => {
    const x5 = defaultRows.find((r) => r.no === '5')!
    const x6 = defaultRows.find((r) => r.no === '6')!
    const hub = hubFrom((r) => (r.id === x5.id ? { date: '', debt: '2026-12-31' } : r.id === x6.id ? { date: '', debt: '' } : {}))
    hub.push({ id: 'new1', n: 'FM', title: 'MIST Final Model 4', kind: 'written', date: '2027-02-03', debt: '' })
    const rows = applyHub(defaultRows, hub, linkRows(defaultRows, hub))
    expect(rows.find((r) => r.id === x5.id)).toMatchObject({ date: '2026-12-31', debt: true })
    expect(rows.some((r) => r.id === x6.id)).toBe(false)
    expect(rows.find((r) => r.id === 'hub-new1')).toMatchObject({ date: '2027-02-03', title: 'MIST Final Model 4', sub: 'Written' })
  })
  it('a known link is kept even if the hub renames the exam', () => {
    const hub = hubFrom()
    const links = linkRows(defaultRows, hub)
    const id = defaultRows.find((r) => r.no === '7')!.id
    const renamed = hub.map((h) => (h.id === links[id] ? { ...h, title: 'renamed on the hub' } : h))
    expect(linkRows(defaultRows, renamed, links)[id]).toBe(links[id])
  })
  it('keeps your statuses and exams you added; an exam you moved keeps your date', () => {
    const hub = hubFrom()
    const cat = { exams: hub, at: 1, links: {} }
    const x7 = defaultRows.find((r) => r.no === '7')!
    const x8 = defaultRows.find((r) => r.no === '8')!
    // a status change keeps following the hub
    let shown = shownRows(cat).rows
    saveEdited({ ...shown.find((r) => r.id === x7.id)!, status: '41/52' }, shown.find((r) => r.id === x7.id)!)
    expect(scheduleRows().find((r) => r.id === x7.id)).toMatchObject({ date: x7.date, status: '41/52' })
    expect(scheduleRows().find((r) => r.id === x7.id)!.mine).toBeUndefined()
    shown = shownRows(cat).rows
    expect(shown.find((r) => r.id === x7.id)).toMatchObject({ date: add2(x7.date), status: '41/52' })
    // moving a date makes it yours
    const s8 = shown.find((r) => r.id === x8.id)!
    saveEdited({ ...s8, date: '2027-01-20' }, s8)
    expect(shownRows(cat).rows.find((r) => r.id === x8.id)).toMatchObject({ date: '2027-01-20', mine: true })
    // an exam you added stays
    upsertRow({ id: 'u1', date: '2026-12-05', no: '', title: 'My extra test', sub: '', len: '' })
    expect(shownRows(cat).rows.find((r) => r.id === 'u1')!.date).toBe('2026-12-05')
    // a copy saved before this change: a built-in exam with a date that isn't the file's counts as moved by you
    store.set(K.examSched, { rows: defaultRows.map((r) => (r.id === x7.id ? { ...r, date: '2026-11-30' } : r)), at: 1, v: 6, added: ['x103'] })
    expect(shownRows(cat).rows.find((r) => r.id === x7.id)!.date).toBe('2026-11-30')
    resetToFile()
  })
  it('a hub exam you delete here is not added back', () => {
    const hub = [...hubFrom(), { id: 'new1', n: 'FM', title: 'Extra', kind: 'mcq', date: '2027-02-03', debt: '' }]
    const cat = { exams: hub, at: 1, links: {} }
    expect(shownRows(cat).rows.some((r) => r.id === 'hub-new1')).toBe(true)
    deleteRow('hub-new1', 'new1')
    expect(shownRows(cat).rows.some((r) => r.id === 'hub-new1')).toBe(false)
    resetToFile()
  })
  it('with no hub copy at all the saved schedule shows (never an empty list)', () => {
    expect(shownRows(null).rows.length).toBe(defaultRows.length)
  })
})

describe('offline or broken hub: the last good dates stay', () => {
  it('keeps the last good copy when the hub is unreachable or sends something broken', async () => {
    const mod = await import('../data/hubCatalog')
    const real = globalThis.fetch
    const n = hubFrom().length
    try {
      globalThis.fetch = (async () => new Response(text(hubFrom()))) as typeof fetch
      await mod.refreshHub()
      expect(mod.hubSnapshot().status).toBe('ok')
      expect(mod.hubSnapshot().catalog!.exams).toHaveLength(n)
      globalThis.fetch = (async () => { throw new Error('offline') }) as typeof fetch
      await mod.refreshHub()
      expect(mod.hubSnapshot().status).toBe('offline')
      expect(mod.hubSnapshot().catalog!.exams).toHaveLength(n)
      globalThis.fetch = (async () => new Response('<html>Not found</html>', { status: 200 })) as typeof fetch
      await mod.refreshHub()
      expect(mod.hubSnapshot().status).toBe('broken')
      expect(mod.hubSnapshot().catalog!.exams).toHaveLength(n)
      globalThis.fetch = (async () => new Response('gone', { status: 404 })) as typeof fetch
      await mod.refreshHub()
      expect(mod.hubSnapshot().status).toBe('broken')
      expect(shownRows(mod.hubSnapshot().catalog).rows.length).toBeGreaterThan(90)
    } finally {
      globalThis.fetch = real
    }
  })
})
