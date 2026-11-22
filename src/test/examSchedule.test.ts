import { beforeAll, describe, expect, it, vi } from 'vitest'
import { canUndo, defaultRows, deleteRow, hubHref, isEdited, resetToFile, scheduleRows, undoLast, upsertRow } from '../data/examSchedule'
import { K } from '../logic/keys'
import { store } from '../store/store'

vi.mock('../store/idb', () => ({ loadAll: async () => ({ fields: {}, meta: {} }), putFields: async () => {}, putMeta: async () => {}, clearFields: async () => {} }))

describe('Exam tab schedule (exam-schedule.json)', () => {
  beforeAll(() => store.init())
  it('has the 97 Model Test Hub exams and the 5 real exams, in date order', () => {
    expect(defaultRows.filter((r) => !r.real)).toHaveLength(97)
    expect(defaultRows.filter((r) => r.real).map((r) => `${r.date} ${r.title}`)).toEqual(['2027-01-17 SUST A1', '2027-01-30 CU A Unit', '2027-02-05 MIST Unit C', '2027-02-06 MIST Unit A', '2027-02-13 RU C Unit'])
    expect(new Set(defaultRows.map((r) => r.id)).size).toBe(defaultRows.length)
    const rows = scheduleRows()
    expect(rows.map((r) => r.date)).toEqual([...rows.map((r) => r.date)].sort())
    expect(rows[0]).toMatchObject({ date: '2026-11-18', no: '3', status: 'Done' })
  })
  it('v6: #3 sat on 18 Nov (Done), #4 24 Nov, #5 and #6 25 Nov, the rest +5 days, Paper Finals every day', () => {
    const on = (d: string) => defaultRows.filter((r) => r.date === d && !r.debt).map((r) => r.no)
    expect(defaultRows.filter((r) => r.debt).map((r) => `${r.no} ${r.date}`)).toEqual(['1 2026-12-28', '2 2026-12-28'])
    expect(on('2026-11-22')).toEqual([])
    expect(on('2026-11-24')).toEqual(['4'])
    expect(on('2026-11-25')).toEqual(['5', '6'])
    expect(on('2026-11-26')).toEqual(['7'])
    expect(on('2026-12-01')).toEqual(['12', 'E1'])
    expect(on('2026-12-23')).toContain('E23')
    expect(on('2026-12-27')).toEqual(['40'])
    expect(on('2026-12-28')).toEqual(['41'])
    expect(on('2026-12-29')).toEqual([])
    expect(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03', '2027-01-04'].map((d) => on(d)[0])).toEqual(['PF1', 'PF2', 'PF3', 'PF4', 'PF5', 'PF6'])
    expect(on('2027-01-05')).toEqual([])
    expect(defaultRows.filter((r) => r.date === '2027-01-14').map((r) => r.sub)).toEqual(['Set 1 · MCQ', 'Set 2 · MCQ'])
    expect(defaultRows.filter((r) => r.no === 'FM').map((r) => `${r.date} ${r.title}`)).toEqual(['2027-01-15 SUST Final Model', '2027-01-21 MIST Final Model 1', '2027-01-23 MIST Final Model 2', '2027-01-26 CU Final Model', '2027-02-01 MIST Final Model 3'])
  })
  it('a synced copy saved under an older version shows the v6 dates, keeping your statuses', () => {
    const old = defaultRows.map((r) => { const { status: _s, ...x } = r; return { ...x, date: r.id === 'x3' ? '2026-11-17' : r.date, debt: undefined } })
    store.set(K.examSched, { rows: [...old.map((r) => (r.id === 'x4' ? { ...r, status: '30/32' } : r)), { id: 'u1', date: '2026-11-20', no: '', title: 'Mine', sub: '', len: '' }], at: 1, v: 5 })
    const rows = scheduleRows()
    expect(rows.find((r) => r.id === 'x3')).toMatchObject({ date: '2026-11-18', status: 'Done' })
    expect(rows.find((r) => r.id === 'x4')).toMatchObject({ date: '2026-11-24', status: '30/32' })
    expect(rows.find((r) => r.id === 'x1')).toMatchObject({ date: '2026-12-28', debt: true })
    expect(rows.find((r) => r.id === 'u1')!.date).toBe('2026-11-20')
    upsertRow({ ...rows.find((r) => r.id === 'x4')!, date: '2026-11-26' })
    expect(scheduleRows().find((r) => r.id === 'x4')!.date).toBe('2026-11-26')
    resetToFile()
  })
  it('edits save over the file, Undo takes back the last change, Reset goes back to the file', () => {
    expect(isEdited()).toBe(false)
    const first = scheduleRows()[0]
    upsertRow({ ...first, status: 'Done' })
    expect(isEdited()).toBe(true)
    expect(scheduleRows()[0].status).toBe('Done')
    expect(store.field(K.examSched)?.v).toBeTruthy()
    deleteRow(first.id)
    expect(scheduleRows().some((r) => r.id === first.id)).toBe(false)
    expect(canUndo()).toBe(true)
    undoLast()
    expect(scheduleRows()[0].status).toBe('Done')
    // a row moved to another date is re-sorted
    upsertRow({ ...first, date: '2027-02-20' })
    expect(scheduleRows().at(-1)!.id).toBe(first.id)
    resetToFile()
    expect(isEdited()).toBe(false)
    expect(scheduleRows()).toEqual(defaultRows)
    undoLast()
    expect(scheduleRows().at(-1)!.id).toBe(first.id)
    resetToFile()
    // junk from another device is ignored row by row
    store.set(K.examSched, { rows: [{ id: 'a', date: 'soon', title: 'x' }, { id: 'b', date: '2026-12-01', title: 'Kept' }], at: 1 })
    expect(scheduleRows().map((r) => r.title)).toEqual(['Kept'])
    resetToFile()
  })
  it('the Hub button opens the installed app on Android (falling back to the site), a normal link elsewhere', () => {
    expect(hubHref('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('https://model-test-hub.pages.dev/#home')
    expect(hubHref('Mozilla/5.0 (Linux; Android 15; Pixel 8)')).toBe('intent://model-test-hub.pages.dev/#Intent;scheme=https;S.browser_fallback_url=https%3A%2F%2Fmodel-test-hub.pages.dev%2F%23home;end')
  })
})
