// Verified blood request matching.
// Only verified requests go out. Only donors who opted in, have a centre-verified blood group,
// are eligible today and are compatible are alerted, nearest first, starting within 5 km and
// widening in steps. At most 10 donors are alerted per unit needed.
// Donors are sent to the licensed blood centre, never to the family, and contact details stay masked.

import { isCompatible } from './compatibility'
import { checkEligibility, donationTypeFor } from './eligibility'
import type { BloodRequest, Deferral, Donation, Donor, Facility, GeoPoint, Observation } from './types'

export const MATCH_RULES = {
  radiusStepsKm: [5, 10, 15, 25],
  donorsPerUnit: 10,
} as const

export function distanceKm(a: GeoPoint, b: GeoPoint): number {
  const R = 6371
  const rad = (x: number) => (x * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

export function isRequestVerified(r: Pick<BloodRequest, 'raisedBy' | 'slipVerified'>): boolean {
  return r.raisedBy === 'staff' || r.slipVerified
}

export function maskName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/)
  const initial = rest.at(-1)?.[0]
  return initial ? `${first} ${initial}.` : first
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return `+91 ${digits.slice(-10, -8)}••• ••${digits.slice(-3)}`
}

export interface Match {
  donorId: string
  displayName: string
  bloodGroup: Donor['bloodGroup']
  distanceKm: number
}

export type ExclusionReason = 'no-consent' | 'unverified-group' | 'incompatible' | 'not-eligible' | 'too-far'

export interface MatchResult {
  verified: boolean
  radiusKm: number
  cap: number
  matches: Match[]
  excluded: Record<ExclusionReason, number>
}

export interface MatchData {
  donors: Donor[]
  donations: Donation[]
  deferrals: Deferral[]
  observations: Observation[]
  today: string
}

export function matchDonors(request: BloodRequest, centre: Facility, data: MatchData): MatchResult {
  const excluded: Record<ExclusionReason, number> = {
    'no-consent': 0,
    'unverified-group': 0,
    incompatible: 0,
    'not-eligible': 0,
    'too-far': 0,
  }
  const cap = request.units * MATCH_RULES.donorsPerUnit
  const verified = isRequestVerified(request)
  if (!verified) {
    return { verified, radiusKm: 0, cap, matches: [], excluded }
  }

  const type = donationTypeFor(request.component)
  const pool: Match[] = []
  for (const donor of data.donors) {
    if (!donor.consents.requests) {
      excluded['no-consent']++
      continue
    }
    if (!donor.bloodGroupVerified) {
      excluded['unverified-group']++
      continue
    }
    if (!isCompatible(donor.bloodGroup, request.patientGroup, request.component)) {
      excluded.incompatible++
      continue
    }
    const elig = checkEligibility({ ...data, donor, type })
    if (elig.status !== 'eligible') {
      excluded['not-eligible']++
      continue
    }
    pool.push({
      donorId: donor.id,
      displayName: maskName(donor.name),
      bloodGroup: donor.bloodGroup,
      distanceKm: Math.round(distanceKm(donor.location, centre.location) * 10) / 10,
    })
  }

  pool.sort((a, b) => a.distanceKm - b.distanceKm)
  const steps = MATCH_RULES.radiusStepsKm
  let radiusKm: number = steps[steps.length - 1]
  for (const r of steps) {
    if (pool.filter((m) => m.distanceKm <= r).length >= cap) {
      radiusKm = r
      break
    }
  }
  const within = pool.filter((m) => m.distanceKm <= radiusKm)
  excluded['too-far'] = pool.length - within.length
  return { verified, radiusKm, cap, matches: within.slice(0, cap), excluded }
}
