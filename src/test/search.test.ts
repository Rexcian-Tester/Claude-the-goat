import { describe, expect, it } from 'vitest'
import { ALIASES } from '../search/aliases'
import { ensureIndex, search } from '../search'
import { bnKey, latKey } from '../search/romanize'
import { norm } from '../search/normalize'

const top = (q: string, n = 3) => search(q).slice(0, n).map((r) => r.chapter.n)

describe('search normalisation & phonetics', () => {
  it('normalises digits, sub/superscripts and joiners', () => {
    expect(norm('H₂SO₄  ৩x³')).toBe('h2so4 3x3')
    expect(norm('ক্‍ষ')).toBe(norm('ক্ষ'))
  })
  it('Banglish and Bangla reduce to the same skeleton', () => {
    expect(latKey('gotibidda').cons).toBe(bnKey('গতিবিদ্যা').cons)
    expect(latKey('cannizzaro').cons).toBe(bnKey('ক্যানিজারো').cons)
    expect(latKey('lami').cons).toBe(bnKey('লামি').cons)
    expect(latKey('mantra').cons).toBe(bnKey('মন্ত্র').cons)
  })
  it('every alias target exists', () => {
    expect(() => ensureIndex()).not.toThrow()
    expect(ALIASES.length).toBeGreaterThan(40)
  })
})

describe('search: the required queries', () => {
  it('"dynamics" -> গতিবিদ্যা first', () => expect(top('dynamics', 1)).toEqual(['গতিবিদ্যা']))
  it('"গতিবিদ্যা" -> গতিবিদ্যা before তাপগতিবিদ্যা', () => {
    const r = top('গতিবিদ্যা', 5)
    expect(r[0]).toBe('গতিবিদ্যা')
    expect(r.indexOf('গতিবিদ্যা')).toBeLessThan(r.indexOf('তাপগতিবিদ্যা') === -1 ? 99 : r.indexOf('তাপগতিবিদ্যা'))
  })
  it('"gotibidda" (Banglish) -> গতিবিদ্যা first', () => expect(top('gotibidda', 1)).toEqual(['গতিবিদ্যা']))
  it('"gotib" (partial Banglish) finds it', () => expect(top('gotib', 5)).toContain('গতিবিদ্যা'))
  it('"kinemat" (partial English) -> গতিবিদ্যা', () => expect(top('kinemat', 1)).toEqual(['গতিবিদ্যা']))
  it('"lami" -> a chapter containing লামির উপপাদ্য, স্থিতিবিদ্যা first', () => {
    const r = search('lami')
    expect(r[0].chapter.n).toBe('স্থিতিবিদ্যা')
    expect(r[0].hits.some((h) => h.text.includes('লামি'))).toBe(true)
  })
  it('"ক্যানিজারো" and "cannizzaro" both find the reaction', () => {
    for (const q of ['ক্যানিজারো', 'cannizzaro']) {
      const r = search(q)
      expect(r.length).toBeGreaterThan(0)
      expect(r[0].chapter.subject).toBe('Chem')
      expect(r[0].hits.some((h) => h.text.includes('ক্যানিজারো'))).toBe(true)
    }
  })
  it('synonyms from the brief', () => {
    expect(top('EMI', 1)).toEqual(['তড়িৎ চৌম্বক আবেশ ও পরিবর্তী প্রবাহ'])
    expect(top('stoichiometry', 1)).toEqual(['পরিমাণগত রসায়ন'])
    expect(top('organic', 1)).toEqual(['জৈব রসায়ন'])
    expect(top('kinematics', 1)).toEqual(['গতিবিদ্যা'])
  })
  it('a typo still finds the chapter', () => expect(top('dynamcs', 3)).toContain('গতিবিদ্যা'))
  it('English chapter name', () => expect(top('electromagnetic induction', 1)).toEqual(['তড়িৎ চৌম্বক আবেশ ও পরিবর্তী প্রবাহ']))
  it('nonsense returns nothing', () => expect(search('qqzzxx')).toEqual([]))
  it('shared name: "vector" finds both the Physics and Math chapters', () => {
    const subs = search('vector').slice(0, 3).map((r) => r.chapter.subject)
    expect(subs).toContain('Phy')
    expect(subs).toContain('Math')
  })
})
