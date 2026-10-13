import type { Patient, Sex } from '../db/db'

// Pure helpers for the patient-identity fields (phone / sex / age).

export const SEX_OPTIONS: Array<{ value: Sex; label: string }> = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
  { value: 'O', label: 'Other' },
]

const PHONE_CHARS = /[^0-9+\s-]/g

/** For typing: strip anything that is not a digit, +, space or dash, and cap at 20 chars. */
export function cleanPhoneInput(raw: string): string {
  return raw.replace(PHONE_CHARS, '').slice(0, 20)
}

/** For saving: as above, trimmed. */
export function cleanPhone(raw: string): string {
  return cleanPhoneInput(raw).trim()
}

export function phoneDigits(phone: string | undefined | null): string {
  return (phone ?? '').replace(/\D/g, '')
}

/** Last four digits (fewer if the number is shorter). */
export function phoneTail(phone: string | undefined | null): string {
  return phoneDigits(phone).slice(-4)
}

export function birthYearFromAge(age: number, now = Date.now()): number {
  return new Date(now).getFullYear() - Math.round(age)
}

export function ageFromBirthYear(birthYear: number | undefined | null, now = Date.now()): number | null {
  if (typeof birthYear !== 'number') return null
  return Math.max(0, new Date(now).getFullYear() - birthYear)
}

/** Parse an age typed by the doctor; null when empty or implausible. */
export function parseAge(raw: string): number | null {
  const t = raw.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isInteger(n) && n >= 0 && n <= 120 ? n : null
}

/** Short disambiguator for list rows, e.g. "34y · …4521". Empty when nothing is known. */
export function identityLabel(p: Pick<Patient, 'phone' | 'birth_year'>, now = Date.now()): string {
  const age = ageFromBirthYear(p.birth_year, now)
  const tail = phoneTail(p.phone)
  return [age !== null ? `${age}y` : '', tail ? `…${tail}` : ''].filter(Boolean).join(' · ')
}

/** Fuller line for the patient card, e.g. "34y · Male · 98765 43210". */
export function identityDetail(p: Pick<Patient, 'phone' | 'birth_year' | 'sex'>, now = Date.now()): string {
  const age = ageFromBirthYear(p.birth_year, now)
  const sex = SEX_OPTIONS.find((s) => s.value === p.sex)?.label
  return [age !== null ? `${age}y` : '', sex ?? '', p.phone ?? ''].filter(Boolean).join(' · ')
}
