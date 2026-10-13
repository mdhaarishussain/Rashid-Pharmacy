import { db } from '../db/db'
import { applyRemote, type ApplyResult } from '../sync/applyRemote'
import { patientToWire, visitToWire, type WirePatient, type WireVisit } from '../sync/protocol'

const BACKUP_FORMAT = 'clinic-memory-os-backup'
const LAST_BACKUP_STORAGE = 'clinic_last_backup'

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: 2
  exported_at: number
  patients: WirePatient[]
  visits: WireVisit[]
}

export function getLastBackup(): number | null {
  try {
    const raw = localStorage.getItem(LAST_BACKUP_STORAGE)
    return raw ? Number(raw) : null
  } catch {
    return null
  }
}

/** Full snapshot, tombstones included, so a restore merges correctly. */
export async function buildBackup(): Promise<BackupFile> {
  const [patients, visits] = await Promise.all([db.patients.toArray(), db.visits.toArray()])
  const uidById = new Map(patients.map((p) => [p.id!, p.uid!]))
  return {
    format: BACKUP_FORMAT,
    version: 2,
    exported_at: Date.now(),
    patients: patients.map(patientToWire),
    visits: visits.filter((v) => uidById.has(v.patient_id)).map((v) => visitToWire(v, uidById.get(v.patient_id)!)),
  }
}

function csvCell(value: string | number): string {
  const s = String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function formatMedicine(m: WireVisit['medicines_json'][number]): string {
  return [m.name, m.potency, m.freq, m.food, m.days ? `${m.days}d` : '', m.qty ? `x${m.qty}` : '']
    .filter(Boolean)
    .join(' ')
}

/** One row per live visit — readable in Excel / Google Sheets like the paper register. */
export function backupToCsv(backup: BackupFile): string {
  const patients = new Map<string, WirePatient>(backup.patients.map((p) => [p.uid, p]))
  const rows = backup.visits
    .filter((v) => {
      const p = patients.get(v.patient_uid)
      return !v.deleted_at && !!p && !p.deleted_at
    })
    .sort((a, b) => a.date - b.date)
    .map((v) => [
      new Date(v.date).toISOString().slice(0, 10),
      patients.get(v.patient_uid)!.name,
      v.visit_number,
      v.medicines_json.map(formatMedicine).join('; '),
      v.symptoms_text,
      v.fee_total,
      v.amount_paid,
      v.amount_due,
    ])
  const header = ['Date', 'Patient', 'Visit #', 'Medicines', 'Symptoms / Notes', 'Fee', 'Paid', 'Due']
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')
}

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Download a JSON backup (restorable) and a CSV copy (human-readable). */
export async function exportBackup(): Promise<void> {
  const backup = await buildBackup()
  const stamp = new Date(backup.exported_at).toISOString().slice(0, 10)
  download(`clinic-backup-${stamp}.json`, JSON.stringify(backup), 'application/json')
  download(`clinic-register-${stamp}.csv`, '﻿' + backupToCsv(backup), 'text/csv;charset=utf-8')
  localStorage.setItem(LAST_BACKUP_STORAGE, String(backup.exported_at))
}

export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('This file is not a valid backup (could not read JSON).')
  }
  const b = data as Partial<BackupFile>
  if (b?.format !== BACKUP_FORMAT || !Array.isArray(b.patients) || !Array.isArray(b.visits)) {
    throw new Error('This file is not a Clinic Memory OS backup.')
  }
  const validPatient = (p: WirePatient) => typeof p?.uid === 'string' && typeof p.name === 'string' && typeof p.updated_at === 'number'
  const validVisit = (v: WireVisit) =>
    typeof v?.uid === 'string' && typeof v.patient_uid === 'string' && typeof v.updated_at === 'number' && Array.isArray(v.medicines_json)
  if (!b.patients.every(validPatient) || !b.visits.every(validVisit)) {
    throw new Error('The backup file is damaged — some records are incomplete.')
  }
  return b as BackupFile
}

/**
 * Merge a backup into this device. Newer local edits are kept; restored rows
 * are queued for upload so the cloud copy is repaired too.
 */
export async function restoreBackup(file: File): Promise<ApplyResult> {
  const backup = parseBackup(await file.text())
  return applyRemote(backup.patients, backup.visits, { markDirty: true })
}
