const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '₊': '+', '⁺': '+' }
const BD = '০১২৩৪৫৬৭৮৯'

/** NFC, drop ZWJ/ZWNJ, Bangla+sub/superscript digits to ASCII, lowercase, strip punctuation. */
export function norm(s: string): string {
  return s
    .normalize('NFC')
    .replace(/[‌‍]/g, '')
    .replace(/[₀-₉⁰-⁹⁻₊⁺¹²³]/g, (c) => SUB[c] ?? c)
    .replace(/[০-৯]/g, (d) => String(BD.indexOf(d)))
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
export const hasBangla = (s: string) => /[ঀ-৿]/.test(s)
export const words = (s: string) => (s ? s.split(' ') : [])
