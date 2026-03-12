import Dexie, { type EntityTable } from 'dexie'

// ─── Domain types ────────────────────────────────────────────────────────────

export interface MedicineEntry {
  name: string
  potency: string
}

export interface Patient {
  id?: number
  name: string
  quick_note: string
  created_at: number // unix ms
}

export interface Visit {
  id?: number
  patient_id: number
  date: number // unix ms
  symptoms_text: string
  medicines_json: MedicineEntry[]
  fee_total: number
  amount_paid: number
  amount_due: number
  visit_number: number
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
  }
}

export const db = new ClinicDB()

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
    .sortBy('date')
    .then((arr) => arr.reverse())
}

export async function getNextVisitNumber(patientId: number): Promise<number> {
  const visits = await db.visits.where('patient_id').equals(patientId).count()
  return visits + 1
}

export async function deletePatient(patientId: number): Promise<void> {
  await db.visits.where('patient_id').equals(patientId).delete()
  await db.patients.delete(patientId)
}

export async function upsertVisit(visit: Omit<Visit, 'id'> & { id?: number }): Promise<number> {
  if (visit.id) {
    await db.visits.put(visit as Visit)
    return visit.id
  } else {
    const id = await db.visits.add(visit as Visit)
    return id as number
  }
}
