import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type { MedicineType } from '../data/medicines'

// ─── Domain types ────────────────────────────────────────────────────────────

export interface MedicineEntry {
  name: string
  potency: string
  type?: MedicineType  // stored so tincture/biochemic behaviour survives potency changes
  freq?: string        // 'OD' | 'BD' | 'TD' | 'QD' | 'HS'
  food?: string        // 'AC' | 'PC'
  days?: number        // 3 | 5 | 7 | 10
  qty?: number         // pills count (1/2/3/6) or drops count (5/10/15/20)
}

// Sync metadata shared by every synced table. `id` stays a local-only
// auto-increment key; `uid` is the identity used across devices and the cloud.
export interface SyncMeta {
  uid?: string
  updated_at?: number        // unix ms of the last local edit (last-write-wins)
  deleted_at?: number | null // tombstone — rows are never hard-deleted
  dirty?: 0 | 1              // 1 = changed locally and not yet pushed
}

export interface Patient extends SyncMeta {
  id?: number
  name: string
  quick_note: string
  created_at: number // unix ms
  // Identity — helps tell apart patients with similar names
  phone?: string
  sex?: Sex
  birth_year?: number // the doctor types an age; we store currentYear - age
}

export type Sex = 'M' | 'F' | 'O'

export interface Visit extends SyncMeta {
  id?: number
  patient_id: number
  date: number // unix ms
  symptoms_text: string
  medicines_json: MedicineEntry[]
  fee_total: number
  amount_paid: number
  amount_due: number
  visit_number: number
  follow_up_date?: number | null // unix ms, local noon of the day the patient should return
}

// ─── Draft ───────────────────────────────────────────────────────────────────

export interface VisitDraft {
  patient_id: number
  visit_id?: number // undefined = new unsaved visit
  medicines_json: MedicineEntry[]
  symptoms_text: string
  fee_total: number
  amount_paid: number
  amount_due: number
  visit_number: number
  follow_up_date?: number | null
  dirty: boolean
}

// ─── Database ─────────────────────────────────────────────────────────────────

class ClinicDB extends Dexie {
  patients!: EntityTable<Patient, 'id'>
  visits!: EntityTable<Visit, 'id'>

  constructor() {
    super('ClinicMemoryOS')

    this.version(1).stores({
      patients: '++id, name, created_at',
      visits: '++id, patient_id, date, visit_number',
    })

    // v2: stable cross-device ids, edit timestamps, tombstones, outbox flag.
    // Legacy rows get a deterministic uid derived from their old numeric id —
    // the v1 sync already forced every device to agree on those ids, so the
    // same record on two devices maps to the same uid.
    this.version(2)
      .stores({
        patients: '++id, name, created_at, &uid, dirty',
        visits: '++id, patient_id, date, visit_number, &uid, dirty',
      })
      .upgrade(async (tx) => {
        markRemote(tx)
        await tx.table('patients').toCollection().modify((p: Patient) => {
          p.uid ??= `legacy-p-${p.id}`
          p.updated_at ??= p.created_at || Date.now()
          p.deleted_at ??= null
          p.dirty = 1
        })
        await tx.table('visits').toCollection().modify((v: Visit) => {
          v.uid ??= `legacy-v-${v.id}`
          v.updated_at ??= v.date || Date.now()
          v.deleted_at ??= null
          v.dirty = 1
        })
      })

    // v3: patient phone and visit follow-up date become searchable. Both fields
    // are optional, so Dexie just adds the indexes — no data is rewritten and
    // the sync metadata on existing rows is left alone.
    this.version(3).stores({
      patients: '++id, name, created_at, &uid, dirty, phone',
      visits: '++id, patient_id, date, visit_number, &uid, dirty, follow_up_date',
    })

    installSyncHooks(this.patients)
    installSyncHooks(this.visits)
  }
}

// ─── Sync stamping hooks ─────────────────────────────────────────────────────
// Every local write is stamped with uid / updated_at / dirty automatically, so
// call sites don't need to know about sync. Writes that come *from* sync or a
// backup restore run inside a transaction marked with markRemote() and keep
// the metadata they carry.

const REMOTE = Symbol('remote')

export function markRemote(tx: Transaction) {
  ;(tx as unknown as Record<symbol, boolean>)[REMOTE] = true
}

function isRemote(tx: Transaction | undefined): boolean {
  return !!tx && !!(tx as unknown as Record<symbol, boolean>)[REMOTE]
}

export function newUid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

function installSyncHooks(table: EntityTable<Patient, 'id'> | EntityTable<Visit, 'id'>) {
  table.hook('creating', (_key, obj: SyncMeta, tx) => {
    obj.uid ??= newUid()
    obj.deleted_at ??= null
    if (isRemote(tx)) {
      obj.updated_at ??= Date.now()
      obj.dirty ??= 0
      return
    }
    obj.updated_at = Date.now()
    obj.dirty = 1
  })

  table.hook('updating', (mods: Partial<SyncMeta>, _key, obj: SyncMeta, tx) => {
    // A put() that replaces the row without sync fields must not drop them
    const keep: Partial<SyncMeta> = {}
    if ('uid' in mods && !mods.uid) keep.uid = obj.uid
    if ('deleted_at' in mods && mods.deleted_at === undefined) keep.deleted_at = obj.deleted_at ?? null
    if (isRemote(tx)) return keep
    return { ...keep, updated_at: Date.now(), dirty: 1 }
  })
}

export const db = new ClinicDB()

export const isLive = <T extends SyncMeta>(row: T | undefined | null): row is T =>
  !!row && !row.deleted_at

// ─── Helpers ─────────────────────────────────────────────────────────────────

export async function getRecentVisitsWithPatients(limit = 200): Promise<
  Array<{ visit: Visit; patient: Patient }>
> {
  const visits = await db.visits.orderBy('date').reverse().limit(limit).toArray()
  const patientIds = [...new Set(visits.map((v) => v.patient_id))]
  const patients = await db.patients.bulkGet(patientIds)
  const patientMap = new Map<number, Patient>()
  patients.forEach((p) => {
    if (p) patientMap.set(p.id!, p)
  })
  return visits
    .map((visit) => {
      const patient = patientMap.get(visit.patient_id)
      if (!patient) return null
      return { visit, patient }
    })
    .filter((x): x is { visit: Visit; patient: Patient } => x !== null)
}

export async function getVisitsByPatient(patientId: number): Promise<Visit[]> {
  return db.visits
    .where('patient_id')
    .equals(patientId)
    .filter(isLive)
    .sortBy('date')
    .then((arr) => arr.reverse())
}

export async function getLivePatients(): Promise<Patient[]> {
  return (await db.patients.toArray()).filter(isLive)
}

export async function getLiveVisits(): Promise<Visit[]> {
  return (await db.visits.toArray()).filter(isLive)
}

export async function getNextVisitNumber(patientId: number): Promise<number> {
  const visits = await db.visits.where('patient_id').equals(patientId).filter(isLive).count()
  return visits + 1
}

// Soft delete: tombstones sync to other devices so the patient doesn't come back
export async function deletePatient(patientId: number): Promise<void> {
  const now = Date.now()
  await db.transaction('rw', db.patients, db.visits, async () => {
    await db.visits.where('patient_id').equals(patientId).modify({ deleted_at: now })
    await db.patients.update(patientId, { deleted_at: now })
  })
}

export async function upsertVisit(visit: Omit<Visit, 'id'> & { id?: number }): Promise<number> {
  if (visit.id) {
    // update() merges, so sync metadata on the stored row is preserved
    const { id, ...fields } = visit
    await db.visits.update(id, fields)
    return id
  } else {
    const id = await db.visits.add(visit as Visit)
    return id as number
  }
}
