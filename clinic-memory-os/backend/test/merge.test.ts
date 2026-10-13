import { describe, expect, it } from 'vitest'
import { cursorFilter, pickWinners, sanitizePatient, sanitizeVisit } from '../src/sync/merge'

describe('sanitizePatient', () => {
  it('rejects records without uid or updated_at', () => {
    expect(sanitizePatient({ name: 'A', updated_at: 1 })).toBeNull()
    expect(sanitizePatient({ uid: 'u1', name: 'A' })).toBeNull()
    expect(sanitizePatient(null)).toBeNull()
  })

  it('trims and caps fields and normalises deleted_at', () => {
    const p = sanitizePatient({ uid: 'u1', name: '  Rahul  ', quick_note: 'x'.repeat(600), updated_at: 5 })!
    expect(p.name).toBe('Rahul')
    expect(p.quick_note).toHaveLength(500)
    expect(p.created_at).toBe(5)
    expect(p.deleted_at).toBeNull()
  })
})

describe('sanitizePatient identity fields', () => {
  const base = { uid: 'u1', name: 'A', updated_at: 5 }

  it('defaults missing fields to null so old clients still sync', () => {
    expect(sanitizePatient(base)).toMatchObject({ phone: null, sex: null, birth_year: null })
  })

  it('accepts a valid phone, sex and birth year', () => {
    const p = sanitizePatient({ ...base, phone: ' +91 98765-43210 ', sex: 'F', birth_year: 1990 })!
    expect(p).toMatchObject({ phone: '+91 98765-43210', sex: 'F', birth_year: 1990 })
  })

  it('rejects phones with letters or more than 20 characters', () => {
    expect(sanitizePatient({ ...base, phone: '98765 abc' })!.phone).toBeNull()
    expect(sanitizePatient({ ...base, phone: '<b>1</b>' })!.phone).toBeNull()
    expect(sanitizePatient({ ...base, phone: '1'.repeat(21) })!.phone).toBeNull()
    expect(sanitizePatient({ ...base, phone: '1'.repeat(20) })!.phone).toHaveLength(20)
    expect(sanitizePatient({ ...base, phone: '   ' })!.phone).toBeNull()
    expect(sanitizePatient({ ...base, phone: 9876543210 })!.phone).toBeNull()
  })

  it('only allows M, F or O for sex', () => {
    for (const sex of ['M', 'F', 'O']) expect(sanitizePatient({ ...base, sex })!.sex).toBe(sex)
    for (const sex of ['m', 'X', '', 1, null]) expect(sanitizePatient({ ...base, sex })!.sex).toBeNull()
  })

  it('keeps birth_year only as an integer from 1900 to the current year', () => {
    const year = new Date().getFullYear()
    expect(sanitizePatient({ ...base, birth_year: 1900 })!.birth_year).toBe(1900)
    expect(sanitizePatient({ ...base, birth_year: year })!.birth_year).toBe(year)
    for (const birth_year of [1899, year + 1, 1990.5, '1990', NaN, null]) {
      expect(sanitizePatient({ ...base, birth_year })!.birth_year).toBeNull()
    }
  })
})

describe('sanitizeVisit follow_up_date', () => {
  const base = { uid: 'v1', patient_uid: 'p1', updated_at: 5 }

  it('keeps a positive number and nulls everything else', () => {
    expect(sanitizeVisit({ ...base, follow_up_date: 1_700_000_000_000 })!.follow_up_date).toBe(1_700_000_000_000)
    expect(sanitizeVisit(base)!.follow_up_date).toBeNull()
    for (const follow_up_date of [0, -5, '123', NaN, Infinity, null]) {
      expect(sanitizeVisit({ ...base, follow_up_date })!.follow_up_date).toBeNull()
    }
  })
})

describe('sanitizeVisit', () => {
  it('requires a patient_uid and recomputes amount_due', () => {
    expect(sanitizeVisit({ uid: 'v1', updated_at: 1 })).toBeNull()
    const v = sanitizeVisit({ uid: 'v1', patient_uid: 'p1', updated_at: 9, fee_total: 300, amount_paid: 100, amount_due: 0, medicines_json: 'bad' })!
    expect(v.amount_due).toBe(200)
    expect(v.medicines_json).toEqual([])
    expect(v.visit_number).toBe(1)
    expect(v.date).toBe(9)
  })
})

describe('pickWinners (last-write-wins)', () => {
  const rec = (uid: string, updated_at: number) => ({ uid, updated_at })

  it('writes new records and strictly newer ones only', () => {
    const stored = new Map([['a', 10], ['b', 10], ['c', 10]])
    const { winners, stale } = pickWinners([rec('a', 11), rec('b', 10), rec('c', 9), rec('d', 1)], stored)
    expect(winners.map((w) => w.uid).sort()).toEqual(['a', 'd'])
    expect(stale).toBe(2)
  })

  it('collapses duplicates in a batch to the newest copy', () => {
    const { winners, stale } = pickWinners([rec('a', 1), rec('a', 3), rec('a', 2)], new Map())
    expect(winners).toEqual([rec('a', 3)])
    expect(stale).toBe(2)
  })
})

describe('cursorFilter', () => {
  it('returns an empty filter without a cursor', () => {
    expect(cursorFilter(null)).toEqual({})
    expect(cursorFilter({ t: 'x', uid: 1 } as any)).toEqual({})
  })

  it('orders by synced_at then uid', () => {
    expect(cursorFilter({ t: 100, uid: 'm' })).toEqual({
      $or: [{ synced_at: { $gt: 100 } }, { synced_at: 100, uid: { $gt: 'm' } }],
    })
  })
})
