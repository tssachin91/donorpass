// Sync connector: turns a lab's own export (CSV here) into standard observations.
// Labs name tests in many ways; aliases map them to codes. Infection-screening tests are
// dropped at this step and never stored for display. Unknown tests are held for review.

import { CODES, testDef } from './codes'
import type { Observation, SourceSystem } from './types'

const ALIASES: Record<string, string> = {
  hb: '718-7',
  hgb: '718-7',
  hemoglobin: '718-7',
  haemoglobin: '718-7',
  ferritin: '2276-4',
  'serum ferritin': '2276-4',
  's. ferritin': '2276-4',
  hct: '4544-3',
  pcv: '4544-3',
  hematocrit: '4544-3',
  haematocrit: '4544-3',
  'platelet count': '777-3',
  platelets: '777-3',
  plt: '777-3',
  tlc: '6690-2',
  wbc: '6690-2',
  'total leucocyte count': '6690-2',
  'rbc count': '789-8',
  rbc: '789-8',
  'blood group': 'blood-group',
  'abo & rh': 'blood-group',
  hiv: 'tti-hiv',
  'hiv i & ii': 'tti-hiv',
  hbsag: 'tti-hbv',
  hcv: 'tti-hcv',
  'anti hcv': 'tti-hcv',
  vdrl: 'tti-syphilis',
  rpr: 'tti-syphilis',
  malaria: 'tti-malaria',
  mp: 'tti-malaria',
}

export interface LabRow {
  patientRef: string
  testName: string
  value: string
  unit?: string
  refRange?: string
  collectedOn: string
}

export interface MappedRow {
  row: LabRow
  outcome: 'mapped' | 'blocked' | 'unmapped' | 'invalid'
  codes: string[]
  note?: string
}

export interface MappingResult {
  observations: Observation[]
  rows: MappedRow[]
  counts: { mapped: number; blocked: number; unmapped: number; invalid: number }
}

/** Minimal CSV parser for the demo (no quoted commas). Header row required. */
export function parseLabCsv(text: string): LabRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const col = (name: string) => header.indexOf(name)
  const idx = {
    patientRef: col('patient_ref'),
    testName: col('test_name'),
    value: col('value'),
    unit: col('unit'),
    refRange: col('ref_range'),
    collectedOn: col('collected_on'),
  }
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim())
    const get = (i: number) => (i >= 0 ? cells[i] ?? '' : '')
    return {
      patientRef: get(idx.patientRef),
      testName: get(idx.testName),
      value: get(idx.value),
      unit: get(idx.unit) || undefined,
      refRange: get(idx.refRange) || undefined,
      collectedOn: get(idx.collectedOn),
    }
  })
}

function parseRange(range?: string): { low?: number; high?: number } {
  const m = range?.match(/(-?\d+(?:\.\d+)?)\s*[-–]\s*(-?\d+(?:\.\d+)?)/)
  return m ? { low: Number(m[1]), high: Number(m[2]) } : {}
}

function parseBloodGroup(value: string): { abo: string; rh: string } | undefined {
  const v = value.toUpperCase().replace(/\s+/g, ' ').trim()
  const m = v.match(/^(AB|A|B|O)\s*(\+|-|POS(?:ITIVE)?|NEG(?:ATIVE)?)$/)
  if (!m) return undefined
  return { abo: m[1], rh: m[2].startsWith('+') || m[2].startsWith('POS') ? 'Positive' : 'Negative' }
}

export interface MapOptions {
  /** Maps the lab's patient reference to a Donor Pass donor id. Unknown patients are skipped. */
  resolvePatient: (ref: string) => string | undefined
  labId: string
  source: SourceSystem
  idPrefix?: string
}

export function mapLabRows(rows: LabRow[], opts: MapOptions): MappingResult {
  const observations: Observation[] = []
  const out: MappedRow[] = []
  let n = 0
  const nextId = () => `${opts.idPrefix ?? 'obs'}-${Date.now().toString(36)}-${n++}`

  for (const row of rows) {
    const key = row.testName.trim().toLowerCase()
    const target = ALIASES[key]
    const donorId = opts.resolvePatient(row.patientRef)
    const date = row.collectedOn.slice(0, 10)

    if (!target) {
      out.push({ row, outcome: 'unmapped', codes: [], note: 'Unknown test name; held for review' })
      continue
    }
    if (testDef(target)?.sensitive) {
      out.push({ row, outcome: 'blocked', codes: [], note: 'Infection screening: not stored; the centre informs the donor' })
      continue
    }
    if (!donorId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      out.push({ row, outcome: 'invalid', codes: [], note: donorId ? 'Missing or bad date' : 'Patient not linked to a donor' })
      continue
    }

    if (target === 'blood-group') {
      const g = parseBloodGroup(row.value)
      if (!g) {
        out.push({ row, outcome: 'invalid', codes: [], note: 'Could not read blood group' })
        continue
      }
      const base = { donorId, date, labId: opts.labId, source: opts.source, verified: true }
      observations.push({ id: nextId(), code: CODES.abo, value: g.abo, ...base })
      observations.push({ id: nextId(), code: CODES.rh, value: g.rh, ...base })
      out.push({ row, outcome: 'mapped', codes: [CODES.abo, CODES.rh] })
      continue
    }

    const value = Number(row.value)
    if (!Number.isFinite(value)) {
      out.push({ row, outcome: 'invalid', codes: [], note: 'Value is not a number' })
      continue
    }
    const def = testDef(target)
    const range = parseRange(row.refRange)
    observations.push({
      id: nextId(),
      donorId,
      code: target,
      date,
      value,
      unit: row.unit || def?.unit,
      refLow: range.low ?? def?.ref?.low,
      refHigh: range.high ?? def?.ref?.high,
      labId: opts.labId,
      source: opts.source,
      verified: true,
    })
    out.push({ row, outcome: 'mapped', codes: [target] })
  }

  const counts = { mapped: 0, blocked: 0, unmapped: 0, invalid: 0 }
  for (const r of out) counts[r.outcome]++
  return { observations, rows: out, counts }
}
