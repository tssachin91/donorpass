// Donor Pass: a portable version of the paper donor card.
// Three verified donations within 24 months unlock it; it stays active for 12 months after
// the latest verified donation and gives one processing-fee waiver a year for the donor or an
// immediate family member, plus priority issue at partner centres.
// It never reserves a unit of blood and never involves payment to the donor.

import { addMonths } from './dates'
import type { Donation, WaiverRedemption } from './types'

export const PASS_RULES = {
  donationsNeeded: 3,
  lookbackMonths: 24,
  validMonths: 12,
  waiversPerYear: 1,
} as const

export type PassStatus = 'building' | 'active' | 'expired'

export interface PassState {
  status: PassStatus
  count: number
  needed: number
  validUntil?: string
  waiversLeft: number
  lastDonation?: string
}

export function donorPassState(
  donorId: string,
  donations: Donation[],
  redemptions: WaiverRedemption[],
  today: string,
): PassState {
  const since = addMonths(today, -PASS_RULES.lookbackMonths)
  const verified = donations
    .filter((d) => d.donorId === donorId && d.verified && d.date <= today)
    .map((d) => d.date)
    .sort()
  const inWindow = verified.filter((d) => d > since)
  const last = verified.at(-1)
  const count = inWindow.length

  if (count < PASS_RULES.donationsNeeded || !last) {
    return { status: 'building', count, needed: PASS_RULES.donationsNeeded, waiversLeft: 0, lastDonation: last }
  }

  const validUntil = addMonths(last, PASS_RULES.validMonths)
  if (validUntil < today) {
    return { status: 'expired', count, needed: PASS_RULES.donationsNeeded, validUntil, waiversLeft: 0, lastDonation: last }
  }

  const yearAgo = addMonths(today, -12)
  const used = redemptions.filter((r) => r.donorId === donorId && r.date > yearAgo).length
  return {
    status: 'active',
    count,
    needed: PASS_RULES.donationsNeeded,
    validUntil,
    waiversLeft: Math.max(0, PASS_RULES.waiversPerYear - used),
    lastDonation: last,
  }
}
