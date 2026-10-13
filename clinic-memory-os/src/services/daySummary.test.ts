import { describe, expect, it } from 'vitest'
import type { Patient, Visit } from '../db/db'
import { addDays, dayToCsv, duesList, medicineUsage, startOfDay, summarizeDay } from './daySummary'

const at = (day: number, h = 10, m = 0) => new Date(2026, 5, day, h, m).getTime() // June 2026, local time
const DAY = startOfDay(at(10))

let nextId = 1
function patient(id: number, name: string, extra: Partial<Patient> = {}): Patient {
  return { id, name, quick_note: '', created_at: 0, deleted_at: null, ...extra }
}
function visit(patientId: number, date: number, extra: Partial<Visit> = {}): Visit {
  return {
    id: nextId++,
    patient_id: patientId,
    date,
    symptoms_text: '',
    medicines_json: [],
    fee_total: 0,
    amount_paid: 0,
    amount_due: 0,
    visit_number: 1,
    deleted_at: null,
    ...extra,
  }
}

const patients = [patient(1, 'Asha'), patient(2, 'Bilal'), patient(3, 'Chitra')]

describe('day boundaries', () => {
  it('includes 00:00 and 23:59 of the local day, excludes next midnight and the previous 23:59', () => {
    const visits = [
      visit(1, at(10, 0, 0)),
      visit(2, at(10, 23, 59)),
      visit(3, at(11, 0, 0)),
      visit(1, at(9, 23, 59), { visit_number: 0 }),
    ]
    const s = summarizeDay(visits, patients, DAY)
    expect(s.visitCount).toBe(2)
    expect(s.rows.map((r) => r.patientName)).toEqual(['Asha', 'Bilal'])
  })

  it('accepts any timestamp within the day as dayStart', () => {
    const s = summarizeDay([visit(1, at(10, 8))], patients, at(10, 17))
    expect(s.visitCount).toBe(1)
  })

  it('addDays moves by calendar days', () => {
    expect(addDays(DAY, 1)).toBe(startOfDay(at(11)))
    expect(addDays(DAY, -1)).toBe(startOfDay(at(9)))
  })
})

describe('summarizeDay', () => {
  it('returns zeros for an empty day', () => {
    const s = summarizeDay([visit(1, at(9))], patients, DAY)
    expect(s).toMatchObject({
      visitCount: 0, uniquePatients: 0, newPatients: 0, totalFees: 0, collected: 0, newCredit: 0,
      topMedicines: [], rows: [],
    })
    expect(summarizeDay([], [], DAY).visitCount).toBe(0)
  })

  it('totals fees, collected and new credit; unique patients counted once', () => {
    const visits = [
      visit(1, at(10, 9), { fee_total: 300, amount_paid: 300 }),
      visit(1, at(10, 15), { fee_total: 200, amount_paid: 50, amount_due: 150, visit_number: 2 }),
      visit(2, at(10, 11), { fee_total: 500, amount_paid: 0, amount_due: 500 }),
    ]
    const s = summarizeDay(visits, patients, DAY)
    expect(s.visitCount).toBe(3)
    expect(s.uniquePatients).toBe(2)
    expect(s.totalFees).toBe(1000)
    expect(s.collected).toBe(350)
    expect(s.newCredit).toBe(650)
  })

  it('ignores negative dues in new credit', () => {
    const s = summarizeDay([visit(1, at(10), { amount_due: -20, fee_total: 100, amount_paid: 120 })], patients, DAY)
    expect(s.newCredit).toBe(0)
    expect(s.collected).toBe(120)
  })

  it('excludes deleted visits and visits of deleted or unknown patients', () => {
    const visits = [
      visit(1, at(10, 9), { fee_total: 100 }),
      visit(1, at(10, 10), { fee_total: 999, deleted_at: 5 }),
      visit(2, at(10, 11), { fee_total: 999 }),
      visit(9, at(10, 12), { fee_total: 999 }),
    ]
    const withDeleted = [patients[0], patient(2, 'Bilal', { deleted_at: 7 })]
    const s = summarizeDay(visits, withDeleted, DAY)
    expect(s.visitCount).toBe(1)
    expect(s.totalFees).toBe(100)
  })

  it('detects new patients by their first-ever live visit', () => {
    const visits = [
      visit(1, at(3)), // Asha came before
      visit(1, at(10, 9)),
      visit(2, at(10, 10)), // Bilal's first visit is today
      visit(2, at(10, 16)), // second visit today, still one new patient
      visit(3, at(2), { deleted_at: 1 }), // deleted earlier visit does not count as history
      visit(3, at(10, 12)),
    ]
    const s = summarizeDay(visits, patients, DAY)
    expect(s.uniquePatients).toBe(3)
    expect(s.newPatients).toBe(2) // Bilal and Chitra
  })

  it('sorts register rows by time and builds the short medicine form', () => {
    const visits = [
      visit(2, at(10, 15, 30), { medicines_json: [{ name: 'Sulphur', potency: '30' }] }),
      visit(1, at(10, 9, 5), {
        visit_number: 4,
        medicines_json: [
          { name: 'Nux Vomica', potency: '200', freq: 'BD' },
          { name: 'Arnica Montana', potency: 'Ø', type: 'tincture' },
        ],
        fee_total: 250, amount_paid: 200, amount_due: 50,
      }),
    ]
    const s = summarizeDay(visits, patients, DAY)
    expect(s.rows.map((r) => r.patientName)).toEqual(['Asha', 'Bilal'])
    expect(s.rows[0]).toMatchObject({
      visitNumber: 4, medicines: 'Nux Vomica 200, Arnica Montana Ø', fee: 250, paid: 200, due: 50,
    })
    expect(s.rows[0].time).toBeLessThan(s.rows[1].time)
  })

  it('ranks top medicines by count, then name', () => {
    const med = (name: string) => ({ name, potency: '30' })
    const visits = [
      visit(1, at(10, 9), { medicines_json: [med('Sulphur'), med('Belladonna')] }),
      visit(2, at(10, 10), { medicines_json: [med('Sulphur')] }),
      visit(3, at(10, 11), { medicines_json: [med('Arsenicum')] }),
    ]
    expect(summarizeDay(visits, patients, DAY).topMedicines).toEqual([
      { name: 'Sulphur', count: 2 },
      { name: 'Arsenicum', count: 1 },
      { name: 'Belladonna', count: 1 },
    ])
  })
})

describe('duesList', () => {
  it('sums per patient, sorts by amount desc, and carries last visit date', () => {
    const visits = [
      visit(1, at(1), { amount_due: 100 }),
      visit(1, at(5), { amount_due: 50 }),
      visit(1, at(8), { amount_due: 0 }), // paid visit is still the last visit
      visit(2, at(3), { amount_due: 400 }),
      visit(3, at(4), { amount_due: 0 }),
    ]
    const dues = duesList(visits, patients)
    expect(dues.map((d) => [d.name, d.outstanding])).toEqual([['Bilal', 400], ['Asha', 150]])
    expect(dues[1].lastVisitDate).toBe(at(8))
    expect(dues[1].dueVisits).toBe(2)
  })

  it('skips deleted visits and deleted patients', () => {
    const visits = [
      visit(1, at(1), { amount_due: 100, deleted_at: 3 }),
      visit(2, at(2), { amount_due: 300 }),
      visit(3, at(2), { amount_due: 80 }),
    ]
    const ps = [patients[0], patient(2, 'Bilal', { deleted_at: 9 }), patients[2]]
    expect(duesList(visits, ps).map((d) => d.name)).toEqual(['Chitra'])
  })

  it('is empty when nobody owes anything', () => {
    expect(duesList([visit(1, at(1))], patients)).toEqual([])
    expect(duesList([], [])).toEqual([])
  })
})

describe('medicineUsage', () => {
  it('counts within the window only and skips deleted visits', () => {
    const med = (name: string) => ({ name, potency: '30' })
    const visits = [
      visit(1, at(10), { medicines_json: [med('Sulphur'), med('Nux Vomica')] }),
      visit(2, at(9), { medicines_json: [med('Sulphur')] }),
      visit(3, at(1), { medicines_json: [med('Sulphur')] }), // before window
      visit(1, at(10), { medicines_json: [med('Sulphur')], deleted_at: 1 }),
    ]
    expect(medicineUsage(visits, at(5))).toEqual([
      { name: 'Sulphur', count: 2 },
      { name: 'Nux Vomica', count: 1 },
    ])
    expect(medicineUsage([], 0)).toEqual([])
  })
})

describe('dayToCsv', () => {
  it('writes header, quoted cells and a totals line', () => {
    const visits = [
      visit(1, at(10, 9), {
        medicines_json: [{ name: 'Sulphur', potency: '30' }, { name: 'Nux Vomica', potency: '200' }],
        fee_total: 300, amount_paid: 300,
      }),
    ]
    const lines = dayToCsv(summarizeDay(visits, patients, DAY)).split('\r\n')
    expect(lines[0]).toBe('Time,Patient,Visit #,Medicines,Fee,Paid,Due')
    expect(lines[1]).toContain('"Sulphur 30, Nux Vomica 200"')
    expect(lines[2]).toBe(',TOTAL,,1 visits,300,300,0')
  })
})
