import type { MedicineEntry, Patient, Sex, Visit } from '../db/db'

// ─── Wire format (sync v2 + backup files) ────────────────────────────────────
// Records are identified by `uid`; local numeric ids never leave the device.

export interface WirePatient {
  uid: string
  name: string
  quick_note: string
  created_at: number
  updated_at: number
  deleted_at: number | null
  // Identity fields. Optional on the wire: older backups and peers omit them,
  // which means "unknown" (an explicit null means "cleared").
  phone?: string | null
  sex?: Sex | null
  birth_year?: number | null
}

export interface WireVisit {
  uid: string
  patient_uid: string
  date: number
  symptoms_text: string
  medicines_json: MedicineEntry[]
  fee_total: number
  amount_paid: number
  amount_due: number
  visit_number: number
  updated_at: number
  deleted_at: number | null
  follow_up_date?: number | null
}

export function patientToWire(p: Patient): WirePatient {
  return {
    uid: p.uid!,
    name: p.name,
    quick_note: p.quick_note ?? '',
    created_at: p.created_at,
    updated_at: p.updated_at ?? p.created_at,
    deleted_at: p.deleted_at ?? null,
    phone: p.phone ?? null,
    sex: p.sex ?? null,
    birth_year: p.birth_year ?? null,
  }
}

export function visitToWire(v: Visit, patientUid: string): WireVisit {
  return {
    uid: v.uid!,
    patient_uid: patientUid,
    date: v.date,
    symptoms_text: v.symptoms_text ?? '',
    medicines_json: v.medicines_json ?? [],
    fee_total: v.fee_total,
    amount_paid: v.amount_paid,
    amount_due: v.amount_due,
    visit_number: v.visit_number,
    updated_at: v.updated_at ?? v.date,
    deleted_at: v.deleted_at ?? null,
    follow_up_date: v.follow_up_date ?? null,
  }
}

/**
 * Resolve an optional wire field against the local row: absent (undefined)
 * keeps what we have, null clears it, a value replaces it.
 */
function resolveOptional<T>(remote: T | null | undefined, local: T | undefined): T | undefined {
  if (remote === undefined) return local
  return remote === null ? undefined : remote
}

/** Last-write-wins: a remote record replaces the local one only if strictly newer. */
export function remoteWins(local: { updated_at?: number } | undefined, remote: { updated_at: number }): boolean {
  return !local || (local.updated_at ?? 0) < remote.updated_at
}

/** Drop undefined entries so cleared fields are omitted from the stored row. */
function optionalFields<T extends Record<string, unknown>>(fields: T): Partial<T> {
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)) as Partial<T>
}

export interface PlannedWrites<T> {
  writes: T[]
  skipped: number
}

/** Decide which remote patients to write locally, keeping local ids for known uids. */
export function planPatientWrites(
  remote: WirePatient[],
  localByUid: Map<string, Patient>,
  markDirty = false
): PlannedWrites<Patient> {
  const writes: Patient[] = []
  let skipped = 0
  for (const r of remote) {
    const local = localByUid.get(r.uid)
    if (!remoteWins(local, r)) { skipped++; continue }
    writes.push({
      ...(local?.id !== undefined && { id: local.id }),
      uid: r.uid,
      name: r.name,
      quick_note: r.quick_note,
      created_at: r.created_at,
      ...optionalFields({
        phone: resolveOptional(r.phone, local?.phone),
        sex: resolveOptional(r.sex, local?.sex),
        birth_year: resolveOptional(r.birth_year, local?.birth_year),
      }),
      updated_at: r.updated_at,
      deleted_at: r.deleted_at,
      dirty: markDirty ? 1 : 0,
    })
  }
  return { writes, skipped }
}

/**
 * Decide which remote visits to write locally. `patientIdByUid` maps patient
 * uids to local ids; visits whose patient is unknown here are skipped.
 */
export function planVisitWrites(
  remote: WireVisit[],
  localByUid: Map<string, Visit>,
  patientIdByUid: Map<string, number>,
  markDirty = false
): PlannedWrites<Visit> & { orphaned: number } {
  const writes: Visit[] = []
  let skipped = 0
  let orphaned = 0
  for (const r of remote) {
    const patientId = patientIdByUid.get(r.patient_uid)
    if (patientId === undefined) { orphaned++; continue }
    const local = localByUid.get(r.uid)
    if (!remoteWins(local, r)) { skipped++; continue }
    writes.push({
      ...(local?.id !== undefined && { id: local.id }),
      uid: r.uid,
      patient_id: patientId,
      date: r.date,
      symptoms_text: r.symptoms_text,
      medicines_json: r.medicines_json,
      fee_total: r.fee_total,
      amount_paid: r.amount_paid,
      amount_due: r.amount_due,
      visit_number: r.visit_number,
      follow_up_date: resolveOptional(r.follow_up_date, local?.follow_up_date) ?? null,
      updated_at: r.updated_at,
      deleted_at: r.deleted_at,
      dirty: markDirty ? 1 : 0,
    })
  }
  return { writes, skipped, orphaned }
}
