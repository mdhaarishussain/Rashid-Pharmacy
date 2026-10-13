import { beforeEach, describe, expect, it } from 'vitest'
import {
  CLINIC_SETTINGS_KEY,
  DEFAULT_CLINIC_SETTINGS,
  getClinicSettings,
  saveClinicSettings,
} from './clinicSettings'

describe('clinic settings', () => {
  beforeEach(() => localStorage.clear())

  it('returns the defaults when nothing is stored', () => {
    const s = getClinicSettings()
    expect(s.clinicName).toBe('Rashid Pharmacy')
    expect(s.doctorName).toBe('Dr. Saood Ahmad')
    expect(s.defaultLanguage).toBe('en')
    expect(s.paper).toBe('a5')
    expect(s).toEqual(DEFAULT_CLINIC_SETTINGS)
  })

  it('persists a partial update and keeps the other defaults', () => {
    saveClinicSettings({ phone: '9876543210', defaultLanguage: 'ur' })
    expect(getClinicSettings()).toEqual({ ...DEFAULT_CLINIC_SETTINGS, phone: '9876543210', defaultLanguage: 'ur' })
  })

  it('falls back to defaults for corrupt or invalid data', () => {
    localStorage.setItem(CLINIC_SETTINGS_KEY, '{not json')
    expect(getClinicSettings()).toEqual(DEFAULT_CLINIC_SETTINGS)
    localStorage.setItem(CLINIC_SETTINGS_KEY, JSON.stringify({ clinicName: 42, defaultLanguage: 'fr', paper: 'x' }))
    expect(getClinicSettings()).toEqual(DEFAULT_CLINIC_SETTINGS)
  })

  it('does not throw when storage is unavailable', () => {
    const real = globalThis.localStorage
    const broken = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } } as unknown as Storage
    globalThis.localStorage = broken
    try {
      expect(getClinicSettings()).toEqual(DEFAULT_CLINIC_SETTINGS)
      expect(saveClinicSettings({ address: 'x' }).address).toBe('x')
    } finally {
      globalThis.localStorage = real
    }
  })
})
