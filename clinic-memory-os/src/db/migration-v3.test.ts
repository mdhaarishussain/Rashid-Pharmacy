import Dexie from 'dexie'
import { expect, it } from 'vitest'

// Own file so the v2 database exists before db.ts opens it (same pattern as migration.test.ts).
it('upgrades a v2 register to v3 keeping rows and sync metadata untouched, and indexes the new fields', async () => {
  const v2 = new Dexie('ClinicMemoryOS')
  v2.version(2).stores({
    patients: '++id, name, created_at, &uid, dirty',
    visits: '++id, patient_id, date, visit_number, &uid, dirty',
  })
  const pid = (await v2.table('patients').add({
    name: 'Synced Patient', quick_note: 'note', created_at: 111, uid: 'p-uid', updated_at: 5000, deleted_at: null, dirty: 0,
  })) as number
  await v2.table('visits').add({
    patient_id: pid, date: 222, symptoms_text: 'cough', medicines_json: [{ name: 'Bryonia Alba', potency: '30' }],
    fee_total: 300, amount_paid: 100, amount_due: 200, visit_number: 1,
    uid: 'v-uid', updated_at: 6000, deleted_at: null, dirty: 0,
  })
  v2.close()

  const { db } = await import('./db')
  await db.open()
  expect(db.verno).toBe(3)

  // Existing data and sync metadata are exactly as they were — no re-dirtying, no new fields
  const p = (await db.patients.get(pid))!
  const v = (await db.visits.toArray())[0]
  expect(p).toEqual({
    id: pid, name: 'Synced Patient', quick_note: 'note', created_at: 111, uid: 'p-uid', updated_at: 5000, deleted_at: null, dirty: 0,
  })
  expect(v).toMatchObject({ uid: 'v-uid', updated_at: 6000, deleted_at: null, dirty: 0, amount_due: 200, patient_id: pid })
  expect('phone' in p).toBe(false)
  expect('follow_up_date' in v).toBe(false)

  // v2 indexes are still there, and the new ones work
  expect(await db.patients.where('dirty').equals(0).count()).toBe(1)
  expect(await db.patients.where('uid').equals('p-uid').count()).toBe(1)
  await db.patients.update(pid, { phone: '98765 43210' })
  await db.visits.update(v.id!, { follow_up_date: 99_000 })
  expect((await db.patients.where('phone').equals('98765 43210').first())?.id).toBe(pid)
  expect(await db.visits.where('follow_up_date').between(1, 100_000).count()).toBe(1)
  // normal local edits still get stamped by the hooks
  const edited = (await db.patients.get(pid))!
  expect(edited.dirty).toBe(1)
  expect(edited.updated_at).toBeGreaterThan(5000)
})
