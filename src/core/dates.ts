// Date helpers working on YYYY-MM-DD strings in UTC, so results do not shift by time zone.

const DAY = 86_400_000

export function toDate(iso: string): Date {
  return new Date(iso.slice(0, 10) + 'T00:00:00Z')
}

export function toIso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  return toIso(new Date(toDate(iso).getTime() + days * DAY))
}

export function addMonths(iso: string, months: number): string {
  const d = toDate(iso)
  const day = d.getUTCDate()
  d.setUTCDate(1)
  d.setUTCMonth(d.getUTCMonth() + months)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  d.setUTCDate(Math.min(day, last))
  return toIso(d)
}

/** Whole days from a to b (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY)
}

export function maxDate(...dates: string[]): string {
  return dates.reduce((m, d) => (d > m ? d : m))
}

export function ageOn(birthDate: string, on: string): number {
  const b = toDate(birthDate)
  const o = toDate(on)
  let age = o.getUTCFullYear() - b.getUTCFullYear()
  const beforeBirthday =
    o.getUTCMonth() < b.getUTCMonth() ||
    (o.getUTCMonth() === b.getUTCMonth() && o.getUTCDate() < b.getUTCDate())
  if (beforeBirthday) age -= 1
  return age
}

export function todayIso(): string {
  return toIso(new Date())
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatDate(iso: string): string {
  const d = toDate(iso)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}
