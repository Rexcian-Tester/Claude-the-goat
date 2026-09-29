import { useEffect, useState } from 'react'

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

type Katex = { renderToString: (t: string, o: object) => string }
let katexP: Promise<Katex> | null = null
export function loadKatex(): Promise<Katex> {
  if (!katexP) {
    katexP = Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([m]) => (m.default ?? m) as unknown as Katex)
  }
  return katexP
}

/** Tiny, escaping markdown: headings, lists, bold/italic/code, $inline$ and $$block$$ math via KaTeX. */
export function renderMarkdown(src: string, katex: Katex | null): string {
  const maths: string[] = []
  const stash = (tex: string, display: boolean) => {
    let html: string
    try {
      html = katex ? katex.renderToString(tex, { displayMode: display, throwOnError: false }) : `<code>${esc(tex)}</code>`
    } catch {
      html = `<code>${esc(tex)}</code>`
    }
    maths.push(html)
    return `\u0000${maths.length - 1}\u0000`
  }
  let t = src.replace(/\$\$([\s\S]+?)\$\$/g, (_, m) => stash(m, true)).replace(/\$([^$\n]+?)\$/g, (_, m) => stash(m, false))
  t = esc(t)
  const inline = (s: string) =>
    s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  const out: string[] = []
  let list: 'ul' | 'ol' | null = null
  const close = () => {
    if (list) out.push(`</${list}>`)
    list = null
  }
  for (const line of t.split('\n')) {
    let m: RegExpMatchArray | null
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) (close(), out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`))
    else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
      if (list !== 'ul') (close(), out.push('<ul>'), (list = 'ul'))
      out.push(`<li>${inline(m[1])}</li>`)
    } else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) {
      if (list !== 'ol') (close(), out.push('<ol>'), (list = 'ol'))
      out.push(`<li>${inline(m[1])}</li>`)
    } else if (/^---+$/.test(line.trim())) (close(), out.push('<hr>'))
    else if (!line.trim()) close()
    else (close(), out.push(`<p>${inline(line)}</p>`))
  }
  close()
  // eslint-disable-next-line no-control-regex
  return out.join('').replace(/\u0000(\d+)\u0000/g, (_, i) => maths[+i])
}

export function Markdown({ text }: { text: string }) {
  const [k, setK] = useState<Katex | null>(null)
  useEffect(() => {
    let live = true
    if (/\$/.test(text)) loadKatex().then((x) => live && setK(x)).catch(() => {})
    return () => {
      live = false
    }
  }, [text])
  return <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(text, k) }} />
}
