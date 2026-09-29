const BD = '০১২৩৪৫৬৭৮৯'
/** Latin digits -> Bangla digits */
export const bn = (x: string | number): string => String(x).replace(/\d/g, (d) => BD[+d])
/** Bangla digits -> Latin digits */
export const unbn = (s: string): string => s.replace(/[০-৯]/g, (d) => String(BD.indexOf(d)))
export const fmt1 = (x: number): string => bn(+(+x).toFixed(1))
export const fmt2 = (x: number): string => bn((+x).toFixed(2))

export const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর']
export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const WD_BN = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি']

const parts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}
/** ১০ অক্টোবর */
export const dateBn = (iso: string): string => {
  const { m, d } = parts(iso)
  return `${bn(d)} ${MONTHS_BN[m - 1]}`
}
/** 10 Oct (secondary label) */
export const dateEn = (iso: string): string => {
  const { m, d } = parts(iso)
  return `${d} ${MONTHS_EN[m - 1]}`
}
export const dateLongBn = (iso: string): string => `${dateBn(iso)} ${bn(parts(iso).y)}`

/**
 * Compact Bangla span for a list of ISO dates.
 * [10,11 Oct] -> "১০ ও ১১ অক্টোবর"; [3,4,5 Oct] -> "৩–৫ অক্টোবর"; otherwise "১ অক্টোবর, ৫ নভেম্বর".
 */
export function dateSpanBn(dates: string[]): string {
  const ds = [...dates].sort()
  if (!ds.length) return ''
  const groups: string[][] = []
  for (const d of ds) {
    const g = groups[groups.length - 1]
    if (g && diffISO(g[g.length - 1], d) === 1) g.push(d)
    else groups.push([d])
  }
  const label = (g: string[]) => {
    const a = parts(g[0])
    const b = parts(g[g.length - 1])
    const sameMonth = a.m === b.m
    if (g.length === 1) return dateBn(g[0])
    if (g.length === 2) return sameMonth ? `${bn(a.d)} ও ${bn(b.d)} ${MONTHS_BN[a.m - 1]}` : `${dateBn(g[0])} ও ${dateBn(g[1])}`
    return sameMonth ? `${bn(a.d)}–${bn(b.d)} ${MONTHS_BN[a.m - 1]}` : `${dateBn(g[0])} – ${dateBn(g[g.length - 1])}`
  }
  return groups.map(label).join(', ')
}
function diffISO(a: string, b: string) {
  const u = (s: string) => {
    const p = parts(s)
    return Date.UTC(p.y, p.m - 1, p.d)
  }
  return Math.round((u(b) - u(a)) / 86400000)
}
/** দিন ১০–১১ */
export function dayRangeBn(nos: number[]): string {
  const s = [...nos].sort((a, b) => a - b)
  if (!s.length) return ''
  const groups: number[][] = []
  for (const n of s) {
    const g = groups[groups.length - 1]
    if (g && n - g[g.length - 1] === 1) g.push(n)
    else groups.push([n])
  }
  return 'দিন ' + groups.map((g) => (g.length === 1 ? bn(g[0]) : `${bn(g[0])}–${bn(g[g.length - 1])}`)).join(', ')
}
export const TIER_BN: Record<string, string> = { T1: 'স্তর-১', T2: 'স্তর-২', T3: 'স্তর-৩', T4: 'স্তর-৪' }
export const SUBJ_BN: Record<string, string> = {
  Phy: 'পদার্থবিজ্ঞান',
  Chem: 'রসায়ন',
  Math: 'উচ্চতর গণিত',
  Eng: 'English',
  Rep: 'পুনরাবৃত্ত প্রশ্ন',
  P: 'পদার্থবিজ্ঞান',
  C: 'রসায়ন',
  M: 'উচ্চতর গণিত',
  X: 'ধরা-পড়ার দিন',
}
export const yearBn = (y: string): string => (y.startsWith('MT') ? 'মডেল টেস্ট-' + bn(y.slice(2).padStart(2, '0')) : bn(y))
const LET: Record<string, string> = { a: 'ক', b: 'খ', c: 'গ', d: 'ঘ', e: 'ঙ' }
export const qnBn = (q: string): string => {
  const m = q.match(/^(\d+)([a-z]?)$/)
  return m ? bn(m[1]) + (m[2] ? `(${LET[m[2]] ?? m[2]})` : '') : bn(q)
}
