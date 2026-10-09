// Test catalogue. Routine values use LOINC codes; verify them against current LOINC and
// NRCeS (India FHIR) guidance before certification.
//
// Infection-screening tests (transfusion-transmitted infections) use local codes and are
// marked `sensitive`. NBTC requires a positive result to be communicated confidentially by
// the blood centre, so these are never mapped for display in Donor Pass.

export const LOCAL_SYSTEM = 'urn:donorpass:local'

export interface TestDef {
  code: string
  system: 'http://loinc.org' | typeof LOCAL_SYSTEM
  display: string
  short: string
  unit?: string
  /** Default reference range if the lab sends none. */
  ref?: { low: number; high: number }
  category: 'haematology' | 'iron' | 'blood-group' | 'vitals' | 'infection-screening'
  sensitive?: boolean
}

export const TESTS: TestDef[] = [
  { code: '718-7', system: 'http://loinc.org', display: 'Haemoglobin', short: 'Hb', unit: 'g/dL', ref: { low: 12, high: 17 }, category: 'haematology' },
  { code: '2276-4', system: 'http://loinc.org', display: 'Ferritin', short: 'Ferritin', unit: 'ng/mL', ref: { low: 15, high: 300 }, category: 'iron' },
  { code: '4544-3', system: 'http://loinc.org', display: 'Haematocrit', short: 'HCT', unit: '%', ref: { low: 36, high: 50 }, category: 'haematology' },
  { code: '777-3', system: 'http://loinc.org', display: 'Platelet count', short: 'Platelets', unit: '10^3/uL', ref: { low: 150, high: 410 }, category: 'haematology' },
  { code: '6690-2', system: 'http://loinc.org', display: 'White cell count', short: 'WBC', unit: '10^3/uL', ref: { low: 4, high: 11 }, category: 'haematology' },
  { code: '789-8', system: 'http://loinc.org', display: 'Red cell count', short: 'RBC', unit: '10^6/uL', ref: { low: 3.8, high: 5.8 }, category: 'haematology' },
  { code: '883-9', system: 'http://loinc.org', display: 'ABO group', short: 'ABO', category: 'blood-group' },
  { code: '10331-7', system: 'http://loinc.org', display: 'Rh type', short: 'Rh', category: 'blood-group' },
  { code: '8480-6', system: 'http://loinc.org', display: 'Systolic blood pressure', short: 'BP sys', unit: 'mmHg', ref: { low: 100, high: 140 }, category: 'vitals' },
  { code: '8462-4', system: 'http://loinc.org', display: 'Diastolic blood pressure', short: 'BP dia', unit: 'mmHg', ref: { low: 60, high: 90 }, category: 'vitals' },
  { code: '29463-7', system: 'http://loinc.org', display: 'Body weight', short: 'Weight', unit: 'kg', category: 'vitals' },
  { code: 'tti-hiv', system: LOCAL_SYSTEM, display: 'HIV screening', short: 'HIV', category: 'infection-screening', sensitive: true },
  { code: 'tti-hbv', system: LOCAL_SYSTEM, display: 'Hepatitis B screening', short: 'HBsAg', category: 'infection-screening', sensitive: true },
  { code: 'tti-hcv', system: LOCAL_SYSTEM, display: 'Hepatitis C screening', short: 'HCV', category: 'infection-screening', sensitive: true },
  { code: 'tti-syphilis', system: LOCAL_SYSTEM, display: 'Syphilis screening', short: 'Syphilis', category: 'infection-screening', sensitive: true },
  { code: 'tti-malaria', system: LOCAL_SYSTEM, display: 'Malaria screening', short: 'Malaria', category: 'infection-screening', sensitive: true },
]

const BY_CODE = new Map(TESTS.map((t) => [t.code, t]))

export function testDef(code: string): TestDef | undefined {
  return BY_CODE.get(code)
}

export const CODES = {
  hb: '718-7',
  ferritin: '2276-4',
  abo: '883-9',
  rh: '10331-7',
  bpSys: '8480-6',
  bpDia: '8462-4',
  weight: '29463-7',
} as const

/** Sensitive (infection-screening) codes are never stored for display. */
export function isDisplayable(code: string): boolean {
  return !testDef(code)?.sensitive
}
