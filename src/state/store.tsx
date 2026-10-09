// Demo store: all data lives in the browser (localStorage) and can be reset at any time.
// In production these actions become API calls to the Donor Pass backend, which in turn
// reads from e-RaktKosh and ABDM.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { todayIso } from '../core/dates'
import type { BloodRequest, Consents, Deferral, Donation, FrontDoorForm, Observation, RequestResponse, Vitals, WaiverRedemption } from '../core/types'
import { buildSeed, STATE_VERSION, type ActivityEvent, type DemoState } from '../data/seed'

const KEY = 'donor-pass-demo'

function load(): DemoState {
  const today = todayIso()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState
      // Rebuild when the data format changed or the stored demo is from an earlier day,
      // so relative dates in the sample data stay sensible.
      if (parsed.version === STATE_VERSION && parsed.today === today) return parsed
    }
  } catch {
    // Storage unavailable or corrupt: fall back to fresh sample data.
  }
  return buildSeed(today)
}

function save(state: DemoState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    // Private mode or quota: the demo still works in memory.
  }
}

let idCounter = 0
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(idCounter++).toString(36)}`

export interface Actions {
  reset: () => void
  log: (kind: ActivityEvent['kind'], text: string) => void
  setConsents: (donorId: string, consents: Consents) => void
  addObservations: (obs: Observation[]) => void
  addDonation: (d: Donation) => void
  addDeferral: (d: Deferral) => void
  upsertForm: (f: FrontDoorForm) => void
  updateForm: (token: string, patch: Partial<FrontDoorForm>) => void
  recordVitals: (token: string, vitals: Vitals) => void
  addRequest: (r: BloodRequest) => void
  updateRequest: (id: string, patch: Partial<BloodRequest>) => void
  respond: (requestId: string, response: RequestResponse) => void
  redeem: (r: WaiverRedemption) => void
}

interface Ctx {
  state: DemoState
  actions: Actions
}

const StoreContext = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(load)

  useEffect(() => save(state), [state])

  const update = useCallback((fn: (s: DemoState) => DemoState) => setState((s) => fn(s)), [])

  const actions = useMemo<Actions>(() => {
    const event = (kind: ActivityEvent['kind'], text: string): ActivityEvent => ({
      id: newId('ev'),
      at: new Date().toISOString(),
      kind,
      text,
    })
    return {
      reset: () => setState(buildSeed(todayIso())),
      log: (kind, text) => update((s) => ({ ...s, events: [event(kind, text), ...s.events] })),
      setConsents: (donorId, consents) =>
        update((s) => ({ ...s, donors: s.donors.map((d) => (d.id === donorId ? { ...d, consents } : d)) })),
      addObservations: (obs) => update((s) => ({ ...s, observations: [...s.observations, ...obs] })),
      addDonation: (don) => update((s) => ({ ...s, donations: [...s.donations, don] })),
      addDeferral: (def) => update((s) => ({ ...s, deferrals: [...s.deferrals, def] })),
      upsertForm: (f) => update((s) => ({ ...s, forms: [f, ...s.forms.filter((x) => x.token !== f.token)] })),
      updateForm: (token, patch) =>
        update((s) => ({ ...s, forms: s.forms.map((f) => (f.token === token ? { ...f, ...patch } : f)) })),
      recordVitals: (token, vitals) =>
        update((s) => ({ ...s, forms: s.forms.map((f) => (f.token === token ? { ...f, vitals } : f)) })),
      addRequest: (r) => update((s) => ({ ...s, requests: [r, ...s.requests] })),
      updateRequest: (id, patch) =>
        update((s) => ({ ...s, requests: s.requests.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      respond: (requestId, response) =>
        update((s) => ({
          ...s,
          requests: s.requests.map((r) =>
            r.id === requestId
              ? { ...r, responses: [...r.responses.filter((x) => x.donorId !== response.donorId), response] }
              : r,
          ),
        })),
      redeem: (red) => update((s) => ({ ...s, redemptions: [...s.redemptions, red] })),
    }
  }, [update])

  return <StoreContext.Provider value={{ state, actions }}>{children}</StoreContext.Provider>
}

export function useStore(): Ctx {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}

export function useFacility(id: string | undefined) {
  const { state } = useStore()
  return state.facilities.find((f) => f.id === id)
}
