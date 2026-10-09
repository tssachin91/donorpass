import { useMemo, useState } from 'react'
import { testDef } from '../core/codes'
import { mapLabRows, parseLabCsv, type MappedRow } from '../core/labMapping'
import { maskName } from '../core/matching'
import { SAMPLE_LAB_CSV } from '../data/seed'
import { useStore } from '../state/store'
import { Badge, Notice, Seg } from '../ui'

const NO_LINKS: Record<string, string> = {}

const OUTCOME: Record<MappedRow['outcome'], { text: string; tone: string }> = {
  mapped: { text: 'Mapped', tone: 'green' },
  blocked: { text: 'Blocked', tone: 'red' },
  unmapped: { text: 'Held for review', tone: 'amber' },
  invalid: { text: 'Not linked', tone: '' },
}

export function LabPortal() {
  const { state } = useStore()
  const labs = state.facilities.filter((f) => f.kind === 'lab')
  const [labId, setLabId] = useState(labs[0].id)
  const [tab, setTab] = useState<'sync' | 'patients'>('sync')
  const lab = labs.find((l) => l.id === labId)!

  return (
    <main className="page stack-lg">
      <div className="section-head">
        <div>
          <h1 style={{ fontSize: 32 }}>Lab portal</h1>
          <p className="muted">Send blood test results to donors who consented, through ABDM or the Donor Pass sync connector.</p>
        </div>
        <div className="field" style={{ minWidth: 280 }}>
          <label htmlFor="lab">Signed in as</label>
          <select id="lab" className="input" value={labId} onChange={(e) => setLabId(e.target.value)}>
            {labs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Notice tone="blue" title={lab.abdmReady ? 'Your lab software already supports ABDM' : 'Your lab software does not support ABDM yet'}>
        {lab.abdmReady
          ? 'Reports are linked to patients’ ABHA records and reach Donor Pass when the donor consents.'
          : 'The sync connector reads your usual export, maps it to the standard format and links it to ABDM on your behalf, as your data processor.'}
      </Notice>
      <Seg
        label="Lab portal section"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'sync', label: 'Sync connector' },
          { value: 'patients', label: 'Linked donors' },
        ]}
      />
      {tab === 'sync' ? <SyncConnector labId={labId} /> : <LinkedDonors labId={labId} />}
    </main>
  )
}

function SyncConnector({ labId }: { labId: string }) {
  const { state, actions } = useStore()
  const lab = state.facilities.find((f) => f.id === labId)!
  const [csv, setCsv] = useState(() => SAMPLE_LAB_CSV(state.today))
  const [delivered, setDelivered] = useState<number>()
  const links = state.labPatients[labId] ?? NO_LINKS

  const result = useMemo(
    () =>
      mapLabRows(parseLabCsv(csv), {
        resolvePatient: (ref) => links[ref],
        labId,
        source: lab.abdmReady ? 'abdm' : 'lab-sync',
      }),
    [csv, labId, links, lab.abdmReady],
  )

  const consenting = result.observations.filter((o) => state.donors.find((d) => d.id === o.donorId)?.consents.labSharing)

  const deliver = () => {
    actions.addObservations(consenting)
    const donors = new Set(consenting.map((o) => o.donorId)).size
    actions.log(lab.abdmReady ? 'abdm' : 'lab-sync', `${lab.name} delivered ${consenting.length} results to ${donors} donor(s); linked to ABDM (simulated)`)
    setDelivered(consenting.length)
  }

  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <div className="card stack">
        <div className="row between">
          <h3>1. Your export</h3>
          <button className="btn sm ghost" onClick={() => setCsv(SAMPLE_LAB_CSV(state.today))}>
            Reset sample
          </button>
        </div>
        <p className="small muted">Paste the CSV your lab system already produces. Columns: patient_ref, test_name, value, unit, ref_range, collected_on.</p>
        <textarea
          className="input"
          rows={12}
          value={csv}
          onChange={(e) => {
            setCsv(e.target.value)
            setDelivered(undefined)
          }}
          aria-label="Lab export CSV"
          spellCheck={false}
        />
      </div>
      <div className="card stack">
        <h3>2. Mapped to the standard format</h3>
        <div className="row-wrap">
          <Badge tone="green">{result.counts.mapped} mapped</Badge>
          <Badge tone="red">{result.counts.blocked} blocked</Badge>
          <Badge tone="amber">{result.counts.unmapped} for review</Badge>
          <Badge>{result.counts.invalid} not linked</Badge>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Result</th>
                <th>Code</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <span className="small">
                      {r.row.testName} · {r.outcome === 'blocked' ? '•••' : r.row.value}
                    </span>
                    <div className="tiny faint code">{r.row.patientRef}</div>
                  </td>
                  <td>
                    <Badge tone={OUTCOME[r.outcome].tone}>{OUTCOME[r.outcome].text}</Badge>
                    {r.note && <div className="tiny faint">{r.note}</div>}
                  </td>
                  <td className="code tiny">{r.codes.map((c) => `${c} ${testDef(c)?.short ?? ''}`).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tiny faint">Infection-screening values are never stored or displayed. Unknown patient references are not linked to anyone.</p>
        <h3>3. Deliver</h3>
        <p className="small muted">
          {consenting.length} of {result.observations.length} values belong to donors who allow lab sharing.
        </p>
        {delivered !== undefined ? (
          <Notice tone="green" title="Delivered">
            {delivered} values sent to donors’ timelines. Check Sneha Kulkarni in the donor app.
          </Notice>
        ) : (
          <button className="btn primary" disabled={consenting.length === 0} onClick={deliver}>
            Deliver {consenting.length} values with consent
          </button>
        )}
      </div>
    </div>
  )
}

function LinkedDonors({ labId }: { labId: string }) {
  const { state } = useStore()
  const links = Object.entries(state.labPatients[labId] ?? {})
  return (
    <div className="card">
      <p className="small muted" style={{ marginBottom: 10 }}>
        Your patient references linked to Donor Pass members. Links are made when a donor consents, usually through their ABHA address.
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>Your reference</th>
            <th>Donor</th>
            <th>Lab sharing</th>
          </tr>
        </thead>
        <tbody>
          {links.map(([ref, donorId]) => {
            const d = state.donors.find((x) => x.id === donorId)
            return (
              <tr key={ref}>
                <td className="code">{ref}</td>
                <td>{d ? maskName(d.name) : 'Unknown'}</td>
                <td>{d?.consents.labSharing ? <Badge tone="green">Consented</Badge> : <Badge>Off</Badge>}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
