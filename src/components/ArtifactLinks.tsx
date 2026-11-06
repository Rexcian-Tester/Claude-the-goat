import type { ArtifactChapter } from '../data/types'

const OFF: Record<'coming-soon' | 'none', string> = { 'coming-soon': 'Coming soon', none: 'No artifact available' }

/** "📘 Open artifact" for a chapter's study artifact (new tab), or a greyed "Coming soon" / "No artifact available";
 *  extra links underneath ("More: Pattern guide · Quiz"). With two chapters (e.g. সরলরেখা ও কণিক) the first is the
 *  button and the second joins the extra links. */
export function ArtifactLinks({ rows, compact }: { rows: ArtifactChapter[]; compact?: boolean }) {
  if (!rows.length) return null
  const [main, ...rest] = rows
  const more: { label: string; url: string }[] = []
  const add = (label: string, url: string | null) => url && url !== main.link && !more.some((m) => m.url === url) && more.push({ label, url })
  for (const e of main.extras) add(e.label, e.url)
  for (const r of rest) {
    if (r.status === 'ready') add(r.name, r.link)
    for (const e of r.extras) add(e.label, e.url)
  }
  return (
    <div className={`art ${compact ? 'compact' : ''}`} onClick={(e) => e.stopPropagation()}>
      <div className="art-main">
        {main.status === 'ready' && main.link ? (
          <a className={`btn primary art-btn ${compact ? 'sm' : ''}`} href={main.link} target="_blank" rel="noopener noreferrer">
            <span aria-hidden="true">📘</span> Open artifact
          </a>
        ) : (
          <span className={`btn art-btn off ${compact ? 'sm' : ''}`} role="note" aria-disabled="true">{OFF[main.status === 'ready' ? 'none' : main.status]}</span>
        )}
        {main.skipped && <span className="tag art-skip">Skipped</span>}
      </div>
      {more.length > 0 && (
        <div className="art-more small">
          More:{' '}
          {more.map((m, i) => (
            <span key={m.url}>
              {i > 0 && ' · '}
              <a href={m.url} target="_blank" rel="noopener noreferrer">{m.label}</a>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
