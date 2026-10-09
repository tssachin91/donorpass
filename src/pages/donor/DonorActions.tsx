import { useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate } from '../../core/dates'
import { donorBundle } from '../../core/fhir'
import { maskPhone } from '../../core/matching'
import { allAnswered, flaggedAnswers, SCREENING_QUESTIONS } from '../../core/screening'
import type { Consents, Donor, DonationType, FrontDoorForm } from '../../core/types'
import { eligibilityFor, facilityName, requestsForDonor } from '../../state/selectors'
import { useStore } from '../../state/store'
import { Badge, Empty, Notice, QR, Seg, Toggle, componentLabel, timeLeft, typeLabel } from '../../ui'

export function DonorRequests({ donor }: { donor: Donor }) {
  const { state, actions } = useStore()
  const items = requestsForDonor(state, donor.id)
  const elig = eligibilityFor(state, donor)

  if (items.length === 0) {
    const why = !donor.consents.requests
      ? 'You have switched off blood requests. Turn them on in Me to help nearby patients.'
      : !donor.bloodGroupVerified
        ? 'Your blood group is not verified yet, so you are not matched to requests. A centre confirms it when you next donate.'
        : elig.status !== 'eligible'
          ? 'You are not eligible to donate today, so you will not be asked. We will let you know when you are.'
          : 'No verified requests near you need your blood group right now.'
    return (
      <div className="stack">
        <h2>Requests</h2>
        <Empty title="No requests for you">{why}</Empty>
      </div>
    )
  }

  return (
    <div className="stack">
      <h2>Requests</h2>
      {items.map(({ request: r, match }) => {
        const mine = r.responses.find((x) => x.donorId === donor.id)
        const accepted = mine?.status === 'accepted' || mine?.status === 'arrived'
        return (
          <div className="card tight stack" key={r.id}>
            <div className="row between">
              <Badge tone="red">
                {r.patientGroup} · {componentLabel(r.component)}
              </Badge>
              <span className="tiny faint">{timeLeft(r.neededBy)}</span>
            </div>
            <div>
              <strong>{facilityName(state, r.hospitalId)}</strong>
              <p className="small muted">
                Needs {r.units} unit{r.units > 1 ? 's' : ''}. Donate at <strong>{facilityName(state, r.centreId)}</strong>, {match.distanceKm} km away.
              </p>
            </div>
            <Badge tone="green">Verified by hospital staff</Badge>
            {accepted ? (
              <Notice tone="green" title="Thank you. You’re expected.">
                Go to {facilityName(state, r.centreId)} and show your front-door form. Ref {r.id.toUpperCase()}.
                <div className="row" style={{ marginTop: 8 }}>
                  <Link className="btn sm" to="/donor/form">
                    Fill my form
                  </Link>
                  <button className="btn sm ghost" onClick={() => alert('Demo: this would connect you to the hospital desk through a masked number.')}>
                    Call hospital desk
                  </button>
                </div>
              </Notice>
            ) : mine?.status === 'declined' ? (
              <p className="small muted">You said not this time. Thank you for letting them know.</p>
            ) : (
              <div className="row">
                <button
                  className="btn primary grow"
                  onClick={() => {
                    actions.respond(r.id, { donorId: donor.id, status: 'accepted', at: new Date().toISOString() })
                    actions.log('request', `${donor.name.split(' ')[0]} accepted request ${r.id}`)
                  }}
                >
                  I can go
                </button>
                <button className="btn grow" onClick={() => actions.respond(r.id, { donorId: donor.id, status: 'declined', at: new Date().toISOString() })}>
                  Not this time
                </button>
              </div>
            )}
          </div>
        )
      })}
      <p className="tiny faint">Your name and number are never shared with the family. No one pays or is paid for blood.</p>
    </div>
  )
}

export function DonorForm({ donor }: { donor: Donor }) {
  const { state, actions } = useStore()
  const existing = state.forms.find((f) => f.donorId === donor.id && f.createdAt.slice(0, 10) === state.today && f.status !== 'deferred')
  const [type, setType] = useState<DonationType>('whole-blood')
  const [answers, setAnswers] = useState<Record<string, boolean>>({})
  const [step, setStep] = useState<'identity' | 'questions'>('identity')
  const elig = eligibilityFor(state, donor, type)

  if (existing) {
    const flagged = flaggedAnswers(existing.answers)
    return (
      <div className="stack">
        <h2>Your form is ready</h2>
        <div className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <QR value={`DPFORM:${existing.token}`} label="Front-door form code for the centre desk" />
          <div>
            <p className="code">{existing.token}</p>
            <p className="small muted">Show this at the counter today. The centre pulls your answers into its own system.</p>
          </div>
          <Badge tone={existing.status === 'approved' ? 'green' : existing.status === 'pulled' ? 'blue' : ''}>
            {existing.status === 'submitted' ? 'Waiting at the counter' : existing.status === 'pulled' ? 'Being checked by the centre' : 'Donation recorded'}
          </Badge>
        </div>
        {flagged.length > 0 && (
          <Notice tone="amber" title="You answered yes to some questions">
            The medical officer will talk to you about them. A yes does not mean you cannot donate.
          </Notice>
        )}
        <p className="tiny faint">Open the Blood centre desk in the menu to see the other side of this hand-over.</p>
      </div>
    )
  }

  const submit = () => {
    const form: FrontDoorForm = {
      token: `DP-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      donorId: donor.id,
      createdAt: new Date().toISOString(),
      intendedType: type,
      answers,
      status: 'submitted',
    }
    actions.upsertForm(form)
    actions.log('centre', `${donor.name} submitted a front-door form (${typeLabel(type)})`)
  }

  return (
    <div className="stack">
      <h2>Front-door form</h2>
      {step === 'identity' ? (
        <>
          <p className="small muted">Fill this before you leave home so the counter takes minutes, not paperwork.</p>
          <div className="card tight stack">
            <span className="label">Pre-filled from your profile</span>
            {[
              ['Name', donor.name],
              ['Date of birth', formatDate(donor.birthDate)],
              ['Sex', donor.sex === 'male' ? 'Male' : 'Female'],
              ['Phone', maskPhone(donor.phone)],
              ['Area', donor.location.area],
              ['Blood group', `${donor.bloodGroup}${donor.bloodGroupVerified ? '' : ' (to be confirmed)'}`],
            ].map(([k, v]) => (
              <div key={k} className="row between small">
                <span className="muted">{k}</span>
                <strong>{v}</strong>
              </div>
            ))}
            <span className="tiny faint">Something wrong? The centre corrects it against your photo ID.</span>
          </div>
          <div className="field">
            <label>What are you donating?</label>
            <Seg
              label="Donation type"
              value={type}
              onChange={setType}
              options={[
                { value: 'whole-blood', label: 'Whole blood' },
                { value: 'platelets', label: 'Platelets' },
                { value: 'plasma', label: 'Plasma' },
              ]}
            />
          </div>
          {elig.status !== 'eligible' && (
            <Notice tone="amber" title="Check your date">
              {elig.status === 'ineligible' ? elig.reasons[0] : `Our records suggest ${formatDate(elig.eligibleFrom!)}. You can still fill the form; the centre decides.`}
            </Notice>
          )}
          <button className="btn primary" onClick={() => setStep('questions')}>
            Continue to health questions
          </button>
        </>
      ) : (
        <>
          <p className="small muted">Answer every question for today. These are never pre-filled.</p>
          <div className="card tight">
            {SCREENING_QUESTIONS.map((q) => (
              <div className="q" key={q.id}>
                <span className="small">{q.text}</span>
                <div className="yn" role="radiogroup" aria-label={q.text}>
                  <button type="button" role="radio" aria-checked={answers[q.id] === true} className={answers[q.id] === true ? 'yes' : ''} onClick={() => setAnswers({ ...answers, [q.id]: true })}>
                    Yes
                  </button>
                  <button type="button" role="radio" aria-checked={answers[q.id] === false} className={answers[q.id] === false ? 'no' : ''} onClick={() => setAnswers({ ...answers, [q.id]: false })}>
                    No
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="row">
            <button className="btn" onClick={() => setStep('identity')}>
              Back
            </button>
            <button className="btn primary grow" disabled={!allAnswered(answers)} onClick={submit}>
              {allAnswered(answers) ? 'Get my QR code' : `${SCREENING_QUESTIONS.filter((q) => typeof answers[q.id] !== 'boolean').length} questions left`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const CONSENT_TEXT: Array<{ key: keyof Consents; label: string; hint: string }> = [
  { key: 'records', label: 'Keep my records', hint: 'Donations and test results in one timeline' },
  { key: 'reminders', label: 'Reminders', hint: 'When I am eligible, and when nearby stock of my group is low' },
  { key: 'requests', label: 'Blood requests', hint: 'Verified requests from nearby hospitals; my number stays masked' },
  { key: 'labSharing', label: 'Lab sharing', hint: 'Let partner labs send my blood test reports here' },
  { key: 'insurer', label: 'Insurer wellness', hint: 'Share active-donor status with a partner insurer (pilot)' },
]

export function DonorMe({ donor }: { donor: Donor }) {
  const { state, actions } = useStore()
  const exportData = () => {
    const bundle = donorBundle(donor, state.donations, state.observations)
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/fhir+json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${donor.id}-records.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return (
    <div className="stack">
      <h2>Me</h2>
      <div className="card tight stack" style={{ gap: 6 }}>
        <strong>{donor.name}</strong>
        <span className="small muted">
          {donor.location.area} · {maskPhone(donor.phone)}
        </span>
        <span className="small muted">ABHA: {donor.abhaAddress ?? 'not linked'}</span>
        {!donor.abhaAddress && (
          <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => alert('Demo: this would start ABHA linking through ABDM.')}>
            Link ABHA
          </button>
        )}
      </div>
      <div className="card tight stack">
        <span className="label">What I share</span>
        {CONSENT_TEXT.map((c) => (
          <Toggle
            key={c.key}
            label={c.label}
            hint={c.hint}
            checked={donor.consents[c.key]}
            onChange={(v) => {
              actions.setConsents(donor.id, { ...donor.consents, [c.key]: v })
              actions.log('abdm', `${donor.name.split(' ')[0]} turned ${v ? 'on' : 'off'} consent: ${c.label}`)
            }}
          />
        ))}
      </div>
      <div className="card tight stack">
        <span className="label">My data</span>
        <button className="btn" onClick={exportData}>
          Download my records (FHIR)
        </button>
        <button className="btn ghost" onClick={() => alert('Demo: in the real app this deletes your Donor Pass data. Records held by blood centres and labs stay with them.')}>
          Delete my Donor Pass data
        </button>
      </div>
    </div>
  )
}
