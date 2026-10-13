import { beforeEach, describe, expect, it } from 'vitest'
import { db, deletePatient } from '../db/db'
import { backupToCsv, buildBackup, parseBackup } from './backup'
import { applyRemote } from '../sync/applyRemote'
import { needsBackupReminder } from '../components/DataSafety'

beforeEach(async () => {
  await db.patients.clear()
  await db.visits.clear()
})

describe('backup', () => {
  it('round-trips through JSON and produces a readable CSV without deleted patients', async () => {
    const keep = await db.patients.add({ name: 'Khan, "Rahul"', quick_note: '', created_at: 1 }) as number
    const gone = await db.patients.add({ name: 'Deleted', quick_note: '', created_at: 1 }) as number
    const base = { date: Date.UTC(2026, 2, 12), symptoms_text: 'cough\nnight', fee_total: 300, amount_paid: 100, amount_due: 200, visit_number: 1 }
    await db.visits.add({ ...base, patient_id: keep, medicines_json: [{ name: 'Bryonia Alba', potency: '30', freq: 'BD', days: 5 }] })
    await db.visits.add({ ...base, patient_id: gone, medicines_json: [] })
    await deletePatient(gone)

    const backup = await buildBackup()
    expect(backup.patients).toHaveLength(2) // tombstones are kept for correct restores
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup)

    const lines = backupToCsv(backup).split('\r\n')
    expect(lines[0]).toBe('Date,Patient,Visit #,Medicines,Symptoms / Notes,Fee,Paid,Due')
    expect(lines).toHaveLength(2) // header + one row; the newline in notes stays inside quotes
    expect(lines[1]).toBe('2026-03-12,"Khan, ""Rahul""",1,Bryonia Alba 30 BD 5d,"cough\nnight",300,100,200')
  })

  it('carries identity and follow-up fields, and still reads backups written before they existed', async () => {
    const pid = await db.patients.add({
      name: 'Asha', quick_note: '', created_at: 1, phone: '+91 98765-43210', sex: 'F', birth_year: 1988,
    }) as number
    await db.visits.add({
      patient_id: pid, date: Date.UTC(2026, 2, 12), symptoms_text: '', medicines_json: [], fee_total: 0, amount_paid: 0,
      amount_due: 0, visit_number: 1, follow_up_date: Date.UTC(2026, 2, 19, 12),
    })
    const backup = await buildBackup()
    const parsed = parseBackup(JSON.stringify(backup))
    expect(parsed.patients[0]).toMatchObject({ phone: '+91 98765-43210', sex: 'F', birth_year: 1988 })
    expect(parsed.visits[0].follow_up_date).toBe(Date.UTC(2026, 2, 19, 12))

    // Restore into an empty device keeps the fields
    await db.patients.clear()
    await db.visits.clear()
    await applyRemote(parsed.patients, parsed.visits, { markDirty: true })
    expect(await db.patients.where('phone').equals('+91 98765-43210').count()).toBe(1)
    expect(await db.visits.where('follow_up_date').above(0).count()).toBe(1)

    // An older backup has none of the new keys
    const old = {
      format: 'clinic-memory-os-backup', version: 2, exported_at: 1,
      patients: [{ uid: 'p', name: 'Old', quick_note: '', created_at: 1, updated_at: 1, deleted_at: null }],
      visits: [{
        uid: 'v', patient_uid: 'p', date: 1, symptoms_text: '', medicines_json: [], fee_total: 0, amount_paid: 0,
        amount_due: 0, visit_number: 1, updated_at: 1, deleted_at: null,
      }],
    }
    const oldParsed = parseBackup(JSON.stringify(old))
    await db.patients.clear()
    await db.visits.clear()
    await applyRemote(oldParsed.patients, oldParsed.visits)
    const restored = (await db.patients.toArray())[0]
    expect(restored.name).toBe('Old')
    expect(restored.phone).toBeUndefined()
    expect((await db.visits.toArray())[0].follow_up_date).toBeNull()
  })

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('nope')).toThrow(/not a valid backup/)
    expect(() => parseBackup('{"format":"x"}')).toThrow(/not a Clinic Memory OS backup/)
    expect(() => parseBackup(JSON.stringify({ format: 'clinic-memory-os-backup', patients: [{}], visits: [] }))).toThrow(/damaged/)
  })
})

describe('needsBackupReminder', () => {
  const day = 24 * 3600 * 1000
  it('reminds only when neither backup nor sync happened in 7 days', () => {
    const now = 100 * day
    expect(needsBackupReminder(null, null, now)).toBe(true)
    expect(needsBackupReminder(now - 8 * day, now - 9 * day, now)).toBe(true)
    expect(needsBackupReminder(now - 8 * day, now - day, now)).toBe(false)
    expect(needsBackupReminder(now - 2 * day, null, now)).toBe(false)
  })
})
