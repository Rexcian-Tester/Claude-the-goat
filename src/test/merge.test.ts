import { describe, expect, it } from 'vitest'
import { beats, Clock, emptyDoc, mergeDocs, parseDoc, type Doc } from '../sync/merge'

const f = (v: unknown, t: number, d = 'A', c = 0) => ({ v, t, c, d })
const doc = (fields: Doc['fields']): Doc => ({ v: 1, fields })

describe('sync merge', () => {
  it('per-field last-writer-wins: phone and Mac edits to different fields both survive', () => {
    const phone = doc({ 'task:2026-10-01:0:0': f(true, 100, 'phone') })
    const mac = doc({ 'task:2026-10-01:0:1': f(true, 200, 'mac') })
    const a = mergeDocs(phone, mac).doc
    const b = mergeDocs(mac, phone).doc
    expect(a).toEqual(b)
    expect(Object.keys(a.fields).sort()).toEqual(['task:2026-10-01:0:0', 'task:2026-10-01:0:1'])
  })

  it('same field: newest timestamp wins, and unticking beats an older tick', () => {
    const l = doc({ k: f(true, 100, 'phone') })
    const r = doc({ k: f(false, 200, 'mac') })
    expect(mergeDocs(l, r).doc.fields.k.v).toBe(false)
    expect(mergeDocs(r, l).doc.fields.k.v).toBe(false)
  })

  it('ties break on counter, then device id, deterministically', () => {
    expect(beats(f(1, 5, 'a', 2), f(1, 5, 'z', 1))).toBe(true)
    expect(beats(f(1, 5, 'z', 1), f(1, 5, 'a', 1))).toBe(true)
    expect(beats(f(1, 5, 'a', 1), f(1, 5, 'a', 1))).toBe(false)
    const l = doc({ k: f('L', 5, 'a') })
    const r = doc({ k: f('R', 5, 'b') })
    expect(mergeDocs(l, r).doc).toEqual(mergeDocs(r, l).doc)
  })

  it('is idempotent, commutative and associative', () => {
    const rnd = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296
    const r = rnd(7)
    const mk = (dev: string): Doc => {
      const fields: Doc['fields'] = {}
      for (let i = 0; i < 30; i++) if (r() < 0.6) fields[`q:k${i}:status`] = f(Math.floor(r() * 4), Math.floor(r() * 50), dev, Math.floor(r() * 3))
      return doc(fields)
    }
    const [a, b, c] = [mk('a'), mk('b'), mk('c')]
    const m = (x: Doc, y: Doc) => mergeDocs(x, y).doc
    expect(m(a, a)).toEqual(a)
    expect(m(a, b)).toEqual(m(b, a))
    expect(m(m(a, b), c)).toEqual(m(a, m(b, c)))
  })

  it('reports conflicts: remote overwrote a different local value', () => {
    const res = mergeDocs(doc({ k: f('mine', 100, 'phone') }), doc({ k: f('theirs', 200, 'mac'), n: f(1, 1, 'mac') }))
    expect(res.overwrittenLocal).toEqual(['k'])
    expect(res.changedKeys.sort()).toEqual(['k', 'n'])
    // identical value with newer stamp is not a conflict
    expect(mergeDocs(doc({ k: f('x', 1) }), doc({ k: f('x', 2, 'B') })).overwrittenLocal).toEqual([])
  })

  it('hybrid clock stays monotonic and orders after observed remote stamps', () => {
    const c = new Clock('phone')
    const a = c.tick(1000)
    const b = c.tick(1000) // same ms
    const back = c.tick(900) // clock went backwards
    expect(b.c).toBe(a.c + 1)
    expect(back.t).toBe(1000)
    expect(back.c).toBeGreaterThan(b.c)
    c.observe({ t: 5000, c: 3 }) // remote from a device whose clock is ahead
    const after = c.tick(1100)
    expect(after.t).toBe(5000)
    expect(after.c).toBe(4)
  })

  it('an offline device catching up never overwrites newer remote edits', () => {
    const server = doc({ a: f(true, 500, 'mac'), b: f('note', 300, 'mac') })
    const offlinePhone = doc({ a: f(false, 400, 'phone'), c: f(3, 450, 'phone') })
    const merged = mergeDocs(server, offlinePhone).doc
    expect(merged.fields.a.v).toBe(true)
    expect(merged.fields.c.v).toBe(3)
    expect(merged.fields.b.v).toBe('note')
  })

  it('parseDoc rejects malformed or hostile documents', () => {
    expect(parseDoc(emptyDoc())).not.toBeNull()
    expect(parseDoc(null)).toBeNull()
    expect(parseDoc({ v: 2, fields: {} })).toBeNull()
    expect(parseDoc({ v: 1, fields: { '__proto__:x': f(1, 1) } })).toBeNull()
    expect(parseDoc({ v: 1, fields: { 'evil:x': f(1, 1) } })).toBeNull()
    expect(parseDoc({ v: 1, fields: { 'q:a:status': { v: 1, t: 'x', c: 0, d: 'a' } } })).toBeNull()
    expect(parseDoc({ v: 1, fields: { 'q:a:status': f(1, 1) } })).not.toBeNull()
  })
})
