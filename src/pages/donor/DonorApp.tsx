import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useDonorSelection } from '../../App'
import { formatDate } from '../../core/dates'
import type { Donor } from '../../core/types'
import { eligibilityFor, passFor, requestsForDonor, timelineFor } from '../../state/selectors'
import { useStore } from '../../state/store'
import { Badge, Notice, QR, typeLabel } from '../../ui'
import { DonorForm, DonorMe, DonorRequests } from './DonorActions'
import { DonorHealth, DonorTimeline, DonorUpload } from './DonorRecords'

const FEATURED: Record<string, string> = {
  'd-priya': 'Eligible today, Donor Pass active, haemoglobin trending down',
  'd-arjun': 'Platelet donor, O-negative, whole blood on hold after apheresis',
  'd-sneha': 'New donor, 1 of 3 towards the Donor Pass, waiting period',
  'd-rahul': 'Deferred for a recent tattoo',
  'd-fatima': 'Blood group not yet verified; requests switched off',
}

const Icon = ({ d }: { d: string }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
)

function TabBar({ alerts }: { alerts: number }) {
  const tabs = [
    { to: '/donor', label: 'Home', d: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', end: true },
    { to: '/donor/timeline', label: 'Timeline', d: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
    { to: '/donor/health', label: 'Health', d: 'M3 12h4l3-8 4 16 3-8h4' },
    { to: '/donor/requests', label: 'Requests', d: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0' },
    { to: '/donor/me', label: 'Me', d: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  ]
  return (
    <nav className="tabbar" aria-label="Donor app">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end}>
          <Icon d={t.d} />
          {t.label}
          {t.label === 'Requests' && alerts > 0 && <span className="dot" aria-label={`${alerts} new`} />}
        </NavLink>
      ))}
    </nav>
  )
}

function SideNotes({ donor }: { donor: Donor }) {
  const { state } = useStore()
  const { setDonorId } = useDonorSelection()
  const loc = useLocation()
  const notes: Record<string, string[]> = {
    '/donor': [
      'Eligibility is calculated from NBTC intervals, logged deferrals and recent haemoglobin and iron results.',
      'Advisories never block: the centre tests haemoglobin on the day and the medical officer decides.',
      'The Donor Pass counts only verified donations, read from e-RaktKosh or recorded at a partner centre.',
    ],
    '/donor/timeline': [
      'Each entry shows where it came from, so donors can tell verified records from their own uploads.',
      'Infection-screening results are never shown; the centre contacts the donor confidentially if needed.',
    ],
    '/donor/health': ['Lab results arrive through ABDM or the Donor Pass sync connector, only with the donor’s consent.', 'Values are shown with the lab’s reference range; the app does not diagnose.'],
    '/donor/requests': ['Only verified requests reach donors.', 'Donors who are eligible today, compatible and nearby are alerted, at most 10 per unit.', 'Donors go to the blood centre, never to the family; numbers stay masked.'],
    '/donor/me': ['Consent is separate for each purpose and can be withdrawn at any time.', 'Export gives the donor their records in the open FHIR format.'],
    '/donor/form': ['Identity is pre-filled; every screening question is answered fresh.', 'The QR code hands the answers to the centre desk, which pulls them into its own system.'],
  }
  const key = Object.keys(notes).find((k) => loc.pathname === k) ?? '/donor'
  return (
    <aside className="side-notes">
      <div className="card stack">
        <span className="label">Viewing as</span>
        <select className="input" value={donor.id} onChange={(e) => setDonorId(e.target.value)} aria-label="Choose a sample donor">
          <optgroup label="Featured">
            {Object.keys(FEATURED).map((id) => (
              <option key={id} value={id}>
                {state.donors.find((d) => d.id === id)?.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Other sample donors">
            {state.donors
              .filter((d) => !FEATURED[d.id])
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} · {d.bloodGroup}
                </option>
              ))}
          </optgroup>
        </select>
        {FEATURED[donor.id] && <p className="small muted">{FEATURED[donor.id]}</p>}
      </div>
      <div className="card flat stack">
        <span className="label">What is happening here</span>
        <ul className="small muted" style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notes[key].map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
    </aside>
  )
}

export function DonorApp() {
  const { state } = useStore()
  const { donorId } = useDonorSelection()
  const donor = state.donors.find((d) => d.id === donorId) ?? state.donors[0]
  const alerts = requestsForDonor(state, donor.id).length

  return (
    <main className="page">
      <div className="phone-stage">
        <div className="phone" aria-label="Donor app preview">
          <div className="phone-top">
            <div className="row" style={{ gap: 8 }}>
              <strong>Hi {donor.name.split(' ')[0]}</strong>
            </div>
            <Badge tone={donor.bloodGroupVerified ? 'green' : 'amber'}>
              {donor.bloodGroup} · {donor.bloodGroupVerified ? 'verified' : 'unverified'}
            </Badge>
          </div>
          <div className="phone-body">
            <Routes>
              <Route index element={<DonorHome donor={donor} />} />
              <Route path="timeline" element={<DonorTimeline donor={donor} />} />
              <Route path="health" element={<DonorHealth donor={donor} />} />
              <Route path="upload" element={<DonorUpload donor={donor} />} />
              <Route path="requests" element={<DonorRequests donor={donor} />} />
              <Route path="me" element={<DonorMe donor={donor} />} />
              <Route path="form" element={<DonorForm donor={donor} />} />
              <Route path="pass" element={<DonorPassScreen donor={donor} />} />
            </Routes>
          </div>
          <TabBar alerts={alerts} />
        </div>
        <SideNotes donor={donor} />
      </div>
    </main>
  )
}

function DonorHome({ donor }: { donor: Donor }) {
  const { state } = useStore()
  const elig = eligibilityFor(state, donor)
  const pass = passFor(state, donor.id)
  const alerts = requestsForDonor(state, donor.id)
  const latest = timelineFor(state, donor.id)[0]
  const tone = { eligible: 'ok', wait: 'wait', deferred: 'deferred', ineligible: 'no' }[elig.status]

  return (
    <>
      <section className={`elig ${tone}`} aria-live="polite">
        <div className="ring" />
        <div className="tiny" style={{ opacity: 0.8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {typeLabel(elig.type)}
        </div>
        {elig.status === 'eligible' && <div className="big">You can donate today</div>}
        {elig.status === 'wait' && elig.eligibleFrom && (
          <div className="big">
            Eligible from {formatDate(elig.eligibleFrom)}
          </div>
        )}
        {elig.status === 'deferred' && elig.eligibleFrom && <div className="big">On hold until {formatDate(elig.eligibleFrom)}</div>}
        {elig.status === 'ineligible' && <div className="big">Not eligible to donate</div>}
        <div className="sub">
          {elig.status === 'eligible'
            ? `Suggested collection ${elig.volumeMl} ml. The centre checks you on the day.`
            : elig.status === 'ineligible'
              ? elig.reasons[0]
              : `${elig.daysToWait} days to go. ${elig.reasons[0] ?? ''}`}
        </div>
      </section>

      {elig.advisories.map((a) => (
        <Notice key={a} tone="amber" title="Before you go">
          {a}
        </Notice>
      ))}

      <Link className="btn primary block" to="/donor/form">
        Going to donate? Fill your form first
      </Link>

      {alerts.length > 0 && (
        <Link to="/donor/requests" className="card tight" style={{ textDecoration: 'none', borderColor: 'var(--red)' }}>
          <div className="row between">
            <strong>{alerts.length} verified request{alerts.length > 1 ? 's' : ''} near you</strong>
            <Badge tone="red">Urgent</Badge>
          </div>
          <p className="small muted">A nearby hospital needs your blood group. See details →</p>
        </Link>
      )}

      <Link to="/donor/pass" className="card tight stack" style={{ textDecoration: 'none', gap: 10 }}>
        <div className="row between">
          <h3>Donor Pass</h3>
          <Badge tone={pass.status === 'active' ? 'green' : pass.status === 'expired' ? 'amber' : ''}>
            {pass.status === 'active' ? 'Active' : pass.status === 'expired' ? 'Expired' : `${Math.min(pass.count, pass.needed)} of ${pass.needed}`}
          </Badge>
        </div>
        {pass.status === 'active' ? (
          <p className="small muted">
            Valid until {formatDate(pass.validUntil!)} · {pass.waiversLeft} fee waiver{pass.waiversLeft === 1 ? '' : 's'} left for you or family
          </p>
        ) : (
          <>
            <div className="pass-dots" aria-hidden="true">
              {Array.from({ length: pass.needed }, (_, i) => (
                <span key={i} className={i < pass.count ? 'done' : ''}>
                  {i + 1}
                </span>
              ))}
            </div>
            <p className="small muted">
              {pass.status === 'expired'
                ? 'Donate again to renew your pass.'
                : `${pass.needed - pass.count} more verified donation${pass.needed - pass.count === 1 ? '' : 's'} unlock a yearly processing-fee waiver for you and your family.`}
            </p>
          </>
        )}
      </Link>

      {latest && (
        <Link to="/donor/timeline" className="card tight" style={{ textDecoration: 'none' }}>
          <span className="label">Latest record</span>
          <p style={{ marginTop: 4 }}>
            {latest.kind === 'donation'
              ? `${typeLabel(latest.item.type)} donation`
              : latest.kind === 'test'
                ? 'New test result'
                : 'Deferral recorded'}{' '}
            · {formatDate(latest.date)}
          </p>
        </Link>
      )}
    </>
  )
}

function DonorPassScreen({ donor }: { donor: Donor }) {
  const { state } = useStore()
  const pass = passFor(state, donor.id)
  return (
    <div className="stack">
      <Link to="/donor" className="small">
        ← Back
      </Link>
      <h2>Donor Pass</h2>
      {pass.status === 'active' ? (
        <div className="card stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          <QR value={`DPASS:${donor.id}:${pass.validUntil}`} label="Donor Pass code for the centre to scan" />
          <div>
            <strong>{donor.name}</strong>
            <p className="small muted">
              Active until {formatDate(pass.validUntil!)} · {pass.waiversLeft} waiver{pass.waiversLeft === 1 ? '' : 's'} left
            </p>
          </div>
          <p className="small muted">Show this at any partner blood centre to waive the processing fee for one unit and get priority issue.</p>
        </div>
      ) : (
        <Notice tone="blue" title={pass.status === 'expired' ? 'Your pass has expired' : `${pass.count} of ${pass.needed} verified donations`}>
          {pass.status === 'expired'
            ? 'A verified donation renews it for another 12 months.'
            : 'Three verified donations within 24 months unlock the pass.'}
        </Notice>
      )}
      <div className="card flat stack">
        <h3>Who it covers</h3>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>You</li>
          {donor.family.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <p className="tiny faint">
          The pass waives the processing fee and gives priority issue. It never reserves a unit of blood, and no one is paid for donating.
        </p>
      </div>
    </div>
  )
}
