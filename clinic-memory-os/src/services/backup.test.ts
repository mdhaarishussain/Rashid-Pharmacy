import { beforeEach, describe, expect, it } from 'vitest'
import { db, deletePatient } from '../db/db'
import { backupToCsv, buildBackup, parseBackup } from './backup'
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
