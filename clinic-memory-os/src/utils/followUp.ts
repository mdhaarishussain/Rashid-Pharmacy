import type { Visit } from '../db/db'

// Follow-up dates are stored as unix ms at *local noon* of the chosen day, so
// they stay on the same calendar day in any timezone the tablet might be in.

export const DAY_MS = 24 * 3600 * 1000

/** Local noon of the day containing `ts`. */
export function toFollowUpDate(ts: number): number {
  return new Date(ts).setHours(12, 0, 0, 0)
}

export function addDaysToFollowUp(days: number, now = Date.now()): number {
  const d = new Date(now)
  d.setDate(d.getDate() + days)
  return toFollowUpDate(d.getTime())
}

/** Calendar months, clamped to the end of shorter months (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsToFollowUp(months: number, now = Date.now()): number {
  const d = new Date(now)
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, lastDay))
  return toFollowUpDate(d.getTime())
}

/** yyyy-mm-dd in local time, for <input type="date">. */
export function followUpToInputValue(ts: number | null | undefined): string {
  if (!ts) return ''
  const d = new Date(ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

export function followUpFromInputValue(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const ts = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0).getTime()
  return Number.isFinite(ts) ? ts : null
}

export function startOfLocalDay(now = Date.now()): number {
  return new Date(now).setHours(0, 0, 0, 0)
}

export function endOfLocalDay(now = Date.now()): number {
  return new Date(now).setHours(23, 59, 59, 999)
}

// ─── Due computation ─────────────────────────────────────────────────────────

export interface DueEntry {
  patientId: number
  visitId: number
  followUpDate: number
  /** 0 = due today, N = N calendar days overdue */
  daysOverdue: number
}

export interface DueSummary {
  today: number
  overdue: number
}

/** Newest live visit by date (ties broken by id), or undefined. */
export function latestVisit(visits: Visit[]): Visit | undefined {
  let best: Visit | undefined
  for (const v of visits) {
    if (v.deleted_at) continue
    if (!best || v.date > best.date || (v.date === best.date && (v.id ?? 0) > (best.id ?? 0))) best = v
  }
  return best
}

/**
 * Pure due logic. `candidates` are live visits whose follow_up_date is on or
 * before today; `latestByPatient` holds each patient's newest live visit. A
 * follow-up counts only when it sits on that newest visit — i.e. the patient
 * has not come back since. Most overdue first.
 */
export function computeDue(
  candidates: Visit[],
  latestByPatient: Map<number, Visit | undefined>,
  now = Date.now()
): DueEntry[] {
  const dayStart = startOfLocalDay(now)
  const dayEnd = endOfLocalDay(now)
  const todayNoon = toFollowUpDate(now)
  const entries: DueEntry[] = []
  for (const v of candidates) {
    const fu = v.follow_up_date
    if (v.deleted_at || !v.id || typeof fu !== 'number' || fu <= 0 || fu > dayEnd) continue
    if (latestByPatient.get(v.patient_id)?.id !== v.id) continue
    entries.push({
      patientId: v.patient_id,
      visitId: v.id,
      followUpDate: fu,
      daysOverdue: fu >= dayStart ? 0 : Math.max(1, Math.round((todayNoon - toFollowUpDate(fu)) / DAY_MS)),
    })
  }
  return entries.sort((a, b) => b.daysOverdue - a.daysOverdue || a.followUpDate - b.followUpDate)
}

export function summariseDue(entries: DueEntry[]): DueSummary {
  const overdue = entries.filter((e) => e.daysOverdue > 0).length
  return { today: entries.length - overdue, overdue }
}
