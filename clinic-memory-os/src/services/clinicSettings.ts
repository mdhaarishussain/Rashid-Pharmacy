import type { SlipLang } from './prescription'

export type PaperSize = 'a5' | 'thermal'

export interface ClinicSettings {
  clinicName: string
  doctorName: string
  address: string
  phone: string
  defaultLanguage: SlipLang
  paper: PaperSize // last-used slip width
}

export const CLINIC_SETTINGS_KEY = 'clinic-memory-os:clinic-settings'

export const DEFAULT_CLINIC_SETTINGS: ClinicSettings = {
  clinicName: 'Rashid Pharmacy',
  doctorName: 'Dr. Saood Ahmad',
  address: '',
  phone: '',
  defaultLanguage: 'en',
  paper: 'a5',
}

const str = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback)

export function getClinicSettings(): ClinicSettings {
  const d = DEFAULT_CLINIC_SETTINGS
  try {
    const raw = localStorage.getItem(CLINIC_SETTINGS_KEY)
    if (!raw) return { ...d }
    const p = JSON.parse(raw) as Record<string, unknown>
    return {
      clinicName: str(p.clinicName, d.clinicName),
      doctorName: str(p.doctorName, d.doctorName),
      address: str(p.address, d.address),
      phone: str(p.phone, d.phone),
      defaultLanguage: p.defaultLanguage === 'hi' || p.defaultLanguage === 'ur' || p.defaultLanguage === 'en'
        ? p.defaultLanguage
        : d.defaultLanguage,
      paper: p.paper === 'thermal' ? 'thermal' : 'a5',
    }
  } catch {
    return { ...d }
  }
}

export function saveClinicSettings(patch: Partial<ClinicSettings>): ClinicSettings {
  const next = { ...getClinicSettings(), ...patch }
  try {
    localStorage.setItem(CLINIC_SETTINGS_KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable (private mode, quota) — settings simply won't persist.
  }
  return next
}
