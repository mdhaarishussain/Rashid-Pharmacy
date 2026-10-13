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
