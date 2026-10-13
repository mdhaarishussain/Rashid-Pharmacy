import { describe, expect, it } from 'vitest'
import { addToIndex, buildIndex, removePatientFromIndex, search } from './searchEngine'
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
})
