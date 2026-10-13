import { beforeEach, describe, expect, it } from 'vitest'
import { db, deletePatient, getVisitsByPatient, markRemote, upsertVisit } from './db'

const visit = (patient_id: number, extra = {}) => ({
  patient_id,
  date: 1000,
  symptoms_text: 'cough',
  medicines_json: [{ name: 'Bryonia Alba', potency: '30' }],
  fee_total: 300,
  amount_paid: 300,
  amount_due: 0,
  visit_number: 1,
  ...extra,
})

beforeEach(async () => {
  await db.patients.clear()
  await db.visits.clear()
})

describe('sync stamping hooks', () => {
  it('stamps uid, updated_at, dirty and deleted_at on local creates', async () => {
    const before = Date.now()
    const id = await db.patients.add({ name: 'Rahul', quick_note: '', created_at: 1 }) as number
    const p = (await db.patients.get(id))!
    expect(p.uid).toMatch(/.{8,}/)
    expect(p.updated_at).toBeGreaterThanOrEqual(before)
    expect(p.dirty).toBe(1)
    expect(p.deleted_at).toBeNull()
  })

  it('bumps updated_at and re-dirties on local updates', async () => {
    const id = await db.patients.add({ name: 'Rahul', quick_note: '', created_at: 1 }) as number
    await db.patients.update(id, { dirty: 0, updated_at: 5 }) // local write: hook overrides
    const p = (await db.patients.get(id))!
    expect(p.dirty).toBe(1)
    expect(p.updated_at).toBeGreaterThan(5)
  })

  it('keeps metadata as given inside a remote transaction', async () => {
    const id = await db.transaction('rw', db.patients, async (tx) => {
      markRemote(tx)
      return db.patients.add({ name: 'Remote', quick_note: '', created_at: 1, uid: 'r-1', updated_at: 42, dirty: 0 })
    })
    const p = (await db.patients.get(id))!
    expect(p).toMatchObject({ uid: 'r-1', updated_at: 42, dirty: 0 })
  })

  it('preserves uid when autosave updates an existing visit', async () => {
    const pid = await db.patients.add({ name: 'Rahul', quick_note: '', created_at: 1 }) as number
    const vid = await upsertVisit(visit(pid))
    const uid = (await db.visits.get(vid))!.uid
    await upsertVisit({ id: vid, ...visit(pid, { amount_paid: 100, amount_due: 200 }) })
    const v = (await db.visits.get(vid))!
    expect(v.uid).toBe(uid)
    expect(v.amount_due).toBe(200)
  })

  it('preserves uid even when a full put() omits it', async () => {
    const pid = await db.patients.add({ name: 'Rahul', quick_note: '', created_at: 1 }) as number
    const vid = await db.visits.add(visit(pid)) as number
    const uid = (await db.visits.get(vid))!.uid
    await db.visits.put({ id: vid, ...visit(pid, { symptoms_text: 'fever' }) })
    expect((await db.visits.get(vid))!.uid).toBe(uid)
  })
})

describe('deletePatient', () => {
  it('soft-deletes the patient and their visits so the deletion can sync', async () => {
    const pid = await db.patients.add({ name: 'Rahul', quick_note: '', created_at: 1 }) as number
    await db.visits.add(visit(pid))
    await deletePatient(pid)

    const p = (await db.patients.get(pid))!
    expect(p.deleted_at).toBeGreaterThan(0)
    expect(p.dirty).toBe(1)
    const raw = await db.visits.where('patient_id').equals(pid).toArray()
    expect(raw).toHaveLength(1)
    expect(raw[0].deleted_at).toBeGreaterThan(0)
    expect(await getVisitsByPatient(pid)).toEqual([])
  })
})
