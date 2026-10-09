import { useMemo, useState } from 'react'
import { TESTS } from '../core/codes'
import { donorBundle } from '../core/fhir'
import { useStore } from '../state/store'
import { Badge } from '../ui'

export function DataModel() {
  const { state } = useStore()
  const [donorId, setDonorId] = useState('d-priya')
  const donor = state.donors.find((d) => d.id === donorId) ?? state.donors[0]
  const bundle = useMemo(() => donorBundle(donor, state.donations, state.observations), [donor, state.donations, state.observations])

  return (
    <main className="page stack-lg">
      <div className="section-head">
        <div>
          <h1 style={{ fontSize: 32 }}>Open data model</h1>
          <p className="muted">Every record is stored in FHIR R4, the format ABDM uses, so any lab, hospital or vendor can connect.</p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="stack">
          <div className="card stack">
            <h3>How records map</h3>
            <table className="table">
              <tbody>
                <tr>
                  <td>Donor</td>
                  <td>
                    <span className="code">Patient</span> with ABHA address as identifier
                  </td>
                </tr>
                <tr>
                  <td>Donation</td>
                  <td>
                    <span className="code">Procedure</span> at a blood centre <span className="code">Location</span>
                  </td>
                </tr>
                <tr>
                  <td>Test result</td>
                  <td>
                    <span className="code">Observation</span> coded in LOINC, with reference range
                  </td>
                </tr>
                <tr>
                  <td>Source and verification</td>
                  <td>
                    <span className="code">meta.source</span> and a verified tag
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="card stack">
            <h3>Test catalogue</h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Test</th>
                    <th>Code</th>
                    <th>Shown to donor</th>
                  </tr>
                </thead>
                <tbody>
                  {TESTS.map((t) => (
                    <tr key={t.code}>
                      <td>{t.display}</td>
                      <td className="code">{t.code}</td>
                      <td>{t.sensitive ? <Badge tone="red">Never</Badge> : <Badge tone="green">Yes</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="tiny faint">LOINC codes to be verified against current NRCeS guidance before certification. Infection-screening tests use local codes and are blocked.</p>
          </div>
          <div className="card stack">
            <h3>Integration activity</h3>
            <div className="stack" style={{ gap: 8 }}>
              {state.events.slice(0, 12).map((e) => (
                <div key={e.id} className="row" style={{ alignItems: 'flex-start' }}>
                  <Badge tone={e.kind === 'abdm' || e.kind === 'lab-sync' ? 'blue' : e.kind === 'e-raktkosh' ? 'green' : e.kind === 'request' ? 'red' : ''}>{e.kind}</Badge>
                  <span className="small">{e.text}</span>
                </div>
              ))}
            </div>
            <p className="tiny faint">e-RaktKosh and ABDM calls are simulated in this demo.</p>
          </div>
        </div>
        <div className="card stack">
          <div className="row between">
            <h3>FHIR bundle</h3>
            <select className="input" style={{ width: 'auto' }} value={donorId} onChange={(e) => setDonorId(e.target.value)} aria-label="Donor">
              {state.donors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <pre className="json">{JSON.stringify(bundle, null, 2)}</pre>
        </div>
      </div>
    </main>
  )
}
