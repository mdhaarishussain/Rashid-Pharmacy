import { useCallback, useEffect, useState } from 'react'
import { db, getVisitsByPatient } from '../db/db'
import type { Visit } from '../db/db'
import type { AppAction } from '../state/useAppState'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  patientId: number
  patientName: string
  onClose: () => void
  dispatch: React.Dispatch<AppAction>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// ─── DuesModal ────────────────────────────────────────────────────────────────

export default function DuesModal({ patientId, patientName, onClose, dispatch }: Props) {
  const [allVisits, setAllVisits] = useState<Visit[]>([])
  const [payments, setPayments] = useState<Record<number, number>>({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = useCallback(async () => {
    const all = await getVisitsByPatient(patientId)
    setAllVisits(all)
    const init: Record<number, number> = {}
    all.forEach((v) => {
      init[v.id!] = v.amount_paid
    })
    setPayments(init)
  }, [patientId])

  useEffect(() => { load() }, [load])

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const visitsWithDues = allVisits.filter((v) => v.amount_due > 0)
  const totalDue = visitsWithDues.reduce((s, v) => {
    const newPaid = payments[v.id!] ?? v.amount_paid
    const remaining = v.fee_total - newPaid
    return s + Math.max(0, remaining)
  }, 0)
  const totalOriginalDue = visitsWithDues.reduce((s, v) => s + v.amount_due, 0)

  const handlePayAll = () => {
    setPayments((prev) => {
      const next = { ...prev }
      visitsWithDues.forEach((v) => { next[v.id!] = v.fee_total })
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    for (const v of visitsWithDues) {
      const newPaid = Math.min(payments[v.id!] ?? v.amount_paid, v.fee_total)
      if (newPaid !== v.amount_paid) {
        await db.visits.update(v.id!, {
          amount_paid: newPaid,
          amount_due: v.fee_total - newPaid,
        })
      }
    }
    // Reload patient context so ClosurePanel & timeline update
    const [updated, patient] = await Promise.all([
      getVisitsByPatient(patientId),
      db.patients.get(patientId),
    ])
    if (patient) dispatch({ type: 'LOAD_PATIENT', patient, visits: updated })
    setSaving(false)
    setSaved(true)
    setTimeout(onClose, 900)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-primary/60 backdrop-blur-sm" />
      <div
        className="relative z-10 bg-panel rounded-2xl shadow-2xl border border-border w-full max-w-lg mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-5 py-4 flex items-center justify-between ${totalDue > 0 ? 'bg-gradient-to-r from-warning to-warning/80' : 'bg-gradient-to-r from-success to-success/80'}`}>
          <div>
            <div className="text-white font-bold text-lg">{patientName}</div>
            <div className="text-white/80 text-sm">Outstanding Dues Ledger</div>
          </div>
          <div className="text-right">
            <div className="text-white/70 text-xs">Remaining Due</div>
            <div className="text-white font-black text-2xl">₹{totalDue}</div>
          </div>
        </div>

        {/* Visit rows */}
        <div className="max-h-80 overflow-y-auto divide-y divide-border">
          {visitsWithDues.length === 0 ? (
            <div className="p-10 text-center">
              <div className="text-4xl mb-2">✓</div>
              <div className="text-success font-bold text-base">No outstanding dues!</div>
              <div className="text-muted text-sm mt-1">All visits are fully settled.</div>
            </div>
          ) : (
            visitsWithDues.map((v) => {
              const currentPaid = payments[v.id!] ?? v.amount_paid
              const remaining = Math.max(0, v.fee_total - currentPaid)
              const changed = currentPaid !== v.amount_paid
              return (
                <div key={v.id} className={`px-5 py-4 ${changed ? 'bg-success/5' : ''}`}>
                  <div className="flex items-baseline justify-between mb-2.5">
                    <span className="text-sm font-medium text-muted">{formatDate(v.date)}</span>
                    <span className="text-sm text-primary font-semibold">
                      {v.medicines_json.slice(0, 3).map((m) => m.name.split(' ')[0]).join(' + ') || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="bg-surface rounded-lg py-2">
                        <div className="text-muted text-xs mb-0.5">Fee</div>
                        <div className="font-bold text-primary">₹{v.fee_total}</div>
                      </div>
                      <div className={`rounded-lg py-2 ${remaining > 0 ? 'bg-danger/10' : 'bg-success/10'}`}>
                        <div className="text-muted text-xs mb-0.5">Remaining</div>
                        <div className={`font-bold ${remaining > 0 ? 'text-danger' : 'text-success'}`}>
                          ₹{remaining}
                        </div>
                      </div>
                      <div className="bg-surface rounded-lg py-2 px-1">
                        <div className="text-muted text-xs mb-0.5">Mark Paid</div>
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted text-xs">₹</span>
                          <input
                            type="number"
                            min={0}
                            max={v.fee_total}
                            value={currentPaid || ''}
                            onChange={(e) =>
                              setPayments((p) => ({
                                ...p,
                                [v.id!]: Math.min(Number(e.target.value) || 0, v.fee_total),
                              }))
                            }
                            className="w-full border border-border rounded-lg pl-5 pr-1 py-1 text-sm font-bold text-primary focus:outline-none focus:border-accent bg-panel"
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        setPayments((p) => ({ ...p, [v.id!]: v.fee_total }))
                      }
                      className="text-xs bg-success/15 hover:bg-success/25 text-success border border-success/30 px-2 py-2.5 rounded-lg font-bold transition-colors shrink-0"
                    >
                      Full
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Total summary bar */}
        {visitsWithDues.length > 1 && (
          <div className="px-5 py-3 bg-card border-t border-border flex items-center justify-between">
            <span className="text-sm text-muted font-medium">
              Original: <span className="font-bold text-warning">₹{totalOriginalDue}</span>
            </span>
            <button
              onClick={handlePayAll}
              className="text-sm bg-success/15 hover:bg-success/25 text-success border border-success/30 px-3 py-1.5 rounded-lg font-bold transition-colors"
            >
              Settle All ₹{totalOriginalDue}
            </button>
          </div>
        )}

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-border flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-border text-muted rounded-xl py-3 font-semibold text-sm hover:bg-card transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || visitsWithDues.length === 0 || saved}
            className="flex-1 bg-accent hover:bg-accent-hover text-panel rounded-xl py-3 font-bold text-sm shadow-sm disabled:opacity-40 transition-all"
          >
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save Payments'}
          </button>
        </div>
      </div>
    </div>
  )
}
