import type { MedicineEntry } from '../db/db'

// Pure prescription-slip formatter. No DOM, no storage — easy to test.

export type SlipLang = 'en' | 'hi' | 'ur'

export const SLIP_LANGS: ReadonlyArray<{ code: SlipLang; label: string }> = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ur', label: 'اردو' },
]

export interface SlipClinic {
  clinicName: string
  doctorName: string
  address?: string
  phone?: string
}

export interface SlipLine {
  name: string
  potency: string
  /** Plain-language instruction in the slip language; '' when no dosage was set. */
  instruction: string
}

export interface Slip {
  lang: SlipLang
  dir: 'ltr' | 'rtl'
  clinicName: string
  doctorName: string
  address: string
  phone: string
  patientName: string
  dateText: string
  nextVisitText: string // '' when there is no next visit
  labels: { title: string; patient: string; date: string; nextVisit: string }
  lines: SlipLine[]
  footer: string
}

export interface SlipInput {
  clinic: SlipClinic
  patientName: string
  date: number // unix ms
  medicines: MedicineEntry[]
  nextVisit?: number | null // unix ms
  lang: SlipLang
}

// ─── Translations ────────────────────────────────────────────────────────────

interface Dict {
  dir: 'ltr' | 'rtl'
  sep: string
  months: string[]
  labels: Slip['labels']
  footer: string
  freq: Record<string, string>
  food: Record<string, string>
  days: (n: number) => string
  pills: (n: number) => string
  drops: (n: number) => string
}

const DICTS: Record<SlipLang, Dict> = {
  en: {
    dir: 'ltr',
    sep: ', ',
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    labels: { title: 'Prescription', patient: 'Patient', date: 'Date', nextVisit: 'Next visit' },
    footer: 'Take the medicines as directed. Get well soon.',
    freq: {
      OD: 'once a day',
      BD: 'twice a day',
      TD: 'three times a day',
      QD: 'four times a day',
      HS: 'at bedtime',
    },
    food: { AC: 'before food', PC: 'after food' },
    days: (n) => (n === 1 ? 'for 1 day' : `for ${n} days`),
    pills: (n) => (n === 1 ? '1 pill' : `${n} pills`),
    drops: (n) => (n === 1 ? '1 drop' : `${n} drops`),
  },
  hi: {
    dir: 'ltr',
    sep: ', ',
    months: ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'],
    labels: { title: 'पर्ची', patient: 'मरीज़', date: 'तारीख़', nextVisit: 'अगली मुलाक़ात' },
    footer: 'दवा बताए अनुसार लें। जल्द स्वस्थ हों।',
    freq: {
      OD: 'दिन में एक बार',
      BD: 'दिन में दो बार',
      TD: 'दिन में तीन बार',
      QD: 'दिन में चार बार',
      HS: 'रात को सोते समय',
    },
    food: { AC: 'खाने से पहले', PC: 'खाने के बाद' },
    days: (n) => `${n} दिन तक`,
    pills: (n) => (n === 1 ? '1 गोली' : `${n} गोलियाँ`),
    drops: (n) => (n === 1 ? '1 बूँद' : `${n} बूँदें`),
  },
  ur: {
    dir: 'rtl',
    sep: '، ',
    months: ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'],
    labels: { title: 'نسخہ', patient: 'مریض', date: 'تاریخ', nextVisit: 'اگلی ملاقات' },
    footer: 'دوا ہدایت کے مطابق لیں۔ جلد صحت یاب ہوں۔',
    freq: {
      OD: 'دن میں ایک بار',
      BD: 'دن میں دو بار',
      TD: 'دن میں تین بار',
      QD: 'دن میں چار بار',
      HS: 'رات کو سونے سے پہلے',
    },
    food: { AC: 'کھانے سے پہلے', PC: 'کھانے کے بعد' },
    days: (n) => `${n} دن تک`,
    pills: (n) => (n === 1 ? '1 گولی' : `${n} گولیاں`),
    drops: (n) => (n === 1 ? '1 قطرہ' : `${n} قطرے`),
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function isDropMedicine(m: Pick<MedicineEntry, 'type' | 'potency'>): boolean {
  return m.type === 'tincture' || m.potency === 'Ø'
}

/** "13 Oct 2026" — month names are translated; digits stay Latin so every reader can read them. */
export function formatSlipDate(ms: number, lang: SlipLang): string {
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} ${DICTS[lang].months[d.getMonth()]} ${d.getFullYear()}`
}

export function describeDosage(m: MedicineEntry, lang: SlipLang): string {
  const t = DICTS[lang]
  const parts: string[] = []
  if (typeof m.qty === 'number' && m.qty > 0) {
    parts.push(isDropMedicine(m) ? t.drops(m.qty) : t.pills(m.qty))
  }
  const freq = m.freq ? t.freq[m.freq.toUpperCase()] : undefined
  if (freq) parts.push(freq)
  const food = m.food ? t.food[m.food.toUpperCase()] : undefined
  if (food) parts.push(food)
  if (typeof m.days === 'number' && m.days > 0) parts.push(t.days(m.days))
  return parts.join(t.sep)
}

// ─── Slip ────────────────────────────────────────────────────────────────────

export function buildSlip(input: SlipInput): Slip {
  const t = DICTS[input.lang]
  return {
    lang: input.lang,
    dir: t.dir,
    clinicName: input.clinic.clinicName.trim(),
    doctorName: input.clinic.doctorName.trim(),
    address: (input.clinic.address ?? '').trim(),
    phone: (input.clinic.phone ?? '').trim(),
    patientName: input.patientName.trim(),
    dateText: formatSlipDate(input.date, input.lang),
    nextVisitText: input.nextVisit ? formatSlipDate(input.nextVisit, input.lang) : '',
    labels: t.labels,
    lines: input.medicines
      .filter((m) => m.name.trim())
      .map((m) => ({
        name: m.name.trim(),
        potency: (m.potency ?? '').trim(),
        instruction: describeDosage(m, input.lang),
      })),
    footer: t.footer,
  }
}

/** Compact plain-text version (WhatsApp markup: *bold*). */
export function toWhatsAppText(slip: Slip): string {
  const out: string[] = []
  if (slip.clinicName) out.push(`*${slip.clinicName}*`)
  if (slip.doctorName) out.push(slip.doctorName)
  if (slip.address) out.push(slip.address)
  if (slip.phone) out.push(slip.phone)
  if (out.length) out.push('')
  out.push(`${slip.labels.patient}: ${slip.patientName}`)
  out.push(`${slip.labels.date}: ${slip.dateText}`)
  out.push('')
  slip.lines.forEach((l, i) => {
    out.push(`${i + 1}. ${l.name}${l.potency ? ' ' + l.potency : ''}`)
    if (l.instruction) out.push(`   ${l.instruction}`)
  })
  if (slip.nextVisitText) {
    out.push('')
    out.push(`${slip.labels.nextVisit}: ${slip.nextVisitText}`)
  }
  out.push('')
  out.push(slip.footer)
  return out.join('\n')
}

/**
 * Digits-only international number for wa.me. A bare 10-digit Indian number
 * (or one with a leading trunk 0) gets the 91 country code; anything else is
 * assumed to already include its country code.
 */
export function normalizeWhatsAppPhone(phone: string | undefined | null): string {
  let digits = (phone ?? '').replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.length === 11 && digits.startsWith('0')) digits = '91' + digits.slice(1)
  else if (digits.length === 10) digits = '91' + digits
  return digits
}

export function whatsAppUrl(phone: string | undefined | null, text: string): string {
  const digits = normalizeWhatsAppPhone(phone)
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
