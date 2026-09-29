// Lossy phonetic skeleton so Banglish ("gotibidda", "lami") lines up with Bangla ("গতিবিদ্যা", "লামির").
// Both sides reduce to consonant classes with doubles collapsed; vowels are kept separately as a weak tie-breaker.

const BN_CONS: Record<string, string> = {
  'ক': 'k', 'খ': 'k', 'গ': 'g', 'ঘ': 'g', 'ঙ': 'n', 'চ': 'c', 'ছ': 'c', 'জ': 'j', 'ঝ': 'j', 'ঞ': 'n', 'ট': 't', 'ঠ': 't', 'ড': 'd', 'ঢ': 'd', 'ণ': 'n',
  'ত': 't', 'থ': 't', 'দ': 'd', 'ধ': 'd', 'ন': 'n', 'প': 'p', 'ফ': 'p', 'ব': 'b', 'ভ': 'b', 'ম': 'm', 'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 's', 'ষ': 's',
  'স': 's', 'হ': 'h', 'ৎ': 't', 'ং': 'n', 'ড়': 'r', 'ঢ়': 'r', 'য়': '',
}
const BN_VOW: Record<string, string> = {
  'অ': 'a', 'আ': 'a', 'া': 'a', 'ই': 'i', 'ঈ': 'i', 'ি': 'i', 'ী': 'i', 'উ': 'u', 'ঊ': 'u', 'ু': 'u', 'ূ': 'u', 'ঋ': 'r', 'ৃ': 'r', 'এ': 'i', 'ে': 'i', 'ঐ': 'i', 'ৈ': 'i', 'ও': 'a', 'ো': 'a', 'ঔ': 'a', 'ৌ': 'a',
}
const HASANTA = '্'
const NUKTA = '়'

export interface Key {
  cons: string
  vow: string
}
const collapse = (s: string) => s.replace(/(.)\1+/g, '$1')

export function bnKey(word: string): Key {
  const w = word.normalize('NFC')
  let cons = ''
  let vow = ''
  for (let i = 0; i < w.length; i++) {
    let ch = w[i]
    if (w[i + 1] === NUKTA) {
      ch = ch + NUKTA
      i++
    }
    if (ch === HASANTA) {
      // য-ফলা / ব-ফলা are not pronounced as separate consonants: drop the one that follows
      const nx = w[i + 1]
      if (nx === 'য' || nx === 'ব') i++
      continue
    }
    if (ch in BN_CONS) cons += BN_CONS[ch]
    else if (ch in BN_VOW) vow += BN_VOW[ch]
    else if (/[a-z0-9]/i.test(ch)) cons += ch.toLowerCase() // embedded Latin (Ksp, KMnO4)
  }
  return { cons: collapse(cons), vow: collapse(vow) }
}

const DIGRAPHS: [string, string][] = [
  ['chh', 'c'], ['ksh', 'ks'], ['kh', 'k'], ['gh', 'g'], ['ch', 'c'], ['sh', 's'], ['th', 't'], ['dh', 'd'], ['ph', 'p'], ['bh', 'b'],
  ['jh', 'j'], ['zh', 'j'], ['ng', 'n'], ['ck', 'k'], ['qu', 'k'],
]
const LAT: Record<string, string> = { b: 'b', c: 'k', d: 'd', f: 'p', g: 'g', h: 'h', j: 'j', k: 'k', l: 'l', m: 'm', n: 'n', p: 'p', q: 'k', r: 'r', s: 's', t: 't', v: 'b', x: 'ks', z: 'j' }

export function latKey(word: string): Key {
  const w = word.toLowerCase().replace(/[^a-z]/g, '')
  let cons = ''
  let vow = ''
  for (let i = 0; i < w.length; ) {
    const d = DIGRAPHS.find(([g]) => w.startsWith(g, i))
    if (d) {
      cons += d[1]
      i += d[0].length
      continue
    }
    const ch = w[i++]
    if (ch in LAT) cons += LAT[ch]
    else if ('aou'.includes(ch)) vow += ch === 'u' ? 'u' : 'a'
    else if ('eiy'.includes(ch)) vow += 'i'
    // w: dropped
  }
  return { cons: collapse(cons), vow: collapse(vow) }
}

/** longest common subsequence ratio of two short strings (vowel-class tie-break) */
export function vowelSim(a: string, b: string): number {
  if (!a || !b) return 0
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
  return dp[a.length][b.length] / Math.max(a.length, b.length)
}
export function lev(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...new Array(n).fill(0)])
  for (let j = 1; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[m][n]
}
