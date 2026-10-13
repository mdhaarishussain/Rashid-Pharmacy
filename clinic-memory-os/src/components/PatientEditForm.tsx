import React, { useRef, useState } from 'react'
import { db, type Patient, type Sex } from '../db/db'
import {
  SEX_OPTIONS,
  ageFromBirthYear,
  birthYearFromAge,
  cleanPhone,
  cleanPhoneInput,
  parseAge,
} from '../utils/identity'

interface Props {
  patient: Patient
  onSaved: (patient: Patient) => void
  onCancel: () => void
}

const inputClass =
  'w-full bg-panel border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors'

/** Inline editor for name / phone / age / sex. Saves through Dexie so sync metadata is stamped by the hooks. */
export default function PatientEditForm({ patient, onSaved, onCancel }: Props) {
  const [name, setName] = useState(patient.name)
  const [phone, setPhone] = useState(patient.phone ?? '')
  const [age, setAge] = useState(() => {
    const a = ageFromBirthYear(patient.birth_year)
    return a === null ? '' : String(a)
  })
  const [sex, setSex] = useState<Sex | undefined>(patient.sex)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)

  async function save() {
    if (savingRef.current || patient.id === undefined) return
    const trimmedName = name.trim()
    if (!trimmedName) return setError('Name cannot be empty.')
    const parsedAge = parseAge(age)
    if (age.trim() && parsedAge === null) return setError('Age must be a whole number from 0 to 120.')

    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      // undefined clears a field (Dexie removes the property)
      await db.patients.update(patient.id, {
        name: trimmedName,
        phone: cleanPhone(phone) || undefined,
        sex,
        birth_year: parsedAge === null ? undefined : birthYearFromAge(parsedAge),
      })
      const fresh = await db.patients.get(patient.id)
      if (fresh) onSaved(fresh)
    } catch (err) {
      console.error('Could not save patient:', err)
      setError('Could not save. Please try again.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      void save()
    }
    if (e.key === 'Escape') onCancel()
  }

  return (
    <form
      className="space-y-3"
      aria-label="Edit patient details"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <div>
        <label htmlFor="edit-patient-name" className="block text-sm font-medium text-muted mb-1">Name</label>
        <input
          id="edit-patient-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={200}
          autoFocus
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="edit-patient-phone" className="block text-sm font-medium text-muted mb-1">Phone</label>
        <input
          id="edit-patient-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(cleanPhoneInput(e.target.value))}
          onKeyDown={onKeyDown}
          maxLength={20}
          placeholder="Optional"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="edit-patient-age" className="block text-sm font-medium text-muted mb-1">Age (years)</label>
        <input
          id="edit-patient-age"
          type="number"
          inputMode="numeric"
          min={0}
          max={120}
          value={age}
          onChange={(e) => setAge(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Optional"
          className={inputClass}
        />
      </div>
      <fieldset>
        <legend className="block text-sm font-medium text-muted mb-1">Sex</legend>
        <div className="grid grid-cols-3 gap-2">
          {SEX_OPTIONS.map((o) => {
            const selected = sex === o.value
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setSex(selected ? undefined : o.value)}
                className={`min-h-[44px] rounded-lg border text-base font-semibold transition-colors ${
                  selected
                    ? 'bg-accent text-panel border-accent'
                    : 'bg-panel text-primary border-border hover:bg-card'
                }`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </fieldset>
      {error && <div role="alert" className="text-sm font-medium text-danger">{error}</div>}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] border border-border text-muted rounded-lg font-semibold text-base hover:bg-card transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] bg-accent hover:bg-accent-hover text-panel rounded-lg font-bold text-base shadow-sm disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
