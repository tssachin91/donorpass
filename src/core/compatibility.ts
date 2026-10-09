// ABO/Rh compatibility used to decide which donors to alert for a request.
// The blood centre always cross-matches before issue; this only narrows who is asked.

import type { BloodGroup, Component } from './types'

const abo = (g: BloodGroup) => g.replace(/[+-]$/, '') as 'O' | 'A' | 'B' | 'AB'
const rhNeg = (g: BloodGroup) => g.endsWith('-')

/** Red cells: O gives to all, AB receives from all, Rh-negative recipients need Rh-negative. */
function redCellOk(donor: BloodGroup, recipient: BloodGroup): boolean {
  const d = abo(donor)
  const r = abo(recipient)
  const aboOk = d === 'O' || d === r || r === 'AB'
  const rhOk = !rhNeg(recipient) || rhNeg(donor)
  return aboOk && rhOk
}

/** Plasma: the reverse of red cells for ABO; Rh does not apply. AB plasma suits everyone. */
function plasmaOk(donor: BloodGroup, recipient: BloodGroup): boolean {
  const d = abo(donor)
  const r = abo(recipient)
  return d === 'AB' || d === r || r === 'O'
}

/** Platelets: ask ABO-identical donors; Rh-negative recipients get Rh-negative donors. */
function plateletOk(donor: BloodGroup, recipient: BloodGroup): boolean {
  return abo(donor) === abo(recipient) && (!rhNeg(recipient) || rhNeg(donor))
}

export function isCompatible(donor: BloodGroup, recipient: BloodGroup, component: Component): boolean {
  if (component === 'red-cells') return redCellOk(donor, recipient)
  if (component === 'plasma') return plasmaOk(donor, recipient)
  return plateletOk(donor, recipient)
}

export function compatibleDonorGroups(recipient: BloodGroup, component: Component): BloodGroup[] {
  const all: BloodGroup[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
  return all.filter((g) => isCompatible(g, recipient, component))
}
