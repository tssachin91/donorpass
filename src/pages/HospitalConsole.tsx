import { useMemo, useState } from 'react'
import { compatibleDonorGroups } from '../core/compatibility'
import { distanceKm, isRequestVerified } from '../core/matching'
import { BLOOD_GROUPS, type BloodGroup, type BloodRequest, type Component } from '../core/types'
import { facilityName, matchFor } from '../state/selectors'
import { newId, useStore } from '../state/store'
import { Badge, Notice, Seg, componentLabel, timeLeft } from '../ui'

const STATUS: Record<BloodRequest['status'], { text: string; tone: string }> = {
  'awaiting-verification': { text: 'Needs verification', tone: 'amber' },
  open: { text: 'Open', tone: 'red' },
  fulfilled: { text: 'Fulfilled', tone: 'green' },
  cancelled: { text: 'Cancelled', tone: '' },
}

const RESPONSE: Record<string, { text: string; tone: string }> = {
  pinged: { text: 'Alerted', tone: 'blue' },
  accepted: { text: 'On the way', tone: 'amber' },
  declined: { text: 'Declined', tone: '' },
  arrived: { text: 'Arrived at centre', tone: 'green' },
}

export function HospitalConsole() {
  const { state } = useStore()
  const hospitals = state.facilities.filter((f) => f.kind === 'hospital')
  const [hospitalId, setHospitalId] = useState(hospitals[0].id)
  const mine = state.requests.filter((r) => r.hospitalId === hospitalId)
  const [selected, setSelected] = useState<string | 'new'>(mine[0]?.id ?? 'new')
  const current = mine.find((r) => r.id === selected)

  return (
    <main className="page stack-lg">
      <div className="section-head">
        <div>
          <h1 style={{ fontSize: 32 }}>Hospital console</h1>
          <p className="muted">Raise verified requests and see matched donors heading to the blood centre.</p>
        </div>
        <div className="field" style={{ minWidth: 280 }}>
          <label htmlFor="hosp">Signed in as staff at</label>
          <select
            id="hosp"
            className="input"
            value={hospitalId}
            onChange={(e) => {
              setHospitalId(e.target.value)
              setSelected(state.requests.find((r) => r.hospitalId === e.target.value)?.id ?? 'new')
            }}
          >
            {hospitals.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="console">
        <aside className="stack">
          <button className={`btn ${selected === 'new' ? 'dark' : 'primary'}`} onClick={() => setSelected('new')}>
            + New blood request
          </button>
          <div className="list" aria-label="Requests">
            {mine.length === 0 && <p className="small muted">No requests yet.</p>}
            {mine.map((r) => (
              <button key={r.id} className={`list-item ${selected === r.id ? 'on' : ''}`} onClick={() => setSelected(r.id)}>
                <div className="row between">
                  <strong>
                    {r.patientGroup} · {componentLabel(r.component)}
                  </strong>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].text}</Badge>
                </div>
                <span className="small muted">
                  {r.units} unit{r.units > 1 ? 's' : ''} · {r.status === 'open' ? timeLeft(r.neededBy) : r.id.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        </aside>
        <section>
          {selected === 'new' ? (
            <NewRequest hospitalId={hospitalId} onCreated={setSelected} />
          ) : current ? (
            <RequestDetail request={current} />
          ) : null}
        </section>
      </div>
    </main>
  )
}

function NewRequest({ hospitalId, onCreated }: { hospitalId: string; onCreated: (id: string) => void }) {
  const { state, actions } = useStore()
  const hospital = state.facilities.find((f) => f.id === hospitalId)!
  const centres = useMemo(
    () =>
      state.facilities
        .filter((f) => f.kind === 'blood-centre')
        .map((c) => ({ c, km: distanceKm(c.location, hospital.location) }))
        .sort((a, b) => a.km - b.km),
    [state.facilities, hospital],
  )
  const [group, setGroup] = useState<BloodGroup>('B+')
  const [component, setComponent] = useState<Component>('red-cells')
  const [units, setUnits] = useState(1)
  const [hours, setHours] = useState(12)
  const [centreId, setCentreId] = useState(centres[0].c.id)
  const [raisedBy, setRaisedBy] = useState<'staff' | 'family'>('staff')
  const [slip, setSlip] = useState(false)

  const create = () => {
    const req: BloodRequest = {
      id: newId('req'),
      hospitalId,
      centreId,
      patientGroup: group,
      component,
      units,
      neededBy: new Date(Date.now() + hours * 3_600_000).toISOString(),
      raisedBy,
      slipVerified: raisedBy === 'family' ? slip : true,
      status: raisedBy === 'staff' || slip ? 'open' : 'awaiting-verification',
      createdAt: new Date().toISOString(),
      responses: [],
    }
    actions.addRequest(req)
    actions.log('request', `${hospital.name} raised a ${isRequestVerified(req) ? 'verified' : 'family'} request for ${units} unit(s) of ${group} ${componentLabel(component).toLowerCase()}`)
    onCreated(req.id)
  }

  return (
    <div className="card stack-lg">
      <h2>New blood request</h2>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="grp">Patient blood group</label>
          <select id="grp" className="input" value={group} onChange={(e) => setGroup(e.target.value as BloodGroup)}>
            {BLOOD_GROUPS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Component</label>
          <Seg
            label="Component"
            value={component}
            onChange={setComponent}
            options={[
              { value: 'red-cells', label: 'Red cells' },
              { value: 'platelets', label: 'Platelets' },
              { value: 'plasma', label: 'Plasma' },
            ]}
          />
        </div>
        <div className="field">
          <label htmlFor="units">Units needed</label>
          <input id="units" className="input num" type="number" min={1} max={6} value={units} onChange={(e) => setUnits(Math.max(1, Math.min(6, Number(e.target.value) || 1)))} />
        </div>
        <div className="field">
          <label htmlFor="hours">Needed within (hours)</label>
          <input id="hours" className="input num" type="number" min={1} max={72} value={hours} onChange={(e) => setHours(Math.max(1, Math.min(72, Number(e.target.value) || 1)))} />
        </div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="centre">Donors go to this licensed blood centre</label>
          <select id="centre" className="input" value={centreId} onChange={(e) => setCentreId(e.target.value)}>
            {centres.map(({ c, km }) => (
              <option key={c.id} value={c.id}>
                {c.name} · {km.toFixed(1)} km from you
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Raised by</label>
        <Seg
          label="Raised by"
          value={raisedBy}
          onChange={setRaisedBy}
          options={[
            { value: 'staff', label: 'Hospital staff' },
            { value: 'family', label: 'Patient’s family' },
          ]}
        />
      </div>
      {raisedBy === 'family' && (
        <label className="toggle">
          <input type="checkbox" checked={slip} onChange={(e) => setSlip(e.target.checked)} />
          <span className="small">Requisition slip uploaded and checked by hospital staff</span>
        </label>
      )}
      <Notice tone="blue">
        Asking donors with {compatibleDonorGroups(group, component).join(', ')}. The blood centre cross-matches before issue.
      </Notice>
      <button className="btn primary" onClick={create}>
        {raisedBy === 'family' && !slip ? 'Save for verification' : 'Raise verified request'}
      </button>
    </div>
  )
}

function RequestDetail({ request: r }: { request: BloodRequest }) {
  const { state, actions } = useStore()
  const result = matchFor(state, r)
  const verified = isRequestVerified(r)
  const responses = new Map(r.responses.map((x) => [x.donorId, x]))
  const arrived = r.responses.filter((x) => x.status === 'arrived').length
  const sent = r.responses.length > 0
  const now = () => new Date().toISOString()

  const sendAlerts = () => {
    if (!result) return
    for (const m of result.matches) {
      if (!responses.has(m.donorId)) actions.respond(r.id, { donorId: m.donorId, status: 'pinged', at: now() })
    }
    actions.updateRequest(r.id, { radiusKm: result.radiusKm })
    actions.log('request', `Alerted ${result.matches.length} matched donors within ${result.radiusKm} km for ${r.id}`)
  }

  const simulate = () => {
    if (!result) return
    result.matches.forEach((m, i) => {
      const prev = responses.get(m.donorId)
      if (prev && prev.status !== 'pinged') return
      const status = i % 3 === 1 ? 'declined' : 'accepted'
      actions.respond(r.id, { donorId: m.donorId, status, at: now() })
    })
  }

  return (
    <div className="stack-lg">
      <div className="card stack">
        <div className="row between" style={{ flexWrap: 'wrap' }}>
          <h2>
            {r.units} unit{r.units > 1 ? 's' : ''} of {r.patientGroup} {componentLabel(r.component).toLowerCase()}
          </h2>
          <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].text}</Badge>
        </div>
        <div className="kpis">
          <div className="kpi">
            <span className="label">Needed</span>
            <div className="v num" style={{ fontSize: 20 }}>{r.status === 'fulfilled' ? 'Done' : timeLeft(r.neededBy)}</div>
          </div>
          <div className="kpi">
            <span className="label">Donate at</span>
            <div className="small" style={{ fontWeight: 600, marginTop: 4 }}>{facilityName(state, r.centreId)}</div>
          </div>
          <div className="kpi">
            <span className="label">Arrived</span>
            <div className="v num">
              {arrived}/{r.units}
            </div>
          </div>
        </div>
        {!verified && r.status === 'awaiting-verification' && (
          <Notice tone="amber" title="Not sent to donors yet">
            This request came from the patient’s family. Check the requisition slip before donors are alerted.
            <div style={{ marginTop: 8 }}>
              <button
                className="btn sm dark"
                onClick={() => {
                  actions.updateRequest(r.id, { slipVerified: true, status: 'open' })
                  actions.log('request', `Staff verified the requisition slip for ${r.id}`)
                }}
              >
                Slip checked, verify request
              </button>
            </div>
          </Notice>
        )}
      </div>

      {verified && result && r.status !== 'cancelled' && (
        <div className="card stack">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <div>
              <h3>Matched donors</h3>
              <p className="small muted">
                Eligible today, compatible, opted in and within {result.radiusKm} km of the centre. Up to {result.cap} for {r.units} unit{r.units > 1 ? 's' : ''}.
              </p>
            </div>
            {r.status === 'open' && (
              <div className="row">
                <button className="btn primary sm" onClick={sendAlerts} disabled={result.matches.length === 0 || result.matches.every((m) => responses.has(m.donorId))}>
                  {sent ? 'Alert new matches' : `Alert ${result.matches.length} donors`}
                </button>
                {sent && (
                  <button className="btn sm" onClick={simulate}>
                    Simulate replies
                  </button>
                )}
              </div>
            )}
          </div>
          {result.matches.length === 0 ? (
            <Notice tone="amber">No eligible, compatible donors within 25 km right now. The blood centre’s stock and replacement routes still apply.</Notice>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Donor</th>
                    <th>Group</th>
                    <th>Distance</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {result.matches.map((m) => {
                    const resp = responses.get(m.donorId)
                    return (
                      <tr key={m.donorId}>
                        <td>{m.displayName}</td>
                        <td>{m.bloodGroup}</td>
                        <td className="num">{m.distanceKm} km</td>
                        <td>{resp ? <Badge tone={RESPONSE[resp.status].tone}>{RESPONSE[resp.status].text}</Badge> : <span className="small faint">Not alerted</span>}</td>
                        <td style={{ textAlign: 'right' }}>
                          {resp?.status === 'accepted' && r.status === 'open' && (
                            <button className="btn sm" onClick={() => actions.respond(r.id, { donorId: m.donorId, status: 'arrived', at: now() })}>
                              Mark arrived
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="tiny faint">
            Not asked: {result.excluded['not-eligible']} not eligible today, {result.excluded.incompatible} incompatible, {result.excluded['no-consent']} opted out,{' '}
            {result.excluded['unverified-group']} with unverified groups, {result.excluded['too-far']} farther away. Names and numbers stay masked; calls go through Donor Pass.
          </p>
          {r.status === 'open' && (
            <div className="row">
              <button
                className="btn dark"
                disabled={arrived < r.units}
                onClick={() => {
                  actions.updateRequest(r.id, { status: 'fulfilled' })
                  actions.log('request', `${r.id} fulfilled: ${arrived} donors arrived at ${facilityName(state, r.centreId)}`)
                }}
              >
                Mark fulfilled
              </button>
              <button className="btn ghost" onClick={() => actions.updateRequest(r.id, { status: 'cancelled' })}>
                Cancel request
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
