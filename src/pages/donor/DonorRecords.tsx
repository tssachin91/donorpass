import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CODES, TESTS, testDef } from '../../core/codes'
import { formatDate } from '../../core/dates'
import type { Donor, Observation } from '../../core/types'
import { facilityName, timelineFor } from '../../state/selectors'
import { newId, useStore } from '../../state/store'
import { Empty, HbChart, Notice, Seg, SourceBadge, typeLabel } from '../../ui'

function valueText(o: Observation) {
  return `${o.value}${o.unit ? ` ${o.unit}` : ''}`
}

function rangeFlag(o: Observation): 'low' | 'high' | undefined {
  if (typeof o.value !== 'number') return undefined
  if (o.refLow !== undefined && o.value < o.refLow) return 'low'
  if (o.refHigh !== undefined && o.value > o.refHigh) return 'high'
  return undefined
}

export function DonorTimeline({ donor }: { donor: Donor }) {
  const { state } = useStore()
  const [filter, setFilter] = useState<'all' | 'donation' | 'test'>('all')
  const entries = timelineFor(state, donor.id).filter((e) => filter === 'all' || e.kind === filter)

  return (
    <div className="stack">
      <div className="row between">
        <h2>Timeline</h2>
        <Link to="/donor/upload" className="btn sm">
          Add report
        </Link>
      </div>
      <Seg
        label="Filter timeline"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'All' },
          { value: 'donation', label: 'Donations' },
          { value: 'test', label: 'Tests' },
        ]}
      />
      {entries.length === 0 ? (
        <Empty title="Nothing here yet">Records appear when a centre or lab shares them, or when you upload a report.</Empty>
      ) : (
        <div className="card tight timeline">
          {entries.map((e) => {
            if (e.kind === 'donation') {
              const d = e.item
              return (
                <div className="tl-item" key={e.id}>
                  <div className="tl-icon don" aria-hidden="true">●</div>
                  <div className="stack" style={{ gap: 3 }}>
                    <div className="row between">
                      <strong>{typeLabel(d.type)} donation</strong>
                      <span className="tiny faint num">{formatDate(d.date)}</span>
                    </div>
                    <span className="small muted">
                      {facilityName(state, d.centreId)} · {d.volumeMl} ml
                    </span>
                    <div className="row-wrap">
                      <SourceBadge source={d.source} />
                    </div>
                    {d.verified && (
                      <span className="tiny faint">Screened for infections. Your centre will contact you privately if any follow-up is needed.</span>
                    )}
                  </div>
                </div>
              )
            }
            if (e.kind === 'test') {
              const o = e.item
              const def = testDef(o.code)
              const flag = rangeFlag(o)
              return (
                <div className="tl-item" key={e.id}>
                  <div className="tl-icon test" aria-hidden="true">◆</div>
                  <div className="stack" style={{ gap: 3 }}>
                    <div className="row between">
                      <strong>{def?.display ?? o.code}</strong>
                      <span className="tiny faint num">{formatDate(o.date)}</span>
                    </div>
                    <span className="small num">
                      {valueText(o)}
                      {flag && <span style={{ color: 'var(--amber)', fontWeight: 600 }}> · {flag} for the lab’s range</span>}
                    </span>
                    <div className="row-wrap">
                      <SourceBadge source={o.source} />
                      {o.labId && <span className="badge">{facilityName(state, o.labId)}</span>}
                    </div>
                  </div>
                </div>
              )
            }
            const d = e.item
            return (
              <div className="tl-item" key={e.id}>
                <div className="tl-icon def" aria-hidden="true">!</div>
                <div className="stack" style={{ gap: 3 }}>
                  <div className="row between">
                    <strong>Deferral</strong>
                    <span className="tiny faint num">{formatDate(d.from)}</span>
                  </div>
                  <span className="small muted">
                    {d.reason}. Until {formatDate(d.until)}.
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function DonorHealth({ donor }: { donor: Donor }) {
  const { state } = useStore()
  const mine = state.observations.filter((o) => o.donorId === donor.id).sort((a, b) => a.date.localeCompare(b.date))
  const hb = mine.filter((o) => o.code === CODES.hb && typeof o.value === 'number').map((o) => ({ date: o.date, value: o.value as number }))
  const latestOf = (code: string) => [...mine].reverse().find((o) => o.code === code)
  const abo = latestOf(CODES.abo)
  const rh = latestOf(CODES.rh)
  const others = TESTS.filter((t) => !t.sensitive && t.category !== 'blood-group' && t.code !== CODES.hb)
    .map((t) => latestOf(t.code))
    .filter((o): o is Observation => Boolean(o))

  return (
    <div className="stack">
      <div className="row between">
        <h2>Blood health</h2>
        <Link to="/donor/upload" className="btn sm">
          Add report
        </Link>
      </div>
      <div className="card tight stack">
        <div className="row between">
          <h3>Haemoglobin</h3>
          <span className="tiny faint">g/dL</span>
        </div>
        <HbChart points={hb} />
        <p className="tiny faint">Donation needs at least 12.5 g/dL on the day. Results below the line are worth an iron check.</p>
      </div>
      <div className="card tight row between">
        <div>
          <span className="label">Blood group</span>
          <p style={{ fontFamily: 'var(--display)', fontSize: 24, fontWeight: 600 }}>{donor.bloodGroup}</p>
        </div>
        {abo && rh ? (
          <div className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
            <span className="small muted">
              Grouped {formatDate(abo.date)}
            </span>
            <SourceBadge source={abo.source} />
          </div>
        ) : (
          <span className="small muted" style={{ maxWidth: 160, textAlign: 'right' }}>
            {donor.bloodGroupVerified ? 'Verified by a centre' : 'Not yet verified. A centre confirms it at your next donation.'}
          </span>
        )}
      </div>
      {others.length > 0 && (
        <div className="card tight">
          <span className="label">Latest results</span>
          <table className="table" style={{ marginTop: 6 }}>
            <tbody>
              {others.map((o) => {
                const flag = rangeFlag(o)
                return (
                  <tr key={o.id}>
                    <td>
                      {testDef(o.code)?.display}
                      <div className="tiny faint">{formatDate(o.date)}</div>
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      <strong>{valueText(o)}</strong>
                      <div className="tiny faint">
                        {o.refLow !== undefined ? `range ${o.refLow} to ${o.refHigh}` : ''}
                        {flag && <span style={{ color: 'var(--amber)' }}> · {flag}</span>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="tiny faint">Donor Pass shows values and ranges only. It does not diagnose; talk to a doctor about any result that worries you.</p>
    </div>
  )
}

export function DonorUpload({ donor }: { donor: Donor }) {
  const { state, actions } = useStore()
  const [stage, setStage] = useState<'pick' | 'reading' | 'review' | 'saved'>('pick')
  const [fileName, setFileName] = useState('')
  const [date, setDate] = useState(state.today)
  const [hb, setHb] = useState('12.8')
  const [ferritin, setFerritin] = useState('21')

  const save = () => {
    const base = { donorId: donor.id, date, source: 'upload' as const, verified: false }
    const obs: Observation[] = []
    if (hb) obs.push({ ...base, id: newId('obs'), code: CODES.hb, value: Number(hb), unit: 'g/dL', refLow: 12, refHigh: 15.5 })
    if (ferritin) obs.push({ ...base, id: newId('obs'), code: CODES.ferritin, value: Number(ferritin), unit: 'ng/mL', refLow: 15, refHigh: 150 })
    actions.addObservations(obs)
    actions.log('lab-sync', `${donor.name} uploaded a report (${fileName || 'report.pdf'}); ${obs.length} values saved as unverified`)
    setStage('saved')
  }

  return (
    <div className="stack">
      <Link to="/donor/health" className="small">
        ← Back
      </Link>
      <h2>Add a lab report</h2>
      {stage === 'pick' && (
        <div className="card stack">
          <p className="small muted">Upload a PDF or photo of a blood test from any lab. Donor Pass reads the values and asks you to confirm them.</p>
          <label className="btn">
            Choose a file
            <input
              type="file"
              accept="application/pdf,image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) return
                setFileName(f.name)
                setStage('reading')
                setTimeout(() => setStage('review'), 900)
              }}
            />
          </label>
          <button
            className="btn ghost sm"
            onClick={() => {
              setFileName('sample-cbc-report.pdf')
              setStage('reading')
              setTimeout(() => setStage('review'), 900)
            }}
          >
            Use a sample report instead
          </button>
          <p className="tiny faint">Demo: the file is not read or uploaded; sample values are shown for you to edit.</p>
        </div>
      )}
      {stage === 'reading' && <Notice tone="blue">Reading {fileName}…</Notice>}
      {stage === 'review' && (
        <div className="card stack">
          <p className="small">
            Found in <strong>{fileName}</strong>. Check the values before saving.
          </p>
          <div className="field">
            <label htmlFor="up-date">Test date</label>
            <input id="up-date" className="input" type="date" max={state.today} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid-2" style={{ gap: 10 }}>
            <div className="field">
              <label htmlFor="up-hb">Haemoglobin (g/dL)</label>
              <input id="up-hb" className="input num" inputMode="decimal" value={hb} onChange={(e) => setHb(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="up-fe">Ferritin (ng/mL)</label>
              <input id="up-fe" className="input num" inputMode="decimal" value={ferritin} onChange={(e) => setFerritin(e.target.value)} />
            </div>
          </div>
          <Notice tone="blue">
            Infection-screening results on a report are ignored. Uploaded values are marked unverified until a lab or centre confirms them.
          </Notice>
          <button className="btn primary" onClick={save} disabled={!date || (!hb && !ferritin) || [hb, ferritin].some((v) => v && !Number.isFinite(Number(v)))}>
            Save to my record
          </button>
        </div>
      )}
      {stage === 'saved' && (
        <Notice tone="green" title="Saved">
          Your values are on your timeline, marked as uploaded. <Link to="/donor/health">See blood health →</Link>
        </Notice>
      )}
    </div>
  )
}
