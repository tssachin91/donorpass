// Sample data for the demo. Every person and organisation here is fictional.
// Dates are relative to "today" so the demo always looks current.

import { addDays } from '../core/dates'
import type {
  BloodGroup,
  BloodRequest,
  Consents,
  Deferral,
  Donation,
  Donor,
  Facility,
  FrontDoorForm,
  GeoPoint,
  Observation,
  Sex,
  WaiverRedemption,
} from '../core/types'

export interface ActivityEvent {
  id: string
  at: string
  kind: 'e-raktkosh' | 'abdm' | 'lab-sync' | 'request' | 'centre' | 'pass'
  text: string
}

export interface DemoState {
  version: number
  today: string
  donors: Donor[]
  donations: Donation[]
  deferrals: Deferral[]
  observations: Observation[]
  facilities: Facility[]
  requests: BloodRequest[]
  forms: FrontDoorForm[]
  redemptions: WaiverRedemption[]
  /** Each lab's own patient references, linked to donors who consented to lab sharing. */
  labPatients: Record<string, Record<string, string>>
  events: ActivityEvent[]
}

export const STATE_VERSION = 3

const AREAS: Record<string, GeoPoint> = {
  andheriE: { lat: 19.1136, lng: 72.8697, area: 'Andheri East' },
  andheriW: { lat: 19.1364, lng: 72.8296, area: 'Andheri West' },
  bandra: { lat: 19.0596, lng: 72.8295, area: 'Bandra West' },
  dadar: { lat: 19.0178, lng: 72.8478, area: 'Dadar' },
  powai: { lat: 19.1176, lng: 72.906, area: 'Powai' },
  goregaon: { lat: 19.1663, lng: 72.8526, area: 'Goregaon' },
  malad: { lat: 19.1874, lng: 72.8484, area: 'Malad' },
  borivali: { lat: 19.2307, lng: 72.8567, area: 'Borivali' },
  kurla: { lat: 19.0726, lng: 72.8845, area: 'Kurla' },
  ghatkopar: { lat: 19.086, lng: 72.9081, area: 'Ghatkopar' },
  chembur: { lat: 19.0522, lng: 72.9005, area: 'Chembur' },
  sion: { lat: 19.039, lng: 72.8619, area: 'Sion' },
  worli: { lat: 19.0176, lng: 72.8162, area: 'Worli' },
  thane: { lat: 19.2183, lng: 72.9781, area: 'Thane' },
  vashi: { lat: 19.0771, lng: 72.9986, area: 'Vashi' },
  mulund: { lat: 19.1726, lng: 72.9425, area: 'Mulund' },
  vikhroli: { lat: 19.111, lng: 72.9277, area: 'Vikhroli' },
}

const ALL_ON: Consents = { records: true, reminders: true, requests: true, labSharing: true, insurer: false }

const FACILITIES: Facility[] = [
  { id: 'bc-andheri', kind: 'blood-centre', name: 'Andheri Community Blood Centre', location: AREAS.andheriE, verified: true },
  { id: 'bc-dadar', kind: 'blood-centre', name: 'Dadar Charitable Blood Centre', location: AREAS.dadar, verified: true },
  { id: 'bc-thane', kind: 'blood-centre', name: 'Thane Trust Blood Centre', location: AREAS.thane, verified: true },
  { id: 'h-lakeview', kind: 'hospital', name: 'Lakeview Hospital, Powai', location: AREAS.powai, verified: true },
  { id: 'h-seaside', kind: 'hospital', name: 'Seaside General Hospital, Bandra', location: AREAS.bandra, verified: true },
  { id: 'h-riverside', kind: 'hospital', name: 'Riverside Multispeciality, Thane', location: AREAS.thane, verified: true },
  { id: 'lab-clearpath', kind: 'lab', name: 'Clearpath Diagnostics, Andheri', location: AREAS.andheriW, verified: true, abdmReady: false },
  { id: 'lab-northstar', kind: 'lab', name: 'Northstar Labs, Dadar', location: AREAS.dadar, verified: true, abdmReady: true },
]

// Deterministic pseudo-random numbers so the generated donors are the same every time.
function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GENERATED: Array<[string, Sex]> = [
  ['Rohan Joshi', 'male'], ['Ananya Iyer', 'female'], ['Vikram Nair', 'male'], ['Meera Pillai', 'female'],
  ['Siddharth Rane', 'male'], ['Kavya Menon', 'female'], ['Aditya Kamat', 'male'], ['Pooja Gupta', 'female'],
  ['Imran Khan', 'male'], ['Neha Bhosale', 'female'], ['Karan Malhotra', 'male'], ['Ritika Sawant', 'female'],
  ['Farhan Qureshi', 'male'], ['Divya Shetty', 'female'], ['Nikhil Pawar', 'male'], ['Sana Mirza', 'female'],
  ['Omkar Jadhav', 'male'], ['Tanvi Deshpande', 'female'], ['Harsh Vora', 'male'], ['Isha Chavan', 'female'],
  ['Yusuf Ansari', 'male'], ['Aarti More', 'female'], ['Kunal Shah', 'male'], ['Lata Gaikwad', 'female'],
  ['Manish Tiwari', 'male'], ['Zoya Contractor', 'female'],
]

// Rough Indian distribution: B+ and O+ most common, negatives rare.
const GROUP_WEIGHTS: Array<[BloodGroup, number]> = [
  ['B+', 31], ['O+', 31], ['A+', 21], ['AB+', 8], ['B-', 2.5], ['O-', 2.5], ['A-', 2.5], ['AB-', 1.5],
]

function pickGroup(r: () => number): BloodGroup {
  let x = r() * GROUP_WEIGHTS.reduce((s, [, w]) => s + w, 0)
  for (const [g, w] of GROUP_WEIGHTS) {
    x -= w
    if (x <= 0) return g
  }
  return 'O+'
}

export function buildSeed(today: string): DemoState {
  const d = (n: number) => addDays(today, n)
  const donors: Donor[] = []
  const donations: Donation[] = []
  const observations: Observation[] = []
  const deferrals: Deferral[] = []
  let obsN = 0
  const obs = (donorId: string, code: string, daysAgo: number, value: number | string, extra: Partial<Observation> = {}) =>
    observations.push({
      id: `obs-${obsN++}`,
      donorId,
      code,
      date: d(-daysAgo),
      value,
      unit: code === '718-7' ? 'g/dL' : code === '2276-4' ? 'ng/mL' : undefined,
      refLow: code === '718-7' ? 12 : code === '2276-4' ? 15 : undefined,
      refHigh: code === '718-7' ? 15.5 : code === '2276-4' ? 150 : undefined,
      source: 'abdm',
      verified: true,
      ...extra,
    })
  const give = (donorId: string, daysAgo: number, extra: Partial<Donation> = {}) =>
    donations.push({
      id: `don-${donorId}-${daysAgo}`,
      donorId,
      date: d(-daysAgo),
      type: 'whole-blood',
      centreId: 'bc-andheri',
      volumeMl: 450,
      verified: true,
      source: 'e-raktkosh',
      ...extra,
    })

  // Featured donors, each showing a different situation.
  donors.push({
    id: 'd-priya', name: 'Priya Sharma', phone: '+919820011122', sex: 'female', birthDate: '1994-05-14', weightKg: 58,
    bloodGroup: 'B+', bloodGroupVerified: true, location: AREAS.andheriE, language: 'en', consents: { ...ALL_ON },
    family: ['Sunita Sharma (mother)', 'Rakesh Sharma (father)'], abhaAddress: 'priya.sharma@abdm',
  })
  give('d-priya', 520, { centreId: 'bc-dadar' })
  give('d-priya', 380)
  give('d-priya', 250, { source: 'centre-desk' })
  give('d-priya', 140)
  ;[
    [520, 13.1], [380, 12.9], [250, 12.7], [140, 12.6],
  ].forEach(([ago, v]) => obs('d-priya', '718-7', ago, v, { source: 'e-raktkosh' }))
  obs('d-priya', '718-7', 30, 12.2, { source: 'lab-sync', labId: 'lab-clearpath', refLow: 12, refHigh: 15.5 })
  obs('d-priya', '2276-4', 30, 18, { source: 'lab-sync', labId: 'lab-clearpath', refLow: 15, refHigh: 150 })
  obs('d-priya', '883-9', 520, 'B', { source: 'e-raktkosh' })
  obs('d-priya', '10331-7', 520, 'Positive', { source: 'e-raktkosh' })

  donors.push({
    id: 'd-arjun', name: 'Arjun Mehta', phone: '+919821033344', sex: 'male', birthDate: '1988-11-02', weightKg: 74,
    bloodGroup: 'O-', bloodGroupVerified: true, location: AREAS.bandra, language: 'en', consents: { ...ALL_ON },
    family: ['Nisha Mehta (spouse)'],
  })
  give('d-arjun', 300)
  give('d-arjun', 200, { centreId: 'bc-dadar' })
  give('d-arjun', 40, { type: 'platelets', volumeMl: 250, centreId: 'bc-dadar' })
  give('d-arjun', 20, { type: 'platelets', volumeMl: 250, centreId: 'bc-dadar' })
  give('d-arjun', 3, { type: 'platelets', volumeMl: 250, centreId: 'bc-dadar', source: 'centre-desk' })
  obs('d-arjun', '718-7', 3, 14.6, { source: 'centre-desk' })
  obs('d-arjun', '777-3', 3, 248, { source: 'centre-desk', unit: '10^3/uL', refLow: 150, refHigh: 410 })

  donors.push({
    id: 'd-sneha', name: 'Sneha Kulkarni', phone: '+919822055566', sex: 'female', birthDate: '2001-07-21', weightKg: 50,
    bloodGroup: 'A+', bloodGroupVerified: true, location: AREAS.dadar, language: 'mr', consents: { ...ALL_ON }, family: [],
  })
  give('d-sneha', 60, { centreId: 'bc-dadar', volumeMl: 350 })
  obs('d-sneha', '718-7', 60, 12.9, { source: 'e-raktkosh' })

  donors.push({
    id: 'd-rahul', name: 'Rahul Desai', phone: '+919823077788', sex: 'male', birthDate: '1979-02-09', weightKg: 81,
    bloodGroup: 'AB+', bloodGroupVerified: true, location: AREAS.thane, language: 'hi', consents: { ...ALL_ON }, family: [],
  })
  give('d-rahul', 400, { centreId: 'bc-thane' })
  give('d-rahul', 290, { centreId: 'bc-thane' })
  deferrals.push({ id: 'def-rahul', donorId: 'd-rahul', reason: 'Tattoo in the last 12 months', from: d(-275), until: d(90), source: 'centre-desk' })

  donors.push({
    id: 'd-fatima', name: 'Fatima Shaikh', phone: '+919824099900', sex: 'female', birthDate: '1990-12-30', weightKg: 63,
    bloodGroup: 'O+', bloodGroupVerified: false, location: AREAS.kurla, language: 'hi',
    consents: { ...ALL_ON, requests: false }, family: [],
  })
  give('d-fatima', 900, { verified: false, source: 'self-reported', centreId: 'bc-dadar' })
  give('d-fatima', 200, { verified: false, source: 'self-reported', centreId: 'bc-dadar' })

  // Generated donors.
  const r = rng(42)
  const areaKeys = Object.keys(AREAS)
  GENERATED.forEach(([name, sex], i) => {
    const id = `d-${name.split(' ')[0].toLowerCase()}`
    const area = AREAS[areaKeys[Math.floor(r() * areaKeys.length)]]
    const jitter = () => (r() - 0.5) * 0.02
    const year = 1970 + Math.floor(r() * 36)
    donors.push({
      id,
      name,
      phone: `+9198${String(30000000 + Math.floor(r() * 69999999)).padStart(8, '0')}`,
      sex,
      birthDate: `${year}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`,
      weightKg: sex === 'male' ? 58 + Math.floor(r() * 30) : 47 + Math.floor(r() * 25),
      bloodGroup: pickGroup(r),
      bloodGroupVerified: r() > 0.1,
      location: { lat: area.lat + jitter(), lng: area.lng + jitter(), area: area.area },
      language: (['en', 'hi', 'mr'] as const)[i % 3],
      consents: { ...ALL_ON, requests: r() > 0.12 },
      family: [],
    })
    const centres = ['bc-andheri', 'bc-dadar', 'bc-thane']
    const n = Math.floor(r() * 4)
    let ago = 30 + Math.floor(r() * 200)
    for (let k = 0; k < n; k++) {
      give(id, ago, { centreId: centres[Math.floor(r() * 3)], volumeMl: 450 })
      obs(id, '718-7', ago, Math.round((12.3 + r() * 3) * 10) / 10, { source: 'e-raktkosh' })
      ago += 130 + Math.floor(r() * 150)
    }
  })

  const now = new Date()
  const iso = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString()
  const requests: BloodRequest[] = [
    {
      id: 'req-1001', hospitalId: 'h-lakeview', centreId: 'bc-andheri', patientGroup: 'B+', component: 'red-cells', units: 2,
      neededBy: iso(10), raisedBy: 'staff', slipVerified: true, status: 'open', createdAt: iso(-2), responses: [],
    },
    {
      id: 'req-1002', hospitalId: 'h-seaside', centreId: 'bc-dadar', patientGroup: 'O-', component: 'platelets', units: 1,
      neededBy: iso(20), raisedBy: 'family', slipVerified: false, status: 'awaiting-verification', createdAt: iso(-1), responses: [],
    },
    {
      id: 'req-0990', hospitalId: 'h-riverside', centreId: 'bc-thane', patientGroup: 'A+', component: 'red-cells', units: 1,
      neededBy: iso(-30), raisedBy: 'staff', slipVerified: true, status: 'fulfilled', createdAt: iso(-48), responses: [],
    },
  ]

  return {
    version: STATE_VERSION,
    today,
    donors,
    donations,
    deferrals,
    observations,
    facilities: FACILITIES,
    requests,
    forms: [],
    redemptions: [],
    labPatients: {
      'lab-clearpath': { 'CP-10442': 'd-priya', 'CP-10519': 'd-sneha', 'CP-10777': 'd-rohan' },
      'lab-northstar': { 'NS-2231': 'd-arjun', 'NS-2290': 'd-priya', 'NS-2304': 'd-meera' },
    },
    events: [
      { id: 'ev-1', at: iso(-26), kind: 'e-raktkosh', text: 'Read 3 donation records for Priya Sharma (simulated e-RaktKosh)' },
      { id: 'ev-2', at: iso(-20), kind: 'lab-sync', text: 'Clearpath Diagnostics sent 2 results for Priya Sharma via the sync connector' },
      { id: 'ev-3', at: iso(-2), kind: 'request', text: 'Lakeview Hospital raised a verified request for 2 units of B+ red cells' },
    ],
  }
}

/** Sample CSV a lab without ABDM support might export. Used by the sync connector demo. */
export const SAMPLE_LAB_CSV = (today: string) =>
  [
    'patient_ref,test_name,value,unit,ref_range,collected_on',
    `CP-10519,Haemoglobin,12.4,g/dL,12-15.5,${addDays(today, -1)}`,
    `CP-10519,S. Ferritin,11,ng/mL,15-150,${addDays(today, -1)}`,
    `CP-10519,Platelet Count,265,10^3/uL,150-410,${addDays(today, -1)}`,
    `CP-10519,HBsAg,Non reactive,,,${addDays(today, -1)}`,
    `CP-10777,Haemoglobin,14.8,g/dL,13-17,${addDays(today, -2)}`,
    `CP-10777,Blood Group,O Positive,,,${addDays(today, -2)}`,
    `CP-10777,Vitamin D,24,ng/mL,30-100,${addDays(today, -2)}`,
    `CP-20001,Haemoglobin,13.9,g/dL,13-17,${addDays(today, -2)}`,
  ].join('\n')
