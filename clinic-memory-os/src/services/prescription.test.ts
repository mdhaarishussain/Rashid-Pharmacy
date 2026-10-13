import { describe, expect, it } from 'vitest'
import type { MedicineEntry } from '../db/db'
import {
  buildSlip,
  describeDosage,
  normalizeWhatsAppPhone,
  toWhatsAppText,
  whatsAppUrl,
  type SlipLang,
} from './prescription'

const clinic = { clinicName: 'Rashid Pharmacy', doctorName: 'Dr. Saood Ahmad', address: 'Main Road', phone: '9876543210' }
const date = new Date(2026, 9, 13, 10, 0).getTime() // 13 Oct 2026 local
const next = new Date(2026, 9, 20, 10, 0).getTime()

const pills: MedicineEntry = {
  name: 'Arnica Montana', potency: '30', type: 'remedy', freq: 'BD', food: 'AC', days: 5, qty: 2,
}
const tincture: MedicineEntry = {
  name: 'Crataegus', potency: 'Ø', type: 'tincture', freq: 'TD', food: 'PC', days: 10, qty: 10,
}

const slipFor = (lang: SlipLang, medicines: MedicineEntry[], nextVisit?: number | null) =>
  buildSlip({ clinic, patientName: ' Ramesh Kumar ', date, medicines, nextVisit, lang })

describe('describeDosage', () => {
  it('English', () => {
    expect(describeDosage(pills, 'en')).toBe('2 pills, twice a day, before food, for 5 days')
    expect(describeDosage(tincture, 'en')).toBe('10 drops, three times a day, after food, for 10 days')
  })

  it('Hindi', () => {
    expect(describeDosage(pills, 'hi')).toBe('2 गोलियाँ, दिन में दो बार, खाने से पहले, 5 दिन तक')
    expect(describeDosage(tincture, 'hi')).toBe('10 बूँदें, दिन में तीन बार, खाने के बाद, 10 दिन तक')
    expect(describeDosage({ ...pills, qty: 1 }, 'hi')).toContain('1 गोली,')
  })

  it('Urdu', () => {
    expect(describeDosage(pills, 'ur')).toBe('2 گولیاں، دن میں دو بار، کھانے سے پہلے، 5 دن تک')
    expect(describeDosage(tincture, 'ur')).toBe('10 قطرے، دن میں تین بار، کھانے کے بعد، 10 دن تک')
    expect(describeDosage({ ...tincture, qty: 1 }, 'ur')).toContain('1 قطرہ')
  })

  it('translates every frequency code', () => {
    const f = (freq: string) => describeDosage({ name: 'x', potency: '30', freq }, 'en')
    expect(f('OD')).toBe('once a day')
    expect(f('BD')).toBe('twice a day')
    expect(f('TD')).toBe('three times a day')
    expect(f('QD')).toBe('four times a day')
    expect(f('HS')).toBe('at bedtime')
    expect(describeDosage({ name: 'x', potency: '30', freq: 'HS' }, 'hi')).toBe('रात को सोते समय')
    expect(describeDosage({ name: 'x', potency: '30', freq: 'HS' }, 'ur')).toBe('رات کو سونے سے پہلے')
  })

  it('treats potency Ø as drops even without a type', () => {
    expect(describeDosage({ name: 'Q', potency: 'Ø', qty: 5 }, 'en')).toBe('5 drops')
  })

  it('biochemics (6x) use pills', () => {
    expect(describeDosage({ name: 'Nat Mur', potency: '6x', type: 'biochemic', qty: 6 }, 'en')).toBe('6 pills')
  })

  it('handles missing dosage fields', () => {
    expect(describeDosage({ name: 'x', potency: '30' }, 'en')).toBe('')
    expect(describeDosage({ name: 'x', potency: '30', days: 7 }, 'en')).toBe('for 7 days')
    expect(describeDosage({ name: 'x', potency: '30', food: 'PC' }, 'hi')).toBe('खाने के बाद')
    expect(describeDosage({ name: 'x', potency: '30', qty: 3, freq: 'ZZ' }, 'en')).toBe('3 pills')
  })
})

describe('buildSlip', () => {
  it('sets direction per language', () => {
    expect(slipFor('en', [pills]).dir).toBe('ltr')
    expect(slipFor('hi', [pills]).dir).toBe('ltr')
    expect(slipFor('ur', [pills]).dir).toBe('rtl')
  })

  it('formats header, dates and lines', () => {
    const s = slipFor('en', [pills, tincture], next)
    expect(s.patientName).toBe('Ramesh Kumar')
    expect(s.dateText).toBe('13 Oct 2026')
    expect(s.nextVisitText).toBe('20 Oct 2026')
    expect(s.lines).toHaveLength(2)
    expect(s.lines[0]).toMatchObject({ name: 'Arnica Montana', potency: '30' })
    expect(s.lines[1].instruction).toMatch(/drops/)
  })

  it('translates month names and labels', () => {
    expect(slipFor('hi', [pills]).dateText).toBe('13 अक्टूबर 2026')
    expect(slipFor('ur', [pills]).dateText).toBe('13 اکتوبر 2026')
    expect(slipFor('ur', [pills]).labels.patient).toBe('مریض')
  })

  it('omits next visit when absent and keeps medicines with no dosage', () => {
    const s = slipFor('en', [{ name: 'Belladonna', potency: '200' }], null)
    expect(s.nextVisitText).toBe('')
    expect(s.lines[0].instruction).toBe('')
  })

  it('skips blank-named medicines', () => {
    expect(slipFor('en', [{ name: ' ', potency: '30' }, pills]).lines).toHaveLength(1)
  })
})

describe('toWhatsAppText', () => {
  it('produces compact numbered plain text', () => {
    const t = toWhatsAppText(slipFor('en', [pills, tincture], next))
    expect(t.split('\n')).toEqual([
      '*Rashid Pharmacy*',
      'Dr. Saood Ahmad',
      'Main Road',
      '9876543210',
      '',
      'Patient: Ramesh Kumar',
      'Date: 13 Oct 2026',
      '',
      '1. Arnica Montana 30',
      '   2 pills, twice a day, before food, for 5 days',
      '2. Crataegus Ø',
      '   10 drops, three times a day, after food, for 10 days',
      '',
      'Next visit: 20 Oct 2026',
      '',
      'Take the medicines as directed. Get well soon.',
    ])
  })

  it('omits empty clinic fields and next visit', () => {
    const slip = buildSlip({
      clinic: { clinicName: '', doctorName: 'Dr. A' }, patientName: 'P', date, medicines: [{ name: 'X', potency: '30' }], lang: 'en',
    })
    const t = toWhatsAppText(slip)
    expect(t.startsWith('Dr. A\n\nPatient: P')).toBe(true)
    expect(t).not.toContain('Next visit')
  })

  it('works in Hindi and Urdu', () => {
    expect(toWhatsAppText(slipFor('hi', [pills]))).toContain('   2 गोलियाँ, दिन में दो बार, खाने से पहले, 5 दिन तक')
    expect(toWhatsAppText(slipFor('ur', [pills]))).toContain('مریض: Ramesh Kumar')
  })
})

describe('whatsAppUrl', () => {
  it('encodes newlines, markup and non-Latin text', () => {
    const text = toWhatsAppText(slipFor('hi', [pills]))
    const url = whatsAppUrl('98765 43210', text)
    expect(url.startsWith('https://wa.me/919876543210?text=')).toBe(true)
    const q = url.slice(url.indexOf('?text=') + 6)
    expect(q).not.toMatch(/[\s&]/)
    expect(q).toContain('%0A')
    expect(decodeURIComponent(q)).toBe(text)
  })

  it('falls back to the contact picker without a phone', () => {
    expect(whatsAppUrl(undefined, 'hi there & bye')).toBe('https://wa.me/?text=hi%20there%20%26%20bye')
    expect(whatsAppUrl('', 'x')).toBe('https://wa.me/?text=x')
    expect(whatsAppUrl('n/a', 'x')).toBe('https://wa.me/?text=x')
  })
})

describe('normalizeWhatsAppPhone', () => {
  it('adds India code to local numbers and keeps international ones', () => {
    expect(normalizeWhatsAppPhone('9876543210')).toBe('919876543210')
    expect(normalizeWhatsAppPhone('09876543210')).toBe('919876543210')
    expect(normalizeWhatsAppPhone('+91 98765-43210')).toBe('919876543210')
    expect(normalizeWhatsAppPhone('0091 9876543210')).toBe('919876543210')
    expect(normalizeWhatsAppPhone('+971 50 123 4567')).toBe('971501234567')
  })
})
