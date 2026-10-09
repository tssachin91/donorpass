// Eligibility engine based on NBTC donor selection guidelines (India).
// It is a guide for the donor: the blood centre's medical officer makes the final decision.
//
// Intervals used:
// - Whole blood after whole blood: 90 days (men), 120 days (women)
// - Whole blood after apheresis (platelets/plasma): 28 days
// - Apheresis after whole blood: 28 days
// - Apheresis after apheresis: 48 hours, at most 24 apheresis donations a year
// Basic criteria: age 18 to 65, weight at least 45 kg, haemoglobin at least 12.5 g/dL on the day.

import { CODES } from './codes'
import { addDays, ageOn, daysBetween, maxDate } from './dates'
import type { Deferral, Donation, DonationType, Donor, Observation } from './types'

export const RULES = {
  minAge: 18,
  maxAge: 65,
  minWeightKg: 45,
  fullBagWeightKg: 55,
  minHb: 12.5,
  lowFerritin: 15,
  wholeBloodIntervalDays: { male: 90, female: 120 },
  apheresisAfterWholeBloodDays: 28,
  wholeBloodAfterApheresisDays: 28,
  apheresisAfterApheresisDays: 2,
  maxApheresisPerYear: 24,
  /** How recent a lab haemoglobin must be to raise an advisory. */
  recentTestDays: 90,
} as const

export type EligibilityStatus = 'eligible' | 'wait' | 'deferred' | 'ineligible'

export interface EligibilityResult {
  status: EligibilityStatus
  type: DonationType
  /** First date the donor can donate this type. Absent when ineligible. */
  eligibleFrom?: string
  daysToWait: number
  reasons: string[]
  advisories: string[]
  /** Suggested collection volume for whole blood. */
  volumeMl?: number
}

export interface EligibilityInput {
  donor: Donor
  donations: Donation[]
  deferrals: Deferral[]
  observations: Observation[]
  today: string
  type?: DonationType
}

const isApheresis = (t: DonationType) => t !== 'whole-blood'

function latest<T extends { date: string }>(items: T[]): T | undefined {
  return items.reduce<T | undefined>((m, x) => (!m || x.date > m.date ? x : m), undefined)
}

export function checkEligibility(input: EligibilityInput): EligibilityResult {
  const { donor, today } = input
  const type = input.type ?? 'whole-blood'
  const donations = input.donations.filter((d) => d.donorId === donor.id && d.date <= today)
  const reasons: string[] = []
  const advisories: string[] = []

  // Hard criteria.
  const age = ageOn(donor.birthDate, today)
  if (age < RULES.minAge || age > RULES.maxAge) {
    reasons.push(`Donors must be ${RULES.minAge} to ${RULES.maxAge} years old; you are ${age}.`)
  }
  if (donor.weightKg < RULES.minWeightKg) {
    reasons.push(`Donors must weigh at least ${RULES.minWeightKg} kg.`)
  }
  if (reasons.length) {
    return { status: 'ineligible', type, daysToWait: 0, reasons, advisories }
  }

  // Intervals since the last donations.
  const candidates: string[] = [today]
  const lastWhole = latest(donations.filter((d) => d.type === 'whole-blood'))
  const lastApheresis = latest(donations.filter((d) => isApheresis(d.type)))

  if (type === 'whole-blood') {
    if (lastWhole) {
      const gap = RULES.wholeBloodIntervalDays[donor.sex]
      const from = addDays(lastWhole.date, gap)
      if (from > today) {
        candidates.push(from)
        reasons.push(`${gap} days must pass after a whole blood donation (last on ${lastWhole.date}).`)
      }
    }
    if (lastApheresis) {
      const from = addDays(lastApheresis.date, RULES.wholeBloodAfterApheresisDays)
      if (from > today) {
        candidates.push(from)
        reasons.push(`Whole blood needs ${RULES.wholeBloodAfterApheresisDays} days after an apheresis donation.`)
      }
    }
  } else {
    if (lastWhole) {
      const from = addDays(lastWhole.date, RULES.apheresisAfterWholeBloodDays)
      if (from > today) {
        candidates.push(from)
        reasons.push(`Apheresis needs ${RULES.apheresisAfterWholeBloodDays} days after a whole blood donation.`)
      }
    }
    if (lastApheresis) {
      const from = addDays(lastApheresis.date, RULES.apheresisAfterApheresisDays)
      if (from > today) {
        candidates.push(from)
        reasons.push('At least 48 hours must pass between apheresis donations.')
      }
    }
    const yearAgo = addDays(today, -365)
    const recent = donations.filter((d) => isApheresis(d.type) && d.date > yearAgo)
    if (recent.length >= RULES.maxApheresisPerYear) {
      const oldest = recent.map((d) => d.date).sort()[0]
      candidates.push(addDays(oldest, 366))
      reasons.push(`At most ${RULES.maxApheresisPerYear} apheresis donations are allowed in a year.`)
    }
  }

  // Active deferrals.
  const active = input.deferrals.filter((d) => d.donorId === donor.id && d.from <= today && d.until >= today)
  for (const d of active) {
    candidates.push(addDays(d.until, 1))
    reasons.push(`Deferred until ${d.until}: ${d.reason}.`)
  }

  // Advisories from recent tests. They never block; the centre tests on the day.
  const obs = input.observations.filter(
    (o) => o.donorId === donor.id && o.date <= today && daysBetween(o.date, today) <= RULES.recentTestDays,
  )
  const hb = latest(obs.filter((o) => o.code === CODES.hb && typeof o.value === 'number'))
  if (hb && (hb.value as number) < RULES.minHb) {
    advisories.push(
      `Your last haemoglobin was ${hb.value} g/dL, below the ${RULES.minHb} g/dL minimum. The centre may defer you; consider an iron check first.`,
    )
  }
  const ferritin = latest(obs.filter((o) => o.code === CODES.ferritin && typeof o.value === 'number'))
  if (ferritin && (ferritin.value as number) < RULES.lowFerritin) {
    advisories.push(`Your last ferritin was ${ferritin.value} ng/mL, which suggests low iron stores. Speak to a doctor before donating again.`)
  }

  const eligibleFrom = maxDate(...candidates)
  const daysToWait = Math.max(0, daysBetween(today, eligibleFrom))
  const status: EligibilityStatus = daysToWait === 0 ? 'eligible' : active.length ? 'deferred' : 'wait'

  return {
    status,
    type,
    eligibleFrom,
    daysToWait,
    reasons: status === 'eligible' ? [] : reasons,
    advisories,
    volumeMl: type === 'whole-blood' ? (donor.weightKg >= RULES.fullBagWeightKg ? 450 : 350) : undefined,
  }
}

/** Convenience: the donation type a component request needs. */
export function donationTypeFor(component: 'red-cells' | 'platelets' | 'plasma'): DonationType {
  return component === 'red-cells' ? 'whole-blood' : component
}
