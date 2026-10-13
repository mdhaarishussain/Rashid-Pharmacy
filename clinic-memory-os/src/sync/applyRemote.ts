import { db, markRemote, type Patient, type Visit } from '../db/db'
import { planPatientWrites, planVisitWrites, type WirePatient, type WireVisit } from './protocol'

export interface ApplyResult {
  patientsWritten: number
  visitsWritten: number
  orphanedVisits: number
}

/**
 * Merge records from the cloud or a backup file into IndexedDB using
 * last-write-wins on `updated_at`. Patients are applied first so visits can
 * be linked to their local patient id. `markDirty` re-queues the rows for
 * upload (used when restoring a backup).
 */
export async function applyRemote(
  patients: WirePatient[],
  visits: WireVisit[],
  { markDirty = false } = {}
): Promise<ApplyResult> {
  return db.transaction('rw', db.patients, db.visits, async (tx) => {
    markRemote(tx)

    const localPatients = await db.patients.where('uid').anyOf(patients.map((p) => p.uid)).toArray()
    const patientPlan = planPatientWrites(
      patients,
      new Map(localPatients.map((p): [string, Patient] => [p.uid!, p])),
      markDirty
    )
    if (patientPlan.writes.length) await db.patients.bulkPut(patientPlan.writes)

    const linked = await db.patients.where('uid').anyOf([...new Set(visits.map((v) => v.patient_uid))]).toArray()
    const localVisits = await db.visits.where('uid').anyOf(visits.map((v) => v.uid)).toArray()
    const visitPlan = planVisitWrites(
      visits,
      new Map(localVisits.map((v): [string, Visit] => [v.uid!, v])),
      new Map(linked.map((p): [string, number] => [p.uid!, p.id!])),
      markDirty
    )
    if (visitPlan.writes.length) await db.visits.bulkPut(visitPlan.writes)

    return {
      patientsWritten: patientPlan.writes.length,
      visitsWritten: visitPlan.writes.length,
      orphanedVisits: visitPlan.orphaned,
    }
  })
}
