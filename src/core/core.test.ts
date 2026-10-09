import { describe, expect, it } from 'vitest'
import { compatibleDonorGroups, isCompatible } from './compatibility'
import { addDays, addMonths, ageOn } from './dates'
import { donorPassState } from './donorPass'
import { checkEligibility } from './eligibility'
import { donorBundle } from './fhir'
import { mapLabRows, parseLabCsv } from './labMapping'
import { distanceKm, maskName, maskPhone, matchDonors } from './matching'
import { allAnswered, flaggedAnswers, SCREENING_QUESTIONS, vitalsIssues } from './screening'
import type { BloodRequest, Donation, Donor, Facility, Observation } from './types'

const TODAY = '2026-10-09'

const donor = (over: Partial<Donor> = {}): Donor => ({
  id: 'd1',
  name: 'Priya Sharma',
  phone: '+919876543210',
  sex: 'female',
  birthDate: '1995-03-12',
  weightKg: 58,
  bloodGroup: 'B+',
  bloodGroupVerified: true,
  location: { lat: 19.1136, lng: 72.8697, area: 'Andheri East' },
  language: 'en',
  consents: { records: true, reminders: true, requests: true, labSharing: true, insurer: false },
  family: [],
  ...over,
})

const donation = (date: string, over: Partial<Donation> = {}): Donation => ({
  id: `don-${date}`,
  donorId: 'd1',
  date,
  type: 'whole-blood',
  centreId: 'c1',
  volumeMl: 450,
  verified: true,
  source: 'e-raktkosh',
  ...over,
})

describe('dates', () => {
  it('adds days and months safely', () => {
    expect(addDays('2026-10-09', 90)).toBe('2027-01-07')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(ageOn('2008-10-10', TODAY)).toBe(17)
    expect(ageOn('2008-10-09', TODAY)).toBe(18)
  })
})

describe('eligibility', () => {
  const base = { deferrals: [], observations: [], today: TODAY }

  it('uses 120 days for women and 90 days for men after whole blood', () => {
    const last = addDays(TODAY, -100)
    const f = checkEligibility({ ...base, donor: donor(), donations: [donation(last)] })
    expect(f.status).toBe('wait')
    expect(f.eligibleFrom).toBe(addDays(last, 120))
    expect(f.daysToWait).toBe(20)

    const m = checkEligibility({ ...base, donor: donor({ sex: 'male' }), donations: [donation(last)] })
    expect(m.status).toBe('eligible')
    expect(m.reasons).toEqual([])
  })

  it('allows apheresis 28 days after whole blood and 48 hours after apheresis', () => {
    const d = donor({ sex: 'male' })
    const r1 = checkEligibility({ ...base, donor: d, donations: [donation(addDays(TODAY, -20))], type: 'platelets' })
    expect(r1.eligibleFrom).toBe(addDays(TODAY, 8))
    const r2 = checkEligibility({
      ...base,
      donor: d,
      donations: [donation(addDays(TODAY, -1), { type: 'platelets' })],
      type: 'platelets',
    })
    expect(r2.daysToWait).toBe(1)
  })

  it('blocks whole blood for 28 days after apheresis', () => {
    const r = checkEligibility({
      ...base,
      donor: donor({ sex: 'male' }),
      donations: [donation(addDays(TODAY, -10), { type: 'plasma' })],
    })
    expect(r.daysToWait).toBe(18)
  })

  it('caps apheresis at 24 a year', () => {
    const many = Array.from({ length: 24 }, (_, i) => donation(addDays(TODAY, -10 - i * 14), { id: `a${i}`, type: 'platelets' }))
    const r = checkEligibility({ ...base, donor: donor({ sex: 'male' }), donations: many, type: 'platelets' })
    expect(r.status).toBe('wait')
    expect(r.reasons.join(' ')).toMatch(/24 apheresis/)
  })

  it('applies age and weight limits', () => {
    expect(checkEligibility({ ...base, donor: donor({ birthDate: '2009-01-01' }), donations: [] }).status).toBe('ineligible')
    expect(checkEligibility({ ...base, donor: donor({ weightKg: 44 }), donations: [] }).status).toBe('ineligible')
    expect(checkEligibility({ ...base, donor: donor({ weightKg: 50 }), donations: [] }).volumeMl).toBe(350)
  })

  it('respects active deferrals', () => {
    const r = checkEligibility({
      ...base,
      donor: donor(),
      donations: [],
      deferrals: [{ id: 'x', donorId: 'd1', reason: 'Tattoo', from: '2026-06-01', until: '2027-05-31', source: 'centre-desk' }],
    })
    expect(r.status).toBe('deferred')
    expect(r.eligibleFrom).toBe('2027-06-01')
  })

  it('adds advisories for low recent haemoglobin and ferritin without blocking', () => {
    const obs: Observation[] = [
      { id: 'o1', donorId: 'd1', code: '718-7', date: addDays(TODAY, -30), value: 11.8, unit: 'g/dL', source: 'abdm', verified: true },
      { id: 'o2', donorId: 'd1', code: '2276-4', date: addDays(TODAY, -30), value: 9, unit: 'ng/mL', source: 'abdm', verified: true },
    ]
    const r = checkEligibility({ ...base, donor: donor(), donations: [], observations: obs })
    expect(r.status).toBe('eligible')
    expect(r.advisories).toHaveLength(2)
  })
})

describe('compatibility', () => {
  it('follows red cell rules', () => {
    expect(compatibleDonorGroups('O-', 'red-cells')).toEqual(['O-'])
    expect(compatibleDonorGroups('AB+', 'red-cells')).toHaveLength(8)
    expect(compatibleDonorGroups('A+', 'red-cells').sort()).toEqual(['A+', 'A-', 'O+', 'O-'].sort())
    expect(isCompatible('O+', 'B-', 'red-cells')).toBe(false)
  })
  it('reverses ABO for plasma and keeps platelets ABO-identical', () => {
    expect(isCompatible('AB-', 'O+', 'plasma')).toBe(true)
    expect(isCompatible('O+', 'A+', 'plasma')).toBe(false)
    expect(isCompatible('A+', 'A-', 'platelets')).toBe(false)
    expect(isCompatible('A-', 'A+', 'platelets')).toBe(true)
  })
})

describe('Donor Pass', () => {
  it('unlocks after three verified donations and lasts 12 months from the latest', () => {
    const dons = [donation('2025-03-01'), donation('2025-08-01'), donation('2026-01-15')]
    const s = donorPassState('d1', dons, [], TODAY)
    expect(s.status).toBe('active')
    expect(s.validUntil).toBe('2027-01-15')
    expect(s.waiversLeft).toBe(1)
  })
  it('ignores unverified donations and counts redemptions', () => {
    const dons = [donation('2025-03-01'), donation('2025-08-01'), donation('2026-01-15', { verified: false })]
    expect(donorPassState('d1', dons, [], TODAY).status).toBe('building')
    const ok = [donation('2025-03-01'), donation('2025-08-01'), donation('2026-01-15')]
    const s = donorPassState('d1', ok, [{ id: 'r', donorId: 'd1', date: '2026-05-01', centreId: 'c1', beneficiary: 'Self' }], TODAY)
    expect(s.waiversLeft).toBe(0)
  })
  it('expires 12 months after the latest donation', () => {
    const dons = [donation('2024-11-01'), donation('2025-03-01'), donation('2025-07-01')]
    expect(donorPassState('d1', dons, [], TODAY).status).toBe('expired')
  })
})

describe('matching', () => {
  const centre: Facility = { id: 'c1', kind: 'blood-centre', name: 'Centre', location: { lat: 19.1136, lng: 72.8697, area: 'Andheri' }, verified: true }
  const req = (over: Partial<BloodRequest> = {}): BloodRequest => ({
    id: 'r1', hospitalId: 'h1', centreId: 'c1', patientGroup: 'B+', component: 'red-cells', units: 1,
    neededBy: '2026-10-10T10:00:00Z', raisedBy: 'staff', slipVerified: false, status: 'open',
    createdAt: '2026-10-09T08:00:00Z', responses: [], ...over,
  })
  const data = (donors: Donor[]) => ({ donors, donations: [], deferrals: [], observations: [], today: TODAY })

  it('refuses unverified family requests', () => {
    const r = matchDonors(req({ raisedBy: 'family' }), centre, data([donor()]))
    expect(r.verified).toBe(false)
    expect(r.matches).toEqual([])
  })

  it('filters by consent, verified group, compatibility and eligibility, nearest first', () => {
    const donors = [
      donor({ id: 'near', name: 'Asha Rao', location: { lat: 19.12, lng: 72.87, area: 'x' } }),
      donor({ id: 'far', name: 'Ravi Patil', location: { lat: 19.2, lng: 72.97, area: 'y' } }),
      donor({ id: 'noconsent', consents: { records: true, reminders: true, requests: false, labSharing: true, insurer: false } }),
      donor({ id: 'unverified', bloodGroupVerified: false }),
      donor({ id: 'incompatible', bloodGroup: 'A+' }),
    ]
    const r = matchDonors(req(), centre, data(donors))
    expect(r.matches.map((m) => m.donorId)).toEqual(['near', 'far'])
    expect(r.radiusKm).toBe(25)
    expect(r.matches[0].displayName).toBe('Asha R.')
    expect(r.excluded['no-consent']).toBe(1)
    expect(r.excluded['unverified-group']).toBe(1)
    expect(r.excluded.incompatible).toBe(1)
  })

  it('stops widening once enough donors are within reach', () => {
    const donors = Array.from({ length: 12 }, (_, i) =>
      donor({ id: `n${i}`, location: { lat: 19.1136 + i * 0.001, lng: 72.8697, area: 'x' } }),
    )
    const r = matchDonors(req(), centre, data(donors))
    expect(r.radiusKm).toBe(5)
    expect(r.matches).toHaveLength(10)
  })

  it('masks names and phone numbers and measures distance', () => {
    expect(maskName('Priya Sharma')).toBe('Priya S.')
    expect(maskPhone('+919876543210')).toBe('+91 98••• ••210')
    expect(distanceKm({ lat: 19, lng: 72.8, area: '' }, { lat: 19.1, lng: 72.8, area: '' })).toBeCloseTo(11.1, 0)
  })
})

describe('front-door form', () => {
  it('requires every question and flags yes answers', () => {
    const answers = Object.fromEntries(SCREENING_QUESTIONS.map((q) => [q.id, false]))
    expect(allAnswered(answers)).toBe(true)
    expect(flaggedAnswers({ ...answers, tattoo: true }).map((q) => q.id)).toEqual(['tattoo'])
    expect(allAnswered({})).toBe(false)
  })
  it('checks vitals', () => {
    expect(vitalsIssues({ weightKg: 60, hb: 13.4, bpSys: 120, bpDia: 80, pulse: 72 })).toEqual([])
    expect(vitalsIssues({ weightKg: 60, hb: 12.1, bpSys: 150, bpDia: 80, pulse: 72 })).toHaveLength(2)
  })
})

describe('lab sync connector', () => {
  const csv = [
    'patient_ref,test_name,value,unit,ref_range,collected_on',
    'LAB-001,Haemoglobin,13.2,g/dL,12-15.5,2026-09-20',
    'LAB-001,S. Ferritin,22,ng/mL,15-150,2026-09-20',
    'LAB-001,HBsAg,Non reactive,,,2026-09-20',
    'LAB-001,Blood Group,B Positive,,,2026-09-20',
    'LAB-001,Vitamin D,30,ng/mL,,2026-09-20',
    'LAB-999,Haemoglobin,14,g/dL,,2026-09-20',
  ].join('\n')

  it('maps known tests, blocks infection screening and holds unknown ones', () => {
    const rows = parseLabCsv(csv)
    const res = mapLabRows(rows, { resolvePatient: (r) => (r === 'LAB-001' ? 'd1' : undefined), labId: 'l1', source: 'lab-sync' })
    expect(res.counts).toEqual({ mapped: 3, blocked: 1, unmapped: 1, invalid: 1 })
    expect(res.observations.map((o) => o.code).sort()).toEqual(['10331-7', '2276-4', '718-7', '883-9'].sort())
    const hb = res.observations.find((o) => o.code === '718-7')
    expect(hb).toMatchObject({ value: 13.2, refLow: 12, refHigh: 15.5 })
    expect(res.observations.some((o) => o.code.startsWith('tti'))).toBe(false)
  })
})

describe('FHIR export', () => {
  it('builds a bundle without sensitive results', () => {
    const obs: Observation[] = [
      { id: 'o1', donorId: 'd1', code: '718-7', date: TODAY, value: 13, unit: 'g/dL', source: 'abdm', verified: true },
      { id: 'o2', donorId: 'd1', code: 'tti-hiv', date: TODAY, value: 'n/a', source: 'abdm', verified: true },
    ]
    const b = donorBundle(donor(), [donation('2026-01-01')], obs) as { entry: { resource: { resourceType: string } }[] }
    expect(b.entry.map((e) => e.resource.resourceType)).toEqual(['Patient', 'Procedure', 'Observation'])
  })
})
