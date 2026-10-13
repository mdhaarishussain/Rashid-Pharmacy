import { describe, expect, it } from 'vitest'
import { appReducer, INITIAL_STATE, type AppState } from './useAppState'
import type { Patient, Visit } from '../db/db'

const patient: Patient = { id: 1, name: 'Rahul', quick_note: '', created_at: 0 }
const lastVisit: Visit = {
  id: 7, patient_id: 1, date: 100, symptoms_text: 'cough', fee_total: 300, amount_paid: 300, amount_due: 0, visit_number: 2,
  medicines_json: [
    { name: 'Bryonia Alba', potency: '30', freq: 'BD', food: 'AC', days: 5 },
    { name: 'Arnica Montana', potency: '200' },
  ],
}

function loaded(): AppState {
  return appReducer(INITIAL_STATE, { type: 'LOAD_PATIENT', patient, visits: [lastVisit] })
}

describe('appReducer', () => {
  it('Repeat & Modify pre-fills last medicines and increments the visit number', () => {
    const s = appReducer(loaded(), { type: 'REPEAT_AND_MODIFY' })
    expect(s.draft).toMatchObject({ patient_id: 1, visit_number: 2, visit_id: undefined, dirty: true })
    expect(s.slots.map((x) => x.medicine?.name ?? null)).toEqual(['Bryonia Alba', 'Arnica Montana', null])
    expect(s.draft!.medicines_json).toEqual(lastVisit.medicines_json)
  })

  it('keeps dosage when only the potency changes', () => {
    let s = appReducer(loaded(), { type: 'REPEAT_AND_MODIFY' })
    s = appReducer(s, { type: 'SET_SLOT_MEDICINE', slotIndex: 0, medicine: { name: 'Bryonia Alba', potency: '200' } })
    expect(s.slots[0].medicine).toMatchObject({ potency: '200', freq: 'BD', food: 'AC', days: 5 })
  })

  it('computes the amount due from fee and paid', () => {
    let s = appReducer(loaded(), { type: 'INIT_DRAFT', visitNumber: 3 })
    s = appReducer(s, { type: 'UPDATE_PAYMENT', field: 'fee_total', value: 500 })
    s = appReducer(s, { type: 'UPDATE_PAYMENT', field: 'amount_paid', value: 200 })
    expect(s.draft).toMatchObject({ fee_total: 500, amount_paid: 200, amount_due: 300 })
  })

  it('caps slots at 8 and never removes the last one', () => {
    let s = loaded()
    for (let i = 0; i < 10; i++) s = appReducer(s, { type: 'ADD_SLOT' })
    expect(s.slots).toHaveLength(8)
    for (let i = 0; i < 10; i++) s = appReducer(s, { type: 'REMOVE_SLOT', slotIndex: 0 })
    expect(s.slots).toHaveLength(1)
  })
})
