import { isDisplayable } from '../core/codes'
import { donorPassState } from '../core/donorPass'
import { checkEligibility } from '../core/eligibility'
import { matchDonors } from '../core/matching'
import type { BloodRequest, Donor, DonationType } from '../core/types'
import type { DemoState } from '../data/seed'

export function eligibilityFor(state: DemoState, donor: Donor, type: DonationType = 'whole-blood') {
  return checkEligibility({
    donor,
    donations: state.donations,
    deferrals: state.deferrals,
    observations: state.observations,
    today: state.today,
    type,
  })
}

export function passFor(state: DemoState, donorId: string) {
  return donorPassState(donorId, state.donations, state.redemptions, state.today)
}

export function matchFor(state: DemoState, request: BloodRequest) {
  const centre = state.facilities.find((f) => f.id === request.centreId)
  if (!centre) return undefined
  return matchDonors(request, centre, {
    donors: state.donors,
    donations: state.donations,
    deferrals: state.deferrals,
    observations: state.observations,
    today: state.today,
  })
}

/** Open, verified requests this donor is a match for (computed the same way hospitals see it). */
export function requestsForDonor(state: DemoState, donorId: string) {
  return state.requests
    .filter((r) => r.status === 'open')
    .map((r) => ({ request: r, match: matchFor(state, r)?.matches.find((m) => m.donorId === donorId) }))
    .filter((x): x is { request: BloodRequest; match: NonNullable<typeof x.match> } => Boolean(x.match))
}

export type TimelineEntry =
  | { kind: 'donation'; date: string; id: string; item: DemoState['donations'][number] }
  | { kind: 'test'; date: string; id: string; item: DemoState['observations'][number] }
  | { kind: 'deferral'; date: string; id: string; item: DemoState['deferrals'][number] }

export function timelineFor(state: DemoState, donorId: string): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...state.donations.filter((d) => d.donorId === donorId).map((d) => ({ kind: 'donation' as const, date: d.date, id: d.id, item: d })),
    ...state.observations
      .filter((o) => o.donorId === donorId && isDisplayable(o.code))
      .map((o) => ({ kind: 'test' as const, date: o.date, id: o.id, item: o })),
    ...state.deferrals.filter((d) => d.donorId === donorId).map((d) => ({ kind: 'deferral' as const, date: d.from, id: d.id, item: d })),
  ]
  return entries.sort((a, b) => (a.date === b.date ? a.kind.localeCompare(b.kind) : b.date.localeCompare(a.date)))
}

export function facilityName(state: DemoState, id: string | undefined) {
  return state.facilities.find((f) => f.id === id)?.name ?? 'Unknown'
}
