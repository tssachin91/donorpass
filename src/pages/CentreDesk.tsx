import { useEffect, useRef, useState } from 'react'
import { CODES } from '../core/codes'
import { addDays, formatDate } from '../core/dates'
import { checkEligibility } from '../core/eligibility'
import { maskPhone } from '../core/matching'
import { flaggedAnswers, vitalsIssues } from '../core/screening'
import type { Donor, FrontDoorForm, Vitals } from '../core/types'
import { facilityName, passFor } from '../state/selectors'
import { newId, useStore } from '../state/store'
import { Badge, Notice, typeLabel } from '../ui'

export function CentreDesk() {
  const { state } = useStore()
  const centres = state.facilities.filter((f) => f.kind === 'blood-centre')
  const [centreId, setCentreId] = useState(centres[0].id)
  const [token, setToken] = useState('')
  const [open, setOpen] = useState<string>()
  const todays = state.forms.filter((f) => f.createdAt.slice(0, 10) === state.today)
  const form = state.forms.find((f) => f.token === open)

  return (
    <main className="page stack-lg">
      <div className="section-head">
        <div>
          <h1 style={{ fontSize: 32 }}>Blood centre desk</h1>
          <p className="muted">Pull a donor’s front-door form, record vitals and the medical officer’s decision, and redeem Donor Passes.</p>
        </div>
        <div className="field" style={{ minWidth: 280 }}>
          <label htmlFor="centre-sel">Centre</label>
          <select id="centre-sel" className="input" value={centreId} onChange={(e) => setCentreId(e.target.value)}>
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="console">
        <aside className="stack">
          <div className="card tight stack">
            <span className="label">Scan or type the code</span>
            <div className="row">
              <input className="input code" placeholder="DP-XXXX-XXXX" value={token} onChange={(e) => setToken(e.target.value.toUpperCase())} aria-label="Form code" />
              <button
                className="btn dark"
                onClick={() => {
                  const t = token.replace(/^DPFORM:/, '').trim()
                  if (state.forms.some((f) => f.token === t)) setOpen(t)
                  else alert('No form found with that code.')
                }}
              >
                Open
              </button>
            </div>
          </div>
          <span className="label">Today’s forms</span>
          {todays.length === 0 ? (
            <p className="small muted">
              No forms yet. Open the donor app, choose “Fill your form first”, and the form appears here.
            </p>
          ) : (
            <div className="list">
              {todays.map((f) => {
                const d = state.donors.find((x) => x.id === f.donorId)!
                return (
                  <button key={f.token} className={`list-item ${open === f.token ? 'on' : ''}`} onClick={() => setOpen(f.token)}>
                    <div className="row between">
                      <strong>{d.name}</strong>
                      <Badge tone={f.status === 'approved' ? 'green' : f.status === 'deferred' ? 'amber' : f.status === 'pulled' ? 'blue' : ''}>{f.status}</Badge>
                    </div>
                    <span className="small muted code">{f.token}</span>
                  </button>
                )
              })}
            </div>
          )}
        </aside>
        <section className="stack-lg">
          {form ? <FormReview key={form.token} form={form} centreId={centreId} /> : <Notice tone="blue">Select a form to start the check-in.</Notice>}
          <PassRedemption centreId={centreId} />
        </section>
      </div>
    </main>
  )
}

function FormReview({ form, centreId }: { form: FrontDoorForm; centreId: string }) {
  const { state, actions } = useStore()
  const donor = state.donors.find((d) => d.id === form.donorId) as Donor
  const flagged = flaggedAnswers(form.answers)
  const elig = checkEligibility({ donor, donations: state.donations, deferrals: state.deferrals, observations: state.observations, today: state.today, type: form.intendedType })
  const [v, setV] = useState<Vitals>(form.vitals ?? { weightKg: donor.weightKg, hb: 13.2, bpSys: 118, bpDia: 76, pulse: 74 })
  const [deferReason, setDeferReason] = useState('Low haemoglobin on the day')
  const [deferDays, setDeferDays] = useState(30)
  const issues = vitalsIssues(v)
  const done = form.status === 'approved' || form.status === 'deferred'

  const pulled = useRef(false)
  useEffect(() => {
    // Opening the form is the hand-over moment: the centre's own system takes the answers.
    if (form.status !== 'submitted' || pulled.current) return
    pulled.current = true
    actions.updateForm(form.token, { status: 'pulled', centreId })
    actions.log('centre', `${facilityName(state, centreId)} pulled ${donor.name}'s form into its system (simulated e-RaktKosh donor registration)`)
    // Runs once per opened form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.token])

  const approve = () => {
    const vol = form.intendedType === 'whole-blood' ? (v.weightKg >= 55 ? 450 : 350) : 250
    actions.recordVitals(form.token, v)
    actions.addDonation({ id: newId('don'), donorId: donor.id, date: state.today, type: form.intendedType, centreId, volumeMl: vol, verified: true, source: 'centre-desk' })
    actions.addObservations([
      { id: newId('obs'), donorId: donor.id, code: CODES.hb, date: state.today, value: v.hb, unit: 'g/dL', refLow: 12, refHigh: 17, source: 'centre-desk', verified: true },
    ])
    actions.updateForm(form.token, { status: 'approved', decisionNote: 'Approved by medical officer' })
    actions.log('e-raktkosh', `Recorded ${typeLabel(form.intendedType).toLowerCase()} donation for ${donor.name}; pushed to e-RaktKosh (simulated)`)
  }

  const defer = () => {
    actions.recordVitals(form.token, v)
    actions.addDeferral({ id: newId('def'), donorId: donor.id, reason: deferReason, from: state.today, until: addDays(state.today, deferDays - 1), source: 'centre-desk' })
    actions.updateForm(form.token, { status: 'deferred', decisionNote: deferReason })
    actions.log('centre', `${donor.name} deferred for ${deferDays} days: ${deferReason}`)
  }

  const num = (k: keyof Vitals) => (
    <div className="field">
      <label htmlFor={`v-${k}`}>{{ weightKg: 'Weight (kg)', hb: 'Hb (g/dL)', bpSys: 'BP systolic', bpDia: 'BP diastolic', pulse: 'Pulse' }[k]}</label>
      <input id={`v-${k}`} className="input num" inputMode="decimal" disabled={done} value={v[k]} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) || 0 })} />
    </div>
  )

  return (
    <div className="card stack-lg">
      <div className="row between" style={{ flexWrap: 'wrap' }}>
        <div>
          <h2>{donor.name}</h2>
          <p className="small muted">
            {typeLabel(form.intendedType)} · {donor.sex === 'male' ? 'Male' : 'Female'} · born {formatDate(donor.birthDate)} · {maskPhone(donor.phone)}
          </p>
        </div>
        <Badge tone={donor.bloodGroupVerified ? 'green' : 'amber'}>
          {donor.bloodGroup} {donor.bloodGroupVerified ? 'verified' : 'to confirm by grouping'}
        </Badge>
      </div>

      <div className="grid-2">
        <div className="stack">
          <span className="label">Screening answers</span>
          {flagged.length === 0 ? (
            <Notice tone="green">All answers “no”. Nothing flagged.</Notice>
          ) : (
            <Notice tone="amber" title={`${flagged.length} answer${flagged.length > 1 ? 's' : ''} to discuss`}>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {flagged.map((q) => (
                  <li key={q.id}>{q.staffNote}</li>
                ))}
              </ul>
            </Notice>
          )}
        </div>
        <div className="stack">
          <span className="label">Records check</span>
          {done ? (
            <Notice tone="green">Checked at intake.</Notice>
          ) : elig.status === 'eligible' ? (
            <Notice tone="green">Interval and deferral checks pass for {typeLabel(form.intendedType).toLowerCase()}.</Notice>
          ) : (
            <Notice tone="amber">{elig.reasons.join(' ')}</Notice>
          )}
          {!done && elig.advisories.map((a) => (
            <p key={a} className="small muted">
              {a}
            </p>
          ))}
        </div>
      </div>

      <div className="stack">
        <span className="label">Vitals on the day</span>
        <div className="grid-3" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
          {num('weightKg')}
          {num('hb')}
          {num('bpSys')}
          {num('bpDia')}
          {num('pulse')}
        </div>
        {issues.length > 0 && <Notice tone="amber">{issues.join('. ')}.</Notice>}
      </div>

      {done ? (
        <Notice tone={form.status === 'approved' ? 'green' : 'amber'} title={form.status === 'approved' ? 'Donation recorded' : 'Donor deferred'}>
          {form.status === 'approved'
            ? 'Added to the donor’s timeline as centre-verified and counted towards their Donor Pass. Pushed to e-RaktKosh (simulated).'
            : `${form.decisionNote}. The donor sees the date they can return.`}
        </Notice>
      ) : (
        <div className="grid-2">
          <div className="card flat stack">
            <h3>Medical officer approves</h3>
            <button className="btn primary" onClick={approve} disabled={issues.length > 0 || elig.status !== 'eligible'}>
              Approve and record donation
            </button>
            {(issues.length > 0 || elig.status !== 'eligible') && <p className="tiny faint">Resolve the flagged checks or defer the donor.</p>}
          </div>
          <div className="card flat stack">
            <h3>Or defer</h3>
            <input className="input" value={deferReason} onChange={(e) => setDeferReason(e.target.value)} aria-label="Deferral reason" />
            <div className="row">
              <input className="input num" style={{ width: 90 }} type="number" min={1} value={deferDays} onChange={(e) => setDeferDays(Math.max(1, Number(e.target.value) || 1))} aria-label="Days" />
              <span className="small muted">days</span>
              <button className="btn grow" onClick={defer}>
                Defer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PassRedemption({ centreId }: { centreId: string }) {
  const { state, actions } = useStore()
  const active = state.donors.filter((d) => passFor(state, d.id).status === 'active')
  const [donorId, setDonorId] = useState(active[0]?.id ?? '')
  const [who, setWho] = useState('Self')
  const donor = state.donors.find((d) => d.id === donorId)
  const pass = donor ? passFor(state, donor.id) : undefined

  return (
    <div className="card stack">
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div>
          <h3>Redeem a Donor Pass</h3>
          <p className="small muted">Scan the donor’s pass QR. In this demo, pick a donor with an active pass.</p>
        </div>
      </div>
      {active.length === 0 ? (
        <p className="small muted">No active passes in the sample data.</p>
      ) : (
        <div className="grid-2">
          <div className="field">
            <label htmlFor="pass-donor">Pass holder</label>
            <select id="pass-donor" className="input" value={donorId} onChange={(e) => setDonorId(e.target.value)}>
              {active.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pass-who">Unit issued for</label>
            <select id="pass-who" className="input" value={who} onChange={(e) => setWho(e.target.value)}>
              <option>Self</option>
              {donor?.family.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      {donor && pass && (
        <div className="row between" style={{ flexWrap: 'wrap', gap: 12 }}>
          <span className="small">
            Valid until {formatDate(pass.validUntil!)} · <strong>{pass.waiversLeft}</strong> waiver{pass.waiversLeft === 1 ? '' : 's'} left
          </span>
          <button
            className="btn dark"
            disabled={pass.waiversLeft < 1}
            onClick={() => {
              actions.redeem({ id: newId('red'), donorId: donor.id, date: state.today, centreId, beneficiary: who })
              actions.log('pass', `${facilityName(state, centreId)} waived the processing fee for ${who === 'Self' ? donor.name : who} (Donor Pass of ${donor.name})`)
            }}
          >
            Waive processing fee
          </button>
        </div>
      )}
      <p className="tiny faint">The pass waives the processing fee and gives priority issue. It does not reserve a unit and involves no payment to the donor.</p>
    </div>
  )
}
