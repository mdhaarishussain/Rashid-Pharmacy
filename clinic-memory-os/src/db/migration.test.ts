import Dexie from 'dexie'
import { expect, it } from 'vitest'

// Runs in its own file so the v1 database exists before db.ts opens it.
it('upgrades a v1 register in place with deterministic legacy uids', async () => {
  const v1 = new Dexie('ClinicMemoryOS')
  v1.version(1).stores({
    patients: '++id, name, created_at',
    visits: '++id, patient_id, date, visit_number',
  })
  const pid = (await v1.table('patients').add({ name: 'Old Patient', quick_note: '', created_at: 111 })) as number
  await v1.table('visits').add({
    patient_id: pid, date: 222, symptoms_text: '', medicines_json: [],
    fee_total: 0, amount_paid: 0, amount_due: 0, visit_number: 1,
  })
  v1.close()

  const { db } = await import('./db')
  const p = (await db.patients.get(pid))!
  const v = (await db.visits.toArray())[0]

  expect(p).toMatchObject({ uid: `legacy-p-${pid}`, updated_at: 111, deleted_at: null, dirty: 1, name: 'Old Patient' })
  expect(v).toMatchObject({ uid: `legacy-v-${v.id}`, updated_at: 222, deleted_at: null, dirty: 1, patient_id: pid })
})
