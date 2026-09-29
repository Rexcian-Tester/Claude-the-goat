import { useEffect, useRef, useState } from 'react'
const bn = (x: string | number) => String(x)

export interface Series {
  name: string
  color: string // CSS var
  dash?: string
  values: (number | undefined)[]
  kind?: 'line' | 'bar'
}
interface Props {
  title: string
  labels: string[] // one per x index (ISO date)
  series: Series[]
  yMax?: number
  yTicks?: number
  yLabel: string
  fmtLabel: (l: string) => string
}
const H = 210
const P = { l: 34, r: 12, t: 12, b: 26 }

/** One-axis line/bar chart with legend, hover crosshair + tooltip, and a table view. Colours are theme tokens. */
export function Chart({ title, labels, series, yMax, yTicks = 4, yLabel, fmtLabel }: Props) {
  const [hover, setHover] = useState<number | null>(null)
  const [table, setTable] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(600)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setW(Math.max(260, Math.round(el.clientWidth))))
    ro.observe(el)
    setW(Math.max(260, Math.round(el.clientWidth || 600)))
    return () => ro.disconnect()
  }, [table])
  const n = labels.length
  const max = yMax ?? Math.max(1, ...series.flatMap((s) => s.values.filter((v): v is number => v !== undefined)))
  const top = yMax ?? Math.ceil(max * 1.1)
  const x = (i: number) => P.l + (n <= 1 ? 0.5 : i / (n - 1)) * (W - P.l - P.r)
  const y = (v: number) => H - P.b - (v / top) * (H - P.t - P.b)
  const barW = Math.max(2, Math.min(14, (W - P.l - P.r) / Math.max(1, n) - 3))
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (top / yTicks) * i)
  const xTicks = n <= 1 ? [0] : W < 420 ? [0, n - 1] : [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1]
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    setHover(Math.max(0, Math.min(n - 1, Math.round(((px - P.l) / (W - P.l - P.r)) * (n - 1)))))
  }
  if (!n) return <div className="empty">No data yet.</div>
  return (
    <figure style={{ margin: 0 }} className="stack">
      <figcaption className="row-flex" style={{ justifyContent: 'space-between' }}>
        <span className="row-flex" aria-label="Legend">
          {series.map((s) => (
            <span key={s.name} className="pd">
              <svg width="22" height="10" aria-hidden="true">
                {s.kind === 'bar' ? <rect x="4" y="0" width="14" height="10" rx="2" fill={s.color} /> : <line x1="0" y1="5" x2="22" y2="5" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} strokeLinecap="round" />}
              </svg>
              {s.name}
            </span>
          ))}
        </span>
        <button className="btn sm" type="button" onClick={() => setTable(!table)} aria-pressed={table}>{table ? 'Show chart' : 'Show table'}</button>
      </figcaption>
      {table ? (
        <div className="tbl" style={{ maxHeight: 260, overflow: 'auto' }}>
          <table className="plain">
            <thead><tr><th>Date</th>{series.map((s) => <th key={s.name}>{s.name}</th>)}</tr></thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={l}><td>{fmtLabel(l)}</td>{series.map((s) => <td key={s.name} className="num">{s.values[i] === undefined ? '–' : bn(+(s.values[i] as number).toFixed(1))}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ position: 'relative' }} ref={box}>
          <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${series.map((s) => s.name).join(', ')}.`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ touchAction: 'pan-y' }}>
            {ticks.map((t) => (
              <g key={t}>
                <line className="grid" x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} />
                <text x={P.l - 6} y={y(t) + 4} textAnchor="end">{bn(+t.toFixed(1))}</text>
              </g>
            ))}
            <line className="axis" x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} />
            {xTicks.map((i) => <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{fmtLabel(labels[i])}</text>)}
            <text x={P.l} y={9} textAnchor="start">{yLabel}</text>
            {series.filter((s) => s.kind === 'bar').map((s) =>
              s.values.map((v, i) => v === undefined ? null : <rect key={`${s.name}${i}`} x={x(i) - barW / 2} y={y(v)} width={barW} height={Math.max(0, H - P.b - y(v))} rx={Math.min(3, barW / 2)} fill={s.color} opacity={hover === i ? 1 : 0.85} />),
            )}
            {series.filter((s) => s.kind !== 'bar').map((s) => {
              const pts = s.values.map((v, i) => (v === undefined ? null : ([x(i), y(v)] as const)))
              const segs: string[] = []
              let cur = ''
              pts.forEach((p) => {
                if (!p) { if (cur) segs.push(cur); cur = ''; return }
                cur += `${cur ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`
              })
              if (cur) segs.push(cur)
              return <g key={s.name}>{segs.map((d, i) => <path key={i} d={d} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />)}
                {hover !== null && s.values[hover] !== undefined && <circle cx={x(hover)} cy={y(s.values[hover]!)} r="4" fill={s.color} stroke="var(--panel)" strokeWidth="2" />}</g>
            })}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="var(--muted)" strokeWidth="1" opacity="0.5" />}
          </svg>
          {hover !== null && (
            <div className="card" style={{ position: 'absolute', top: 4, left: `${Math.min(70, Math.max(0, (x(hover) / W) * 100 - 12))}%`, padding: '6px 10px', gap: 2, fontSize: 13, pointerEvents: 'none' }}>
              <b>{fmtLabel(labels[hover])}</b>
              {series.map((s) => <span key={s.name}>{s.name}: {s.values[hover] === undefined ? '–' : bn(+(s.values[hover] as number).toFixed(1))}</span>)}
            </div>
          )}
        </div>
      )}
    </figure>
  )
}
