import React, { useCallback, useEffect, useState } from 'react'
import type { AppAction } from '../state/useAppState'
import type { VisitDraft } from '../db/db'
import { deletePatient } from '../db/db'
import { removePatientFromIndex } from '../search/searchEngine'
import DuesModal from './DuesModal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  draft: VisitDraft | null
  activePatient: { id?: number; name: string; quick_note: string } | null
  patientVisitCount: number
  lastVisitDate: number | null
  savedAt: number | null
  totalOutstanding: number
  onPatientDeleted: () => void
  dispatch: React.Dispatch<AppAction>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: number | null): string {
  if (ts === null) return '—'
  return new Date(ts).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function computeDuration(firstVisitDate: number | null): string {
  if (!firstVisitDate) return '—'
  const days = Math.round((Date.now() - firstVisitDate) / (24 * 3600 * 1000))
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.floor(days / 7)}w ${days % 7}d`
  const months = Math.floor(days / 30)
  return `${months}mo`
}

// ─── SavedIndicator ───────────────────────────────────────────────────────────

function SavedIndicator({ savedAt }: { savedAt: number | null }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!savedAt) return
    setVisible(true)
    const t = setTimeout(() => setVisible(false), 2000)
    return () => clearTimeout(t)
  }, [savedAt])

  return (
    <div
      className={`flex items-center gap-1 text-sm font-medium text-success transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
      Saved
    </div>
  )
}

// ─── Quick symptoms ───────────────────────────────────────────────────────────

const QUICK_SYMPTOMS = [
  'Acidity', 'Anxiety', 'Back Pain', 'Breathlessness', 'Burning',
  'Cold / Flu', 'Constipation', 'Cough', 'Diarrhea', 'Fatigue',
  'Fever', 'Gripe', 'Headache', 'Insomnia', 'Itching',
  'Joint Pain', 'Nausea', 'Skin Rash', 'Vomiting', 'Weakness',
]

// ─── NumericInput ─────────────────────────────────────────────────────────────

function NumericInput({
  label,
  value,
  onChange,
  prefix = '₹',
}: {
  label: string
  value: number
  onChange: (v: number) => void
  prefix?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-muted mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-base font-medium">{prefix}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value || ''}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-3 text-primary text-lg font-semibold focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors shadow-sm"
          placeholder="0"
        />
      </div>
    </div>
  )
}

// ─── ClosurePanel ─────────────────────────────────────────────────────────────

export default function ClosurePanel({
  draft,
  activePatient,
  patientVisitCount,
  lastVisitDate,
  savedAt,
  totalOutstanding,
  onPatientDeleted,
  dispatch,
}: Props) {
  const [showDues, setShowDues] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const handleFeeChange = useCallback(
    (v: number) => dispatch({ type: 'UPDATE_PAYMENT', field: 'fee_total', value: v }),
    [dispatch]
  )

  const handlePaidChange = useCallback(
    (v: number) => dispatch({ type: 'UPDATE_PAYMENT', field: 'amount_paid', value: v }),
    [dispatch]
  )

  const handlePaidFull = useCallback(() => {
    if (!draft) return
    dispatch({ type: 'UPDATE_PAYMENT', field: 'amount_paid', value: draft.fee_total })
  }, [draft, dispatch])

  const handleMarkCredit = useCallback(() => {
    if (!draft) return
    dispatch({ type: 'UPDATE_PAYMENT', field: 'amount_paid', value: 0 })
  }, [draft, dispatch])

  const handleDeleteConfirm = useCallback(async () => {
    if (!activePatient?.id) return
    setDeleting(true)
    await deletePatient(activePatient.id)
    removePatientFromIndex(activePatient.id)
    dispatch({ type: 'CLEAR_PATIENT' })
    onPatientDeleted()
    setDeleting(false)
    setShowDeleteConfirm(false)
  }, [activePatient, dispatch, onPatientDeleted])

  const handleSymptomsChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) =>
      dispatch({ type: 'SET_SYMPTOMS', text: e.target.value }),
    [dispatch]
  )

  const handleAddSymptom = useCallback(
    (symptom: string) => {
      const current = draft?.symptoms_text ?? ''
      const sep = current.trim() ? ', ' : ''
      dispatch({ type: 'SET_SYMPTOMS', text: current + sep + symptom })
    },
    [draft, dispatch]
  )

  const amountDue = draft ? draft.amount_due : 0
  const isDue = amountDue > 0
  const isOverpaid = amountDue < 0

  return (
    <div
      className="flex flex-col h-full w-full bg-panel lg:border-l border-border shadow-sm"
      id="tutorial-closure"
    >
      {showDues && activePatient?.id && (
        <DuesModal
          patientId={activePatient.id}
          patientName={activePatient.name}
          onClose={() => setShowDues(false)}
          dispatch={dispatch}
        />
      )}

      {/* Delete confirmation overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center" onClick={() => setShowDeleteConfirm(false)}>
          <div className="absolute inset-0 bg-primary/60 backdrop-blur-sm" />
          <div
            className="relative z-10 bg-panel rounded-2xl border-2 border-danger shadow-2xl p-6 w-80 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div className="text-xl font-bold text-danger mb-2">Delete Patient?</div>
              <div className="text-muted text-sm leading-relaxed">
                This will permanently delete <strong className="text-primary">{activePatient?.name}</strong> and all {patientVisitCount} visit{patientVisitCount !== 1 ? 's' : ''}.
                <br /><span className="text-danger font-medium">This cannot be undone.</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border border-border text-muted rounded-xl py-3 font-semibold text-sm hover:bg-card transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 bg-danger hover:bg-danger/80 text-white rounded-xl py-3 font-bold text-sm shadow-sm disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0 flex items-center justify-between">
        <span className="text-sm font-bold text-primary">Payment</span>
        <SavedIndicator savedAt={savedAt} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Patient meta */}
        {activePatient ? (
          <div className="bg-surface border border-border rounded-xl p-4 space-y-2 shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-lg font-bold text-primary">{activePatient.name}</div>
                {activePatient.quick_note && (
                  <div className="text-sm text-muted italic">{activePatient.quick_note}</div>
                )}
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="ml-2 shrink-0 p-1.5 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
                title="Delete patient"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="bg-panel border border-border rounded-lg p-3 text-center shadow-sm">
                <div className="text-2xl font-bold text-primary">{patientVisitCount}</div>
                <div className="text-sm text-muted">Visits</div>
              </div>
              <div className="bg-panel border border-border rounded-lg p-3 text-center shadow-sm">
                <div className="text-sm font-semibold text-primary leading-tight">
                  {formatDate(lastVisitDate)}
                </div>
                <div className="text-sm text-muted">Last visit</div>
              </div>
            </div>
            {lastVisitDate && (
              <div className="text-sm text-muted text-center">
                Treatment: {computeDuration(lastVisitDate)}
              </div>
            )}
            {/* Outstanding dues badge */}
            {totalOutstanding > 0 ? (
              <button
                onClick={() => setShowDues(true)}
                className="w-full flex items-center justify-between bg-danger/10 hover:bg-danger/15 border border-danger/40 rounded-lg px-3 py-2.5 transition-colors mt-1"
              >
                <span className="flex items-center gap-1.5 text-sm font-bold text-danger">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Outstanding
                </span>
                <span className="text-base font-black text-danger">₹{totalOutstanding}</span>
              </button>
            ) : patientVisitCount > 0 ? (
              <div className="flex items-center justify-center gap-1.5 text-xs text-success font-medium pt-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                All dues cleared
              </div>
            ) : null}
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-5 text-center text-muted text-base">
            No patient selected
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-muted mb-1.5">Symptoms / Notes</label>
          {/* Quick symptom chips */}
          <div className={`flex flex-wrap gap-1.5 mb-2 ${!draft ? 'opacity-40 pointer-events-none' : ''}`}>
            {QUICK_SYMPTOMS.map((s) => (
              <button
                key={s}
                onClick={() => handleAddSymptom(s)}
                className="text-xs bg-card hover:bg-accent hover:text-panel border border-border hover:border-accent px-2 py-1 rounded-lg transition-colors font-medium text-muted"
              >
                {s}
              </button>
            ))}
          </div>
          <textarea
            value={draft?.symptoms_text ?? ''}
            onChange={handleSymptomsChange}
            disabled={!draft}
            placeholder="Symptoms, observations…"
            rows={3}
            className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 text-base text-primary placeholder-muted resize-none focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors shadow-sm disabled:opacity-40"
          />
        </div>

        {/* Payment */}
        <div className={`space-y-3 ${!draft ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="text-sm font-bold text-primary">Payment</div>

          <NumericInput
            label="Total Fee"
            value={draft?.fee_total ?? 0}
            onChange={handleFeeChange}
          />
          <NumericInput
            label="Paid"
            value={draft?.amount_paid ?? 0}
            onChange={handlePaidChange}
          />

          {/* Auto-calculated due */}
          <div className={`flex items-center justify-between rounded-xl px-4 py-4 border-2 transition-all ${
            isDue
              ? 'bg-danger/10 border-danger/50 shadow-lg shadow-danger/10'
              : isOverpaid
              ? 'bg-warning/10 border-warning/40 shadow-sm'
              : 'bg-surface border-border shadow-sm'
          }`}>
            <span className={`text-base font-bold ${isDue ? 'text-danger' : 'text-muted'}`}>
              {isDue ? '⚠ Due' : 'Due'}
            </span>
            <span
              className={`text-2xl font-black ${
                isDue ? 'text-danger' : isOverpaid ? 'text-warning' : 'text-success'
              }`}
            >
              ₹{Math.abs(amountDue)}
              {isOverpaid && <span className="text-xs text-muted ml-1 font-normal">(overpaid)</span>}
            </span>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handlePaidFull}
              className="bg-success/20 hover:bg-success/30 text-success border border-success/30 rounded-lg py-3 text-base font-semibold transition-colors shadow-sm"
            >
              Paid Full
            </button>
            <button
              onClick={handleMarkCredit}
              className="bg-warning/20 hover:bg-warning/30 text-warning border border-warning/30 rounded-lg py-3 text-base font-semibold transition-colors shadow-sm"
            >
              Credit
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
