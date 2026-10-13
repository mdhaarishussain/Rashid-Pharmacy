import { db, getVisitsByPatient, isLive, type Patient } from './db'
import { computeDue, endOfLocalDay, latestVisit, type DueEntry } from '../utils/followUp'

export interface DueItem extends DueEntry {
  patient: Patient
}

/**
 * Patients whose follow-up is due today or overdue and who have not been seen
 * since. Uses the follow_up_date index so the cost depends on the handful of
 * pending follow-ups, not on the size of the register.
 */
export async function loadDue(now = Date.now()): Promise<DueItem[]> {
  const candidates = await db.visits
    .where('follow_up_date')
    .between(1, endOfLocalDay(now), true, true)
    .filter(isLive)
    .toArray()
  if (!candidates.length) return []

  const patientIds = [...new Set(candidates.map((v) => v.patient_id))]
  const [patients, histories] = await Promise.all([
    db.patients.bulkGet(patientIds),
    Promise.all(patientIds.map((id) => getVisitsByPatient(id))),
  ])
  const latest = new Map(patientIds.map((id, i) => [id, latestVisit(histories[i])]))
  const byId = new Map<number, Patient>()
  patients.forEach((p) => {
    if (isLive(p)) byId.set(p.id!, p)
  })

  return computeDue(candidates, latest, now)
    .filter((e) => byId.has(e.patientId))
    .map((e) => ({ ...e, patient: byId.get(e.patientId)! }))
}
