import { isLive, type MedicineEntry, type Patient, type Visit } from '../db/db'

// Day-end summary, dues list and medicine usage — pure functions over already
// loaded rows (callers pass getLiveVisits()/getLivePatients() or the raw
// tables; tombstoned rows are filtered here too, so either works).
//
// NOTE — "collected" is the sum of amount_paid on the visits *dated that day*.
// There is no payment ledger yet: when a balance is settled later from the Dues
// ledger, the old visit's amount_paid is edited, so that money is counted on the
// original visit day, not on the day it was actually received.

export interface RegisterRow {
  visitId: number | undefined
  patientId: number
  time: number // unix ms of the visit
  timeLabel: string // "10:42 am"
  patientName: string
  visitNumber: number
  medicines: string // "Nux Vomica 200, Sulphur 30"
  fee: number
  paid: number
  due: number
}

export interface DaySummary {
  dayStart: number
  dayEnd: number // exclusive
  visitCount: number
  uniquePatients: number
  newPatients: number
  totalFees: number
  collected: number
  newCredit: number
  topMedicines: MedicineUse[]
  rows: RegisterRow[]
}

export interface DueEntry {
  patientId: number
  name: string
  outstanding: number
  lastVisitDate: number | null
  dueVisits: number // number of visits with a balance
}

export interface MedicineUse {
  name: string
  count: number
}

// ─── Day boundaries (local time) ─────────────────────────────────────────────

export function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Start of the local calendar day `delta` days away. DST-safe (uses setDate). */
export function addDays(dayStart: number, delta: number): number {
  const d = new Date(startOfDay(dayStart))
  d.setDate(d.getDate() + delta)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

// ─── Formatting helpers ──────────────────────────────────────────────────────

/** "Name potency" — the short form used in the register line. */
export function medicineShort(m: Pick<MedicineEntry, 'name' | 'potency'>): string {
  return [m.name, m.potency].filter(Boolean).join(' ')
}

function timeLabel(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const num = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? n : 0)

function livePatientMap(patients: Patient[]): Map<number, Patient> {
  return new Map(patients.filter((p) => isLive(p) && p.id !== undefined).map((p) => [p.id!, p]))
}

function liveVisitsOf(visits: Visit[], pmap: Map<number, Patient>): Visit[] {
  return visits.filter((v) => isLive(v) && pmap.has(v.patient_id))
}

function rankCounts(counts: Map<string, number>): MedicineUse[] {
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

// ─── Day summary ─────────────────────────────────────────────────────────────

export function summarizeDay(visits: Visit[], patients: Patient[], dayStart: number): DaySummary {
  const start = startOfDay(dayStart)
  const end = addDays(start, 1)
  const pmap = livePatientMap(patients)
  const live = liveVisitsOf(visits, pmap)

  // First-ever live visit per patient: (date, id) ordering
  const firstVisit = new Map<number, Visit>()
  for (const v of live) {
    const cur = firstVisit.get(v.patient_id)
    if (!cur || v.date < cur.date || (v.date === cur.date && (v.id ?? 0) < (cur.id ?? 0))) {
      firstVisit.set(v.patient_id, v)
    }
  }

  const today = live
    .filter((v) => v.date >= start && v.date < end)
    .sort((a, b) => a.date - b.date || (a.id ?? 0) - (b.id ?? 0))

  const seen = new Set<number>()
  const fresh = new Set<number>()
  const medCounts = new Map<string, number>()
  let totalFees = 0
  let collected = 0
  let newCredit = 0

  const rows: RegisterRow[] = today.map((v) => {
    seen.add(v.patient_id)
    const first = firstVisit.get(v.patient_id)
    if (first && first.date >= start && first.date < end) fresh.add(v.patient_id)
    const fee = num(v.fee_total)
    const paid = num(v.amount_paid)
    const due = num(v.amount_due)
    totalFees += fee
    collected += paid
    if (due > 0) newCredit += due
    const meds = (v.medicines_json ?? []).filter((m) => m?.name)
    for (const m of meds) medCounts.set(m.name, (medCounts.get(m.name) ?? 0) + 1)
    return {
      visitId: v.id,
      patientId: v.patient_id,
      time: v.date,
      timeLabel: timeLabel(v.date),
      patientName: pmap.get(v.patient_id)!.name,
      visitNumber: v.visit_number,
      medicines: meds.map(medicineShort).join(', '),
      fee,
      paid,
      due,
    }
  })

  return {
    dayStart: start,
    dayEnd: end,
    visitCount: today.length,
    uniquePatients: seen.size,
    newPatients: fresh.size,
    totalFees,
    collected,
    newCredit,
    topMedicines: rankCounts(medCounts),
    rows,
  }
}

// ─── Dues ────────────────────────────────────────────────────────────────────

/** Live patients with a positive total outstanding, largest first. */
export function duesList(visits: Visit[], patients: Patient[]): DueEntry[] {
  const pmap = livePatientMap(patients)
  const byPatient = new Map<number, DueEntry>()
  for (const v of liveVisitsOf(visits, pmap)) {
    let e = byPatient.get(v.patient_id)
    if (!e) {
      e = { patientId: v.patient_id, name: pmap.get(v.patient_id)!.name, outstanding: 0, lastVisitDate: null, dueVisits: 0 }
      byPatient.set(v.patient_id, e)
    }
    const due = num(v.amount_due)
    if (due > 0) {
      e.outstanding += due
      e.dueVisits += 1
    }
    if (e.lastVisitDate === null || v.date > e.lastVisitDate) e.lastVisitDate = v.date
  }
  return [...byPatient.values()]
    .filter((e) => e.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding || a.name.localeCompare(b.name))
}

// ─── Medicine usage ──────────────────────────────────────────────────────────

/** Medicine name → times prescribed on live visits dated at or after `sinceMs`. */
export function medicineUsage(visits: Visit[], sinceMs: number): MedicineUse[] {
  const counts = new Map<string, number>()
  for (const v of visits) {
    if (!isLive(v) || v.date < sinceMs) continue
    for (const m of v.medicines_json ?? []) {
      if (!m?.name) continue
      counts.set(m.name, (counts.get(m.name) ?? 0) + 1)
    }
  }
  return rankCounts(counts)
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function dayToCsv(summary: DaySummary): string {
  const header = ['Time', 'Patient', 'Visit #', 'Medicines', 'Fee', 'Paid', 'Due']
  const rows = summary.rows.map((r) => [r.timeLabel, r.patientName, r.visitNumber, r.medicines, r.fee, r.paid, r.due])
  const totals = ['', 'TOTAL', '', `${summary.visitCount} visits`, summary.totalFees, summary.collected, summary.newCredit]
  return [header, ...rows, totals].map((r) => r.map(csvCell).join(',')).join('\r\n')
}
