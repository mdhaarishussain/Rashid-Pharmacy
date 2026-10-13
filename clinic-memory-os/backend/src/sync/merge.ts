// Pure helpers for sync v2 — validated wire records and last-write-wins.

export interface WirePatient {
  uid: string
  name: string
  quick_note: string
  created_at: number
  updated_at: number
  deleted_at: number | null
  phone: string | null
  sex: 'M' | 'F' | 'O' | null
  birth_year: number | null
}

export interface WireVisit {
  uid: string
  patient_uid: string
  date: number
  symptoms_text: string
  medicines_json: unknown[]
  fee_total: number
  amount_paid: number
  amount_due: number
  visit_number: number
  updated_at: number
  deleted_at: number | null
  follow_up_date: number | null
}

export type Kind = 'patients' | 'visits'

const MAX_UID = 100
const finite = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)
const optTime = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
const MAX_PHONE = 20
const PHONE_RE = /^[0-9+\-\s]+$/
const SEXES = ['M', 'F', 'O'] as const

/** Digits, +, spaces and dashes only, at most 20 chars; anything else is dropped. */
export function sanitizePhone(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 && t.length <= MAX_PHONE && PHONE_RE.test(t) ? t : null
}

export function sanitizeSex(v: unknown): 'M' | 'F' | 'O' | null {
  return SEXES.includes(v as (typeof SEXES)[number]) ? (v as 'M' | 'F' | 'O') : null
}

export function sanitizeBirthYear(v: unknown, now = Date.now()): number | null {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1900 && v <= new Date(now).getFullYear() ? v : null
}

const uidOf = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= MAX_UID ? v : null)

/** Returns a clean record, or null when it cannot be stored (missing uid / timestamp). */
export function sanitizePatient(raw: any): WirePatient | null {
  const uid = uidOf(raw?.uid)
  const updated_at = optTime(raw?.updated_at)
  if (!uid || !updated_at) return null
  return {
    uid,
    name: String(raw.name ?? '').trim().substring(0, 200),
    quick_note: String(raw.quick_note ?? '').trim().substring(0, 500),
    created_at: optTime(raw.created_at) ?? updated_at,
    updated_at,
    deleted_at: optTime(raw.deleted_at),
    phone: sanitizePhone(raw.phone),
    sex: sanitizeSex(raw.sex),
    birth_year: sanitizeBirthYear(raw.birth_year),
  }
}

export function sanitizeVisit(raw: any): WireVisit | null {
  const uid = uidOf(raw?.uid)
  const patient_uid = uidOf(raw?.patient_uid)
  const updated_at = optTime(raw?.updated_at)
  if (!uid || !patient_uid || !updated_at) return null
  const fee_total = finite(raw.fee_total)
  const amount_paid = finite(raw.amount_paid)
  return {
    uid,
    patient_uid,
    date: optTime(raw.date) ?? updated_at,
    symptoms_text: String(raw.symptoms_text ?? '').substring(0, 5000),
    medicines_json: Array.isArray(raw.medicines_json) ? raw.medicines_json.slice(0, 20) : [],
    fee_total,
    amount_paid,
    amount_due: fee_total - amount_paid,
    visit_number: Math.max(1, Math.floor(finite(raw.visit_number, 1))),
    updated_at,
    deleted_at: optTime(raw.deleted_at),
    follow_up_date: optTime(raw.follow_up_date),
  }
}

/**
 * Last-write-wins on the client edit time. An incoming record is written only
 * when the server has no copy or its copy is strictly older; ties keep the
 * stored version so repeated pushes are idempotent.
 */
export function pickWinners<T extends { uid: string; updated_at: number }>(
  incoming: T[],
  storedUpdatedAt: Map<string, number>
): { winners: T[]; stale: number } {
  // Collapse duplicates within one batch to the newest copy
  const newest = new Map<string, T>()
  for (const rec of incoming) {
    const prev = newest.get(rec.uid)
    if (!prev || prev.updated_at < rec.updated_at) newest.set(rec.uid, rec)
  }
  const winners: T[] = []
  let stale = 0
  for (const rec of newest.values()) {
    const stored = storedUpdatedAt.get(rec.uid)
    if (stored === undefined || stored < rec.updated_at) winners.push(rec)
    else stale++
  }
  return { winners, stale: stale + (incoming.length - newest.size) }
}

export interface Cursor { t: number; uid: string }

/** Mongo filter for "after this cursor" on the (synced_at, uid) ordering. */
export function cursorFilter(after: Cursor | null | undefined): Record<string, unknown> {
  if (!after || typeof after.t !== 'number' || typeof after.uid !== 'string') return {}
  return {
    $or: [
      { synced_at: { $gt: after.t } },
      { synced_at: after.t, uid: { $gt: after.uid } },
    ],
  }
}
