// Front-door donor form: the screening questions a donor answers on their phone before
// arriving. Identity fields are pre-filled from the profile; these questions are always
// answered fresh. A "yes" does not decide anything by itself: it flags the answer for the
// medical officer at the centre.
//
// Wording is a demo summary of NBTC screening topics, not the official questionnaire.

export interface ScreeningQuestion {
  id: string
  text: string
  /** Shown to staff when the answer is "yes". */
  staffNote: string
}

export const SCREENING_QUESTIONS: ScreeningQuestion[] = [
  { id: 'feel-well', text: 'Are you feeling unwell today, or have you had fever, cold or cough in the last 14 days?', staffNote: 'Recent illness reported' },
  { id: 'meds', text: 'Have you taken antibiotics or any new medicine in the last 14 days?', staffNote: 'Recent medication reported' },
  { id: 'vaccine', text: 'Have you had a vaccination in the last 28 days?', staffNote: 'Recent vaccination' },
  { id: 'tattoo', text: 'Have you had a tattoo, piercing or acupuncture in the last 12 months?', staffNote: 'Tattoo or piercing within 12 months' },
  { id: 'surgery', text: 'Have you had surgery, a dental extraction or a transfusion recently?', staffNote: 'Recent procedure or transfusion' },
  { id: 'travel', text: 'Have you had malaria, or travelled to a malaria-affected area, in the last 3 months?', staffNote: 'Malaria history or travel' },
  { id: 'pregnancy', text: 'Are you pregnant, breastfeeding, or have you given birth in the last 12 months?', staffNote: 'Pregnancy or breastfeeding' },
  { id: 'alcohol', text: 'Have you had alcohol in the last 24 hours?', staffNote: 'Alcohol within 24 hours' },
  { id: 'meal', text: 'Have you skipped your last meal?', staffNote: 'Fasting; offer refreshment before donation' },
  { id: 'risk', text: 'Is there any reason your blood might not be safe for a patient (risk behaviour or exposure)?', staffNote: 'Possible risk exposure; discuss privately' },
]

export function flaggedAnswers(answers: Record<string, boolean>): ScreeningQuestion[] {
  return SCREENING_QUESTIONS.filter((q) => answers[q.id])
}

export function allAnswered(answers: Record<string, boolean>): boolean {
  return SCREENING_QUESTIONS.every((q) => typeof answers[q.id] === 'boolean')
}

/** NBTC-style on-the-day checks the centre staff record. */
export function vitalsIssues(v: { weightKg: number; hb: number; bpSys: number; bpDia: number; pulse: number }): string[] {
  const issues: string[] = []
  if (v.weightKg < 45) issues.push('Weight below 45 kg')
  if (v.hb < 12.5) issues.push('Haemoglobin below 12.5 g/dL')
  if (v.bpSys < 100 || v.bpSys > 140) issues.push('Systolic pressure outside 100 to 140 mmHg')
  if (v.bpDia < 60 || v.bpDia > 90) issues.push('Diastolic pressure outside 60 to 90 mmHg')
  if (v.pulse < 60 || v.pulse > 100) issues.push('Pulse outside 60 to 100 per minute')
  return issues
}
