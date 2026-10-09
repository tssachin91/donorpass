// Export a donor's records as a FHIR R4 Bundle: the open data model.
// The shapes follow base FHIR R4. India's NRCeS profiles and ABDM-specific extensions
// would be applied at certification time.

import { LOCAL_SYSTEM, isDisplayable, testDef } from './codes'
import type { Donation, Donor, Observation } from './types'

type Json = Record<string, unknown>

const DONATION_CODES: Record<Donation['type'], { code: string; display: string }> = {
  // Local codes for now; map to SNOMED CT at certification.
  'whole-blood': { code: 'whole-blood-donation', display: 'Whole blood donation' },
  platelets: { code: 'plateletpheresis', display: 'Plateletpheresis donation' },
  plasma: { code: 'plasmapheresis', display: 'Plasmapheresis donation' },
}

export function patientResource(d: Donor): Json {
  const [given, ...family] = d.name.split(' ')
  return {
    resourceType: 'Patient',
    id: d.id,
    identifier: d.abhaAddress
      ? [{ system: 'https://healthid.abdm.gov.in', value: d.abhaAddress }]
      : [],
    name: [{ given: [given], family: family.join(' ') || undefined }],
    gender: d.sex,
    birthDate: d.birthDate,
    extension: [
      {
        url: `${LOCAL_SYSTEM}/blood-group`,
        valueString: d.bloodGroup,
      },
    ],
  }
}

export function observationResource(o: Observation): Json {
  const def = testDef(o.code)
  const value =
    typeof o.value === 'number'
      ? { valueQuantity: { value: o.value, unit: o.unit, system: 'http://unitsofmeasure.org' } }
      : { valueString: o.value }
  return {
    resourceType: 'Observation',
    id: o.id,
    status: 'final',
    code: { coding: [{ system: def?.system ?? LOCAL_SYSTEM, code: o.code, display: def?.display }] },
    subject: { reference: `Patient/${o.donorId}` },
    effectiveDateTime: o.date,
    ...value,
    referenceRange:
      o.refLow !== undefined || o.refHigh !== undefined
        ? [{ low: { value: o.refLow, unit: o.unit }, high: { value: o.refHigh, unit: o.unit } }]
        : undefined,
    meta: { source: o.source, tag: o.verified ? [{ code: 'verified' }] : [{ code: 'unverified' }] },
  }
}

export function donationResource(d: Donation): Json {
  const c = DONATION_CODES[d.type]
  return {
    resourceType: 'Procedure',
    id: d.id,
    status: 'completed',
    code: { coding: [{ system: LOCAL_SYSTEM, code: c.code, display: c.display }] },
    subject: { reference: `Patient/${d.donorId}` },
    performedDateTime: d.date,
    location: { reference: `Location/${d.centreId}` },
    meta: { source: d.source, tag: d.verified ? [{ code: 'verified' }] : [{ code: 'unverified' }] },
  }
}

export function donorBundle(donor: Donor, donations: Donation[], observations: Observation[]): Json {
  const entries = [
    patientResource(donor),
    ...donations.filter((d) => d.donorId === donor.id).map(donationResource),
    ...observations.filter((o) => o.donorId === donor.id && isDisplayable(o.code)).map(observationResource),
  ]
  return {
    resourceType: 'Bundle',
    type: 'collection',
    timestamp: new Date().toISOString(),
    entry: entries.map((resource) => ({ fullUrl: `urn:uuid:${(resource as { id: string }).id}`, resource })),
  }
}
