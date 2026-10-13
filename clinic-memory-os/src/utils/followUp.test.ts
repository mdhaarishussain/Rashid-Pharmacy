import { beforeEach, describe, expect, it } from 'vitest'
import { db, type Visit } from '../db/db'
import { loadDue } from '../db/due'
import {
  addDaysToFollowUp,
  addMonthsToFollowUp,
  computeDue,
  followUpFromInputValue,
  followUpToInputValue,
  latestVisit,
  summariseDue,
  toFollowUpDate,
} from './followUp'

const NOW = new Date(2026, 5, 15, 9, 30).getTime() // 15 Jun 2026, local
const day = (offset: number) => new Date(2026, 5, 15 + offset, 12).getTime()

let nextId = 1
const visit = (patient_id: number, date: number, follow_up_date: number | null, extra: Partial<Visit> = {}): Visit => ({
  id: nextId++, patient_id, date, symptoms_text: '', medicines_json: [], fee_total: 0, amount_paid: 0,
  amount_due: 0, visit_number: 1, follow_up_date, ...extra,
})

describe('date helpers', () => {
  it('normalises to local noon', () => {
    const d = new Date(toFollowUpDate(new Date(2026, 5, 15, 23, 59).getTime()))
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 5, 15, 12, 0])
  })

  it('adds days and calendar months, clamping to month end', () => {
    expect(addDaysToFollowUp(7, NOW)).toBe(day(7))
    expect(addDaysToFollowUp(15, NOW)).toBe(day(15))
    expect(addMonthsToFollowUp(1, NOW)).toBe(new Date(2026, 6, 15, 12).getTime())
    expect(addMonthsToFollowUp(1, new Date(2026, 0, 31, 8).getTime())).toBe(new Date(2026, 1, 28, 12).getTime())
  })

  it('round-trips the date input value', () => {
    expect(followUpToInputValue(day(3))).toBe('2026-06-18')
    expect(followUpFromInputValue('2026-06-18')).toBe(day(3))
    expect(followUpFromInputValue('')).toBeNull()
    expect(followUpToInputValue(null)).toBe('')
  })
})

describe('computeDue', () => {
  it('splits today vs overdue and sorts most overdue first', () => {
    const a = visit(1, day(-20), day(-5))
    const b = visit(2, day(-10), day(0))
    const c = visit(3, day(-30), day(-1))
    const latest = new Map([[1, a], [2, b], [3, c]])
    const due = computeDue([b, c, a], latest, NOW)
    expect(due.map((d) => [d.patientId, d.daysOverdue])).toEqual([[1, 5], [3, 1], [2, 0]])
    expect(summariseDue(due)).toEqual({ today: 1, overdue: 2 })
  })

  it('ignores future dates, missing dates and tombstones', () => {
    const future = visit(1, day(-3), day(1))
    const none = visit(2, day(-3), null)
    const gone = visit(3, day(-3), day(-2), { deleted_at: 5 })
    const latest = new Map([[1, future], [2, none], [3, gone]])
    expect(computeDue([future, none, gone], latest, NOW)).toEqual([])
  })

  it('drops a follow-up once the patient has a newer visit', () => {
    const old = visit(1, day(-14), day(-7))
    const newer = visit(1, day(-2), null)
    expect(computeDue([old], new Map([[1, latestVisit([old, newer])]]), NOW)).toEqual([])
    // ...but keeps it when the old visit is still the latest
    expect(computeDue([old], new Map([[1, latestVisit([old])]]), NOW)).toHaveLength(1)
  })

  it('latestVisit skips tombstones and breaks date ties by id', () => {
    const a = visit(1, 100, null)
    const b = visit(1, 100, null)
    const dead = visit(1, 900, null, { deleted_at: 1 })
    expect(latestVisit([a, b, dead])).toBe(b)
    expect(latestVisit([])).toBeUndefined()
  })
})

describe('loadDue (Dexie)', () => {
  beforeEach(async () => {
    await db.patients.clear()
    await db.visits.clear()
  })

  it('counts only live patients whose latest visit carries a due follow-up', async () => {
    const mk = async (name: string) => (await db.patients.add({ name, quick_note: '', created_at: 1 })) as number
    const base = { symptoms_text: '', medicines_json: [], fee_total: 0, amount_paid: 0, amount_due: 0, visit_number: 1 }
    const overdue = await mk('Overdue')
    const today = await mk('Today')
    const returned = await mk('Returned')
    const future = await mk('Future')
    const deleted = await mk('Deleted')

    await db.visits.add({ ...base, patient_id: overdue, date: day(-10), follow_up_date: day(-4) })
    await db.visits.add({ ...base, patient_id: today, date: day(-7), follow_up_date: day(0) })
    await db.visits.add({ ...base, patient_id: returned, date: day(-14), follow_up_date: day(-7) })
    await db.visits.add({ ...base, patient_id: returned, date: day(-1), follow_up_date: null }) // came back
    await db.visits.add({ ...base, patient_id: future, date: day(-1), follow_up_date: day(5) })
    await db.visits.add({ ...base, patient_id: deleted, date: day(-9), follow_up_date: day(-3) })
    await db.patients.update(deleted, { deleted_at: 7 })

    const due = await loadDue(NOW)
    expect(due.map((d) => [d.patient.name, d.daysOverdue])).toEqual([['Overdue', 4], ['Today', 0]])
  })
})
