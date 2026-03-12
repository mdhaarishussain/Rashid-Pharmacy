import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from '../db/db'
import type { Patient, MedicineEntry } from '../db/db'
import { MEDICINES, POTENCIES } from '../data/medicines'
import { addToIndex } from '../search/searchEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MigrationMed {
  name: string
  potency: string
}

interface MigrationVisit {
  id: string // local key only
  date: string        // YYYY-MM-DD
  symptoms: string
  medicines: MigrationMed[]
  feeTotal: number
  amountPaid: number
}

function makeVisit(): MigrationVisit {
  return {
    id: Math.random().toString(36).slice(2),
    date: new Date().toISOString().slice(0, 10),
    symptoms: '',
    medicines: [{ name: '', potency: '30' }],
    feeTotal: 0,
    amountPaid: 0,
  }
}

// ─── Medicine autocomplete input ──────────────────────────────────────────────

function MedInput({
  value,
  onChange,
}: {
  value: MigrationMed
  onChange: (m: MigrationMed) => void
}) {
  const [query, setQuery] = useState(value.name)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestions = query.trim().length >= 1
    ? MEDICINES.filter(
        (m) =>
          m.name.toLowerCase().includes(query.toLowerCase()) ||
          m.abbr.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  return (
    <div className="flex gap-1.5 items-center">
      {/* Medicine name with autocomplete */}
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            onChange({ ...value, name: e.target.value })
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Medicine name or abbr…"
          className="w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-sm text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        {open && suggestions.length > 0 && (
          <div className="absolute left-0 top-full mt-1 z-50 w-72 bg-panel border border-border rounded-xl shadow-xl overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s.name}
                onMouseDown={(e) => {
                  e.preventDefault()
                  setQuery(s.name)
                  onChange({ ...value, name: s.name })
                  setOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-card text-left transition-colors"
              >
                <span className="text-xs font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded w-10 text-center shrink-0">{s.abbr}</span>
                <span className="text-sm text-primary">{s.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Potency */}
      <select
        value={value.potency}
        onChange={(e) => onChange({ ...value, potency: e.target.value })}
        className="bg-surface border border-border rounded-lg px-2 py-2 text-sm text-primary focus:outline-none focus:border-accent"
      >
        {POTENCIES.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </div>
  )
}

// ─── Single visit form ────────────────────────────────────────────────────────

function VisitForm({
  visit,
  index,
  total,
  onUpdate,
  onRemove,
}: {
  visit: MigrationVisit
  index: number
  total: number
  onUpdate: (v: MigrationVisit) => void
  onRemove: () => void
}) {
  const setField = <K extends keyof MigrationVisit>(k: K, val: MigrationVisit[K]) =>
    onUpdate({ ...visit, [k]: val })

  const setMed = (i: number, m: MigrationMed) => {
    const meds = [...visit.medicines]
    meds[i] = m
    onUpdate({ ...visit, medicines: meds })
  }

  const addMed = () => onUpdate({ ...visit, medicines: [...visit.medicines, { name: '', potency: '30' }] })

  const removeMed = (i: number) => {
    const meds = visit.medicines.filter((_, idx) => idx !== i)
    onUpdate({ ...visit, medicines: meds.length ? meds : [{ name: '', potency: '30' }] })
  }

  const due = visit.feeTotal - visit.amountPaid

  return (
    <div className="border border-border rounded-2xl overflow-hidden shadow-sm">
      {/* Visit header */}
      <div className="flex items-center justify-between bg-card px-4 py-2.5 border-b border-border">
        <span className="font-bold text-primary text-sm">Visit {index + 1}</span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={visit.date}
            onChange={(e) => setField('date', e.target.value)}
            className="bg-surface border border-border rounded-lg px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-accent"
          />
          {total > 1 && (
            <button
              onClick={onRemove}
              className="text-muted hover:text-danger transition-colors"
              title="Remove this visit"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3 space-y-3 bg-panel">
        {/* Medicines */}
        <div>
          <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2">Medicines</div>
          <div className="space-y-2">
            {visit.medicines.map((m, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="flex-1">
                  <MedInput value={m} onChange={(updated) => setMed(i, updated)} />
                </div>
                {visit.medicines.length > 1 && (
                  <button
                    onClick={() => removeMed(i)}
                    className="text-muted hover:text-danger shrink-0 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={addMed}
            className="mt-2 text-xs text-accent hover:text-accent-hover font-semibold"
          >
            + Add medicine
          </button>
        </div>

        {/* Symptoms */}
        <div>
          <label className="text-xs font-bold text-muted uppercase tracking-wider mb-1 block">Symptoms / Notes</label>
          <textarea
            value={visit.symptoms}
            onChange={(e) => setField('symptoms', e.target.value)}
            rows={2}
            placeholder="Chief complaints, observations…"
            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-primary placeholder-muted resize-none focus:outline-none focus:border-accent"
          />
        </div>

        {/* Payment */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-xs text-muted mb-1 block">Fee (₹)</label>
            <input
              type="number" min={0} inputMode="numeric"
              value={visit.feeTotal || ''}
              onChange={(e) => setField('feeTotal', Number(e.target.value) || 0)}
              placeholder="0"
              className="w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-sm text-primary focus:outline-none focus:border-accent text-right"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Paid (₹)</label>
            <input
              type="number" min={0} inputMode="numeric"
              value={visit.amountPaid || ''}
              onChange={(e) => setField('amountPaid', Number(e.target.value) || 0)}
              placeholder="0"
              className="w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-sm text-primary focus:outline-none focus:border-accent text-right"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Due (₹)</label>
            <div className={`w-full rounded-lg px-2.5 py-2 text-sm font-bold text-right ${
              due > 0 ? 'bg-warning/10 text-warning' : due < 0 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
            }`}>
              {due}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── MigrationModal ───────────────────────────────────────────────────────────

interface Props {
  onClose: () => void
}

export default function MigrationModal({ onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Patient selection
  const [allPatients, setAllPatients] = useState<Patient[]>([])
  const [patientQuery, setPatientQuery] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [newPatientName, setNewPatientName] = useState('')
  const [mode, setMode] = useState<'select' | 'new'>('select')

  // Visits
  const [visits, setVisits] = useState<MigrationVisit[]>([makeVisit()])

  // Status
  const [saving, setSaving] = useState(false)
  const [savedCount, setSavedCount] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    db.patients.orderBy('name').toArray().then(setAllPatients)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const filteredPatients = patientQuery.trim()
    ? allPatients.filter((p) => p.name.toLowerCase().includes(patientQuery.toLowerCase()))
    : allPatients

  const updateVisit = useCallback((id: string, updated: MigrationVisit) => {
    setVisits((prev) => prev.map((v) => (v.id === id ? updated : v)))
  }, [])

  const removeVisit = useCallback((id: string) => {
    setVisits((prev) => prev.filter((v) => v.id !== id))
  }, [])

  const addVisit = useCallback(() => {
    setVisits((prev) => [...prev, makeVisit()])
  }, [])

  const handleSave = async () => {
    setError(null)
    setSaving(true)

    try {
      let patient = selectedPatient

      if (mode === 'new') {
        const name = newPatientName.trim()
        if (!name) { setError('Enter a patient name.'); setSaving(false); return }
        const id = await db.patients.add({ name, quick_note: '', created_at: Date.now() }) as number
        patient = await db.patients.get(id) ?? null
      }

      if (!patient) { setError('Select or create a patient.'); setSaving(false); return }

      // Sort visits chronologically before saving
      const sorted = [...visits].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )

      const existingCount = await db.visits.where('patient_id').equals(patient.id!).count()

      for (let i = 0; i < sorted.length; i++) {
        const v = sorted[i]
        const meds: MedicineEntry[] = v.medicines
          .filter((m) => m.name.trim())
          .map((m) => ({ name: m.name.trim(), potency: m.potency }))

        const visitDate = new Date(v.date).setHours(12, 0, 0, 0)
        const visitId = await db.visits.add({
          patient_id: patient.id!,
          date: visitDate,
          symptoms_text: v.symptoms,
          medicines_json: meds,
          fee_total: v.feeTotal,
          amount_paid: v.amountPaid,
          amount_due: v.feeTotal - v.amountPaid,
          visit_number: existingCount + i + 1,
        }) as number

        const saved = await db.visits.get(visitId)
        if (saved) addToIndex(saved, patient.name)
      }

      setSavedCount(sorted.length)
      setSaving(false)
    } catch (err) {
      setError(String(err))
      setSaving(false)
    }
  }

  if (savedCount !== null) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 backdrop-blur-sm">
        <div className="bg-panel rounded-2xl shadow-2xl border border-border p-8 text-center max-w-sm mx-4">
          <div className="w-16 h-16 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="text-xl font-bold text-primary mb-2">Imported Successfully</div>
          <div className="text-muted mb-6">{savedCount} visit{savedCount !== 1 ? 's' : ''} added to history.</div>
          <button
            onClick={onClose}
            className="bg-accent hover:bg-accent-hover text-panel font-bold px-6 py-3 rounded-xl transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-start justify-center bg-primary/40 backdrop-blur-sm overflow-y-auto py-6"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="bg-panel rounded-2xl shadow-2xl border border-border w-full max-w-2xl mx-4 overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-accent text-panel">
          <div className="flex items-center gap-2.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="font-bold text-lg">Import Patient History</span>
          </div>
          <button onClick={onClose} className="text-panel/70 hover:text-panel transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* Step 1 — Patient */}
          <div>
            <div className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-accent text-panel flex items-center justify-center text-xs font-black">1</span>
              Select Patient
            </div>

            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setMode('select')}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm border transition-colors ${
                  mode === 'select' ? 'bg-accent text-panel border-accent' : 'bg-surface text-muted border-border hover:border-accent'
                }`}
              >
                Existing Patient
              </button>
              <button
                onClick={() => setMode('new')}
                className={`flex-1 py-2.5 rounded-xl font-semibold text-sm border transition-colors ${
                  mode === 'new' ? 'bg-accent text-panel border-accent' : 'bg-surface text-muted border-border hover:border-accent'
                }`}
              >
                New Patient
              </button>
            </div>

            {mode === 'select' ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={patientQuery}
                  onChange={(e) => setPatientQuery(e.target.value)}
                  placeholder="Search patient name…"
                  className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <div className="max-h-40 overflow-y-auto border border-border rounded-xl divide-y divide-border">
                  {filteredPatients.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted">No patients found</div>
                  ) : filteredPatients.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPatient(p)}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors ${
                        selectedPatient?.id === p.id
                          ? 'bg-accent/10 text-accent font-semibold'
                          : 'hover:bg-card text-primary'
                      }`}
                    >
                      {selectedPatient?.id === p.id && (
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      <span className="text-sm">{p.name}</span>
                      {p.quick_note && <span className="text-xs text-muted truncate">{p.quick_note}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <input
                type="text"
                value={newPatientName}
                onChange={(e) => setNewPatientName(e.target.value)}
                placeholder="Patient full name…"
                className="w-full bg-surface border-2 border-accent rounded-xl px-4 py-2.5 text-sm text-primary focus:outline-none"
                autoFocus
              />
            )}
          </div>

          {/* Step 2 — Visits */}
          <div>
            <div className="text-sm font-bold text-primary mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-accent text-panel flex items-center justify-center text-xs font-black">2</span>
              Enter Past Visits
              <span className="ml-auto text-xs text-muted font-normal">Visits will be sorted by date automatically</span>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {visits.map((v, i) => (
                <VisitForm
                  key={v.id}
                  visit={v}
                  index={i}
                  total={visits.length}
                  onUpdate={(updated) => updateVisit(v.id, updated)}
                  onRemove={() => removeVisit(v.id)}
                />
              ))}
            </div>

            <button
              onClick={addVisit}
              className="mt-3 w-full border-2 border-dashed border-border hover:border-accent text-muted hover:text-accent rounded-xl py-3 text-sm font-semibold transition-colors"
            >
              + Add Another Visit
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-accent hover:bg-accent-hover text-panel font-bold text-base py-3.5 rounded-xl transition-colors shadow-md disabled:opacity-60"
          >
            {saving ? 'Saving…' : `Save ${visits.length} Visit${visits.length !== 1 ? 's' : ''} to History`}
          </button>
        </div>
      </div>
    </div>
  )
}
