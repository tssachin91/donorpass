import QRCode from 'qrcode'
import { useEffect, useState, type ReactNode } from 'react'
import { formatDate } from './core/dates'
import type { SourceSystem } from './core/types'

export function DropMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 3c5 7 9 11.6 9 17a9 9 0 1 1-18 0c0-5.4 4-10 9-17z" fill="var(--red)" />
      <path d="M12 20.5a4 4 0 0 0 4 4" stroke="#fff" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.85" />
    </svg>
  )
}

const SOURCE_LABEL: Record<SourceSystem, { text: string; tone: string }> = {
  'e-raktkosh': { text: 'e-RaktKosh', tone: 'green' },
  'centre-desk': { text: 'Centre verified', tone: 'green' },
  abdm: { text: 'ABDM', tone: 'blue' },
  'lab-sync': { text: 'Lab sync', tone: 'blue' },
  upload: { text: 'Uploaded, unverified', tone: 'amber' },
  'self-reported': { text: 'Self-reported', tone: 'amber' },
}

export function SourceBadge({ source }: { source: SourceSystem }) {
  const s = SOURCE_LABEL[source]
  return <span className={`badge ${s.tone}`}>{s.text}</span>
}

export function Badge({ tone = '', children }: { tone?: string; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>
}

export function Notice({ tone, title, children }: { tone: 'amber' | 'green' | 'blue' | 'red'; title?: string; children: ReactNode }) {
  return (
    <div className={`notice ${tone}`} role={tone === 'red' || tone === 'amber' ? 'alert' : undefined}>
      <div className="stack" style={{ gap: 2 }}>
        {title && <strong>{title}</strong>}
        <div className="body">{children}</div>
      </div>
    </div>
  )
}

export function QR({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState<string>()
  useEffect(() => {
    let live = true
    QRCode.toDataURL(value, { margin: 1, width: 400, color: { dark: '#221a1c', light: '#ffffff' } })
      .then((url) => live && setSrc(url))
      .catch(() => live && setSrc(undefined))
    return () => {
      live = false
    }
  }, [value])
  return <div className="qr">{src ? <img src={src} alt={label} /> : <div style={{ width: 200, height: 200 }} />}</div>
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="stack" style={{ gap: 0 }}>
        <strong style={{ fontSize: 14 }}>{label}</strong>
        {hint && <span className="small muted">{hint}</span>}
      </span>
    </label>
  )
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flat" style={{ textAlign: 'center', padding: 28 }}>
      <h3>{title}</h3>
      {children && <div className="muted small" style={{ marginTop: 6 }}>{children}</div>}
    </div>
  )
}

/** Haemoglobin trend with the 12.5 g/dL donation minimum drawn as a reference line. */
export function HbChart({ points, threshold = 12.5 }: { points: Array<{ date: string; value: number }>; threshold?: number }) {
  if (points.length === 0) return <p className="muted small">No haemoglobin results yet.</p>
  const W = 340
  const H = 150
  const pad = { l: 34, r: 18, t: 22, b: 26 }
  const values = points.map((p) => p.value)
  const lo = Math.floor(Math.min(threshold, ...values) - 0.5)
  const hi = Math.ceil(Math.max(threshold, ...values) + 0.5)
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r))
  const y = (v: number) => pad.t + ((hi - v) / (hi - lo)) * (H - pad.t - pad.b)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)} ${y(p.value)}`).join('')
  const last = points[points.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Haemoglobin trend, latest ${last.value} g/dL`}>
      <line x1={pad.l} x2={W - pad.r} y1={y(threshold)} y2={y(threshold)} stroke="var(--amber)" strokeDasharray="4 4" />
      <text x={pad.l + 4} y={y(threshold) + 13} textAnchor="start" fontSize="10.5" fill="var(--amber)">
        {threshold} minimum
      </text>
      {[lo, hi].map((v) => (
        <text key={v} x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10.5" fill="var(--ink-3)">
          {v}
        </text>
      ))}
      <path d={path} fill="none" stroke="var(--red)" strokeWidth="2.25" />
      {points.map((p, i) => (
        <g key={p.date + i}>
          <circle cx={x(i)} cy={y(p.value)} r={i === points.length - 1 ? 4.5 : 3.25} fill={p.value < threshold ? 'var(--amber)' : 'var(--red)'}>
            <title>{`${formatDate(p.date)}: ${p.value} g/dL`}</title>
          </circle>
          {(i === 0 || i === points.length - 1) && (
            <text x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : 'end'} fontSize="10.5" fill="var(--ink-3)">
              {formatDate(p.date)}
            </text>
          )}
        </g>
      ))}
      <text x={x(points.length - 1)} y={y(last.value) - 10} textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)">
        {last.value}
      </text>
    </svg>
  )
}

export const componentLabel = (c: string) => (c === 'red-cells' ? 'Red cells' : c === 'platelets' ? 'Platelets' : 'Plasma')
export const typeLabel = (t: string) => (t === 'whole-blood' ? 'Whole blood' : t === 'platelets' ? 'Platelets' : 'Plasma')

export function timeLeft(iso: string, now = Date.now()): string {
  const ms = new Date(iso).getTime() - now
  const h = Math.round(Math.abs(ms) / 3_600_000)
  if (ms < 0) return `${h} h overdue`
  return h < 1 ? 'under 1 h' : `${h} h left`
}
