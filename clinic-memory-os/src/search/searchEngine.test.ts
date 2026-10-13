import { describe, expect, it } from 'vitest'
import { addToIndex, buildIndex, removePatientFromIndex, search, updatePatientInIndex } from './searchEngine'
import type { Patient, Visit } from '../db/db'

const patients: Patient[] = [
  { id: 1, name: 'Rahul Khan', quick_note: '', created_at: 0 },
  { id: 2, name: 'Sita Devi', quick_note: '', created_at: 0, deleted_at: 5 },
  { id: 3, name: 'Imran Ali', quick_note: '', created_at: 0 },
]
const v = (id: number, patient_id: number, date: number, med: string, extra: Partial<Visit> = {}): Visit => ({
  id, patient_id, date, symptoms_text: 'migraine left side', medicines_json: [{ name: med, potency: '30' }],
  fee_total: 0, amount_paid: 0, amount_due: 0, visit_number: 1, ...extra,
})

describe('searchEngine', () => {
  it('skips deleted patients and visits', () => {
    buildIndex([v(1, 1, 100, 'Belladonna'), v(2, 2, 200, 'Bryonia Alba'), v(3, 3, 300, 'Sepia', { deleted_at: 9 })], patients)
    expect(search('').map((r) => r.patientName)).toEqual(['Rahul Khan'])
    expect(search('sita')).toEqual([])
  })

  it('updates incrementally without duplicating records', () => {
    buildIndex([v(1, 1, 100, 'Belladonna')], patients)
    addToIndex(v(10, 3, 500, 'Nux Vomica'), 'Imran Ali')
    addToIndex(v(10, 3, 600, 'Nux Vomica', { symptoms_text: 'acidity' }), 'Imran Ali') // autosave again
    expect(search('').map((r) => r.patientName)).toEqual(['Imran Ali', 'Rahul Khan'])
    expect(search('nux').filter((r) => r.visitId === 10)).toHaveLength(1)
    expect(search('acidity').map((r) => r.visitId)).toContain(10)

    removePatientFromIndex(3)
    expect(search('nux')).toEqual([])
    expect(search('').map((r) => r.patientName)).toEqual(['Rahul Khan'])
  })

  it('finds patients by part of their phone number and carries identity into results', () => {
    const withIdentity: Patient[] = [
      { id: 1, name: 'Rahul Khan', quick_note: '', created_at: 0, phone: '+91 98765 43210', birth_year: 1990 },
      { id: 3, name: 'Rahul Sharma', quick_note: '', created_at: 0, phone: '99111-22333' },
    ]
    buildIndex([v(1, 1, 100, 'Belladonna'), v(2, 1, 150, 'Sepia'), v(3, 3, 300, 'Sulphur')], withIdentity)
    const hit = search('543')
    expect(hit.map((r) => r.patientId)).toEqual([1]) // one row per patient, newest visit
    expect(hit[0]).toMatchObject({ visitId: 2, patientPhone: '+91 98765 43210', patientBirthYear: 1990 })
    expect(search('9111 22').map((r) => r.patientId)).toEqual([3])
    expect(search('12')).toEqual([]) // too short to count as a number search
    expect(search('').find((r) => r.patientId === 3)?.patientBirthYear).toBeUndefined()
  })

  it('keeps identity on incremental adds and applies later edits', () => {
    buildIndex([v(1, 1, 100, 'Belladonna')], [{ id: 1, name: 'Rahul Khan', quick_note: '', created_at: 0, phone: '98765 43210' }])
    addToIndex(v(5, 1, 400, 'Sepia'), 'Rahul Khan') // no identity passed: inherited
    expect(search('98765').map((r) => r.visitId)).toEqual([5])
    updatePatientInIndex({ id: 1, name: 'Rahul K', quick_note: '', created_at: 0, phone: '70000 11111', birth_year: 1985 })
    expect(search('98765')).toEqual([])
    expect(search('70000')[0]).toMatchObject({ patientName: 'Rahul K', patientBirthYear: 1985 })
    addToIndex(v(6, 4, 500, 'Nux Vomica'), 'New Person', { phone: '88888 77777' })
    expect(search('77777').map((r) => r.patientName)).toEqual(['New Person'])
  })
})
