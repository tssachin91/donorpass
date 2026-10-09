import { Link } from 'react-router-dom'
import { useStore } from '../state/store'

const ROLES = [
  {
    to: '/donor',
    who: 'Donors',
    title: 'Donor app',
    tries: ['See when you can donate next', 'One timeline of donations and blood tests', 'Unlock the Donor Pass after 3 donations', 'Fill your form before you arrive'],
  },
  {
    to: '/hospital',
    who: 'Hospitals',
    title: 'Hospital console',
    tries: ['Raise a verified blood request', 'See matched donors, numbers masked', 'Track who is on the way'],
  },
  {
    to: '/centre',
    who: 'Blood centres',
    title: 'Centre desk',
    tries: ['Scan a donor’s front-door form', 'Record vitals and the medical officer’s decision', 'Redeem a Donor Pass fee waiver'],
  },
  {
    to: '/lab',
    who: 'Labs',
    title: 'Lab portal',
    tries: ['Map a lab export to standard records', 'Block infection-screening results', 'Deliver reports to donors with consent'],
  },
]

export function Landing() {
  const { state } = useStore()
  const open = state.requests.filter((r) => r.status === 'open').length
  return (
    <main className="page stack-lg">
      <section className="hero">
        <div>
          <span className="badge red">Mumbai pilot prototype</span>
          <h1 style={{ marginTop: 14 }}>Every donation, every blood test and every urgent request, in one place.</h1>
          <p className="lede">
            Donor Pass sits on top of e-RaktKosh and ABDM. It gives donors their full blood-health record and a portable benefit, and gives
            hospitals and labs a verified, consent-based way to work with them.
          </p>
          <div className="row" style={{ marginTop: 22, flexWrap: 'wrap' }}>
            <Link className="btn primary" to="/donor">
              Open the donor app
            </Link>
            <Link className="btn" to="/hospital">
              Hospital console · {open} open request{open === 1 ? '' : 's'}
            </Link>
          </div>
        </div>
        <svg className="drop-art" viewBox="0 0 320 320" role="img" aria-label="Blood drop made of records">
          <path d="M160 18c48 66 96 112 96 170a96 96 0 1 1-192 0c0-58 48-104 96-170z" fill="var(--red-soft)" stroke="var(--red)" strokeWidth="2" />
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <rect x={112} y={124 + i * 28} width={100 - (i % 2) * 22} height={14} rx={7} fill={i === 0 ? 'var(--red)' : 'var(--card)'} stroke="var(--line-2)" />
              <circle cx={100} cy={131 + i * 28} r={5} fill={i < 3 ? 'var(--red)' : 'var(--line-2)'} />
            </g>
          ))}
        </svg>
      </section>

      <section className="roles" aria-label="Try each part">
        {ROLES.map((r) => (
          <Link key={r.to} to={r.to} className="card role">
            <span className="who">{r.who}</span>
            <h2>{r.title}</h2>
            <ul>
              {r.tries.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Link>
        ))}
      </section>

      <section className="card flat stack">
        <h3>About this demo</h3>
        <p className="muted small">
          All people and organisations are fictional and all data stays in your browser. Eligibility follows NBTC donor selection guidelines; the blood
          centre’s medical officer always makes the final decision. e-RaktKosh and ABDM connections are simulated. Infection-screening results are never
          shown in the app. No one pays or is paid for blood.
        </p>
        <p className="small">
          <Link to="/data">See the open data model →</Link>
        </p>
      </section>
    </main>
  )
}
