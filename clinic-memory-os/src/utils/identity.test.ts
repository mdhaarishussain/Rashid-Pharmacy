import { describe, expect, it } from 'vitest'
import {
  ageFromBirthYear, birthYearFromAge, cleanPhone, cleanPhoneInput, identityDetail, identityLabel, parseAge, phoneTail,
} from './identity'

const NOW = new Date(2026, 5, 15).getTime()

describe('identity helpers', () => {
  it('converts between age and birth year', () => {
    expect(birthYearFromAge(34, NOW)).toBe(1992)
    expect(ageFromBirthYear(1992, NOW)).toBe(34)
    expect(ageFromBirthYear(undefined, NOW)).toBeNull()
  })

  it('parses ages strictly', () => {
    expect(parseAge('34')).toBe(34)
    expect(parseAge('')).toBeNull()
    expect(parseAge('3.5')).toBeNull()
    expect(parseAge('150')).toBeNull()
    expect(parseAge('-2')).toBeNull()
  })

  it('cleans phone input but keeps spaces while typing', () => {
    expect(cleanPhoneInput('98765 ab')).toBe('98765 ')
    expect(cleanPhone(' +91 98765-43210 x ')).toBe('+91 98765-43210')
    expect(cleanPhone('1'.repeat(30))).toHaveLength(20)
    expect(phoneTail('+91 98765 43210')).toBe('3210')
  })

  it('builds the list label and card detail', () => {
    expect(identityLabel({ phone: '98765 43210', birth_year: 1992 }, NOW)).toBe('34y · …3210')
    expect(identityLabel({ birth_year: 1992 }, NOW)).toBe('34y')
    expect(identityLabel({}, NOW)).toBe('')
    expect(identityDetail({ phone: '98765 43210', birth_year: 1992, sex: 'F' }, NOW)).toBe('34y · Female · 98765 43210')
  })
})
