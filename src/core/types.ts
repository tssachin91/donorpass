// Domain types for the Donor Pass demo.
// Records are kept close to FHIR R4 shapes so they can be exported as FHIR
// resources (see fhir.ts) and later exchanged through ABDM.

export type Sex = 'male' | 'female'

export type BloodGroup = 'O+' | 'O-' | 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-'

export const BLOOD_GROUPS: BloodGroup[] = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

/** Whole blood is collected every 90/120 days; platelets and plasma by apheresis. */
export type DonationType = 'whole-blood' | 'platelets' | 'plasma'

/** Where a record came from. Shown to donors as a badge so they know what is verified. */
export type SourceSystem =
  | 'e-raktkosh' // blood centre record (simulated read from e-RaktKosh)
  | 'centre-desk' // recorded at a partner centre through Donor Pass
  | 'abdm' // lab or hospital report received through ABDM with consent (simulated)
  | 'lab-sync' // lab report delivered through the Donor Pass sync connector
  | 'upload' // donor uploaded a PDF report; values extracted, not verified
  | 'self-reported' // donor typed it in

export interface GeoPoint {
  lat: number
  lng: number
  area: string
}

export interface Consents {
  /** Keep donation and test records in Donor Pass. */
  records: boolean
  /** Eligibility and shortage reminders. */
  reminders: boolean
  /** Receive verified blood requests from nearby hospitals. */
  requests: boolean
  /** Let partner labs send reports to Donor Pass. */
  labSharing: boolean
  /** Share active-donor status with a partner insurer (upside feature, off by default). */
  insurer: boolean
}

export interface Donor {
  id: string
  name: string
  phone: string
  sex: Sex
  birthDate: string // YYYY-MM-DD
  weightKg: number
  bloodGroup: BloodGroup
  /** Only groups confirmed by a licensed centre are used for matching. */
  bloodGroupVerified: boolean
  location: GeoPoint
  language: 'en' | 'hi' | 'mr'
  consents: Consents
  /** Immediate family members covered by the Donor Pass benefit. */
  family: string[]
  abhaAddress?: string
}

export interface Donation {
  id: string
  donorId: string
  date: string
  type: DonationType
  centreId: string
  volumeMl: number
  verified: boolean
  source: SourceSystem
}

export interface Deferral {
  id: string
  donorId: string
  reason: string
  from: string
  /** Last day of the deferral. Permanent deferrals are not modelled in the demo. */
  until: string
  source: SourceSystem
}

export interface Observation {
  id: string
  donorId: string
  /** LOINC code where known, otherwise a local code (see codes.ts). */
  code: string
  date: string
  value: number | string
  unit?: string
  refLow?: number
  refHigh?: number
  labId?: string
  source: SourceSystem
  verified: boolean
}

export type FacilityKind = 'hospital' | 'lab' | 'blood-centre'

export interface Facility {
  id: string
  kind: FacilityKind
  name: string
  location: GeoPoint
  /** Partner verified by Donor Pass (licence and registry checked). */
  verified: boolean
  /** Whether the facility's own software already talks to ABDM. */
  abdmReady?: boolean
}

export type Component = 'red-cells' | 'platelets' | 'plasma'

export type RequestStatus = 'awaiting-verification' | 'open' | 'fulfilled' | 'cancelled'

export interface RequestResponse {
  donorId: string
  status: 'pinged' | 'accepted' | 'declined' | 'arrived'
  at: string
}

export interface BloodRequest {
  id: string
  hospitalId: string
  /** Licensed blood centre where donors are sent. Donors never go to the family. */
  centreId: string
  patientGroup: BloodGroup
  component: Component
  units: number
  neededBy: string // ISO datetime
  raisedBy: 'staff' | 'family'
  /** A family request needs the hospital requisition slip, confirmed by staff. */
  slipVerified: boolean
  status: RequestStatus
  createdAt: string
  radiusKm?: number
  responses: RequestResponse[]
}

export interface FrontDoorForm {
  token: string
  donorId: string
  createdAt: string
  intendedType: DonationType
  /** Screening answers, true = "yes". Always answered fresh, never pre-filled. */
  answers: Record<string, boolean>
  status: 'submitted' | 'pulled' | 'approved' | 'deferred'
  vitals?: Vitals
  decisionNote?: string
  centreId?: string
}

export interface Vitals {
  weightKg: number
  hb: number
  bpSys: number
  bpDia: number
  pulse: number
}

export interface WaiverRedemption {
  id: string
  donorId: string
  date: string
  centreId: string
  beneficiary: string
}
