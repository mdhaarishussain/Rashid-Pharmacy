import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getLivePatients, getLiveVisits, type Patient, type Visit } from '../db/db'
import {
  addDays,
  dayToCsv,
  duesList,
  medicineUsage,
  startOfDay,
  summarizeDay,
  type DaySummary as DaySummaryData,
} from '../services/daySummary'

type Tab = 'today' | 'dues' | 'medicines'

const USAGE_DAYS = 30
const USAGE_TOP = 20
const CLINIC_NAME = 'Rashid Pharmacy'
const DOCTOR_NAME = 'Dr. Saood Ahmad'

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`

const fullDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const shortDate = (ms: number) =>
  new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

const COLLECTED_NOTE =
  'Collected counts payments recorded on that day’s visits. Balances settled later in the Dues ledger update the old visit, so they are not counted again on the day they were received.'

function downloadText(filename: string, content: string, type: string) {
  // BOM so Excel opens ₹ and non-ASCII names correctly
  const url = URL.createObjectURL(new Blob(['﻿' + content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function isoDay(ms: number): string {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// ─── Print sheet ─────────────────────────────────────────────────────────────
// Rendered into document.body (outside #root, which is overflow:hidden) and only
// visible under @media print, so only the register page comes out of the printer.

const PRINT_CSS = `
#day-register-print { display: none; }
@media print {
  @page { size: A4; margin: 14mm; }
  html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
  #root { display: none !important; }
  #day-register-print { display: block !important; color: #000; font-family: Inter, system-ui, sans-serif; font-size: 11pt; }
  #day-register-print table { width: 100%; border-collapse: collapse; }
  #day-register-print th, #day-register-print td { border: 1px solid #000; padding: 4px 6px; text-align: left; vertical-align: top; }
  #day-register-print th { background: #eee; }
  #day-register-print td.n, #day-register-print th.n { text-align: right; white-space: nowrap; }
  #day-register-print tr { break-inside: avoid; }
  #day-register-print tfoot td { font-weight: 700; background: #f5f5f5; }
}
`

function PrintSheet({ summary }: { summary: DaySummaryData }) {
  return createPortal(
    <div id="day-register-print">
      <style>{PRINT_CSS}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: '18pt', fontWeight: 700 }}>{CLINIC_NAME}</div>
          <div>{DOCTOR_NAME}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 700 }}>Daily Register</div>
          <div>{fullDate(summary.dayStart)}</div>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Time</th>
            <th>Patient</th>
            <th className="n">Visit</th>
            <th>Medicines</th>
            <th className="n">Fee</th>
            <th className="n">Paid</th>
            <th className="n">Due</th>
          </tr>
        </thead>
        <tbody>
          {summary.rows.length === 0 && (
            <tr><td colSpan={8}>No visits recorded.</td></tr>
          )}
          {summary.rows.map((r, i) => (
            <tr key={r.visitId ?? i}>
              <td>{i + 1}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{r.timeLabel}</td>
              <td>{r.patientName}</td>
              <td className="n">{r.visitNumber}</td>
              <td>{r.medicines || '—'}</td>
              <td className="n">{r.fee}</td>
              <td className="n">{r.paid}</td>
              <td className="n">{r.due > 0 ? r.due : ''}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5}>
              Total · {summary.visitCount} visits · {summary.uniquePatients} patients · {summary.newPatients} new
            </td>
            <td className="n">{rupees(summary.totalFees)}</td>
            <td className="n">{rupees(summary.collected)}</td>
            <td className="n">{rupees(summary.newCredit)}</td>
          </tr>
        </tfoot>
      </table>
      <p style={{ fontSize: '8.5pt', marginTop: 8 }}>{COLLECTED_NOTE}</p>
    </div>,
    document.body,
  )
}

// ─── Small UI pieces ─────────────────────────────────────────────────────────

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'warn' }) {
  const color = tone === 'good' ? 'text-success' : tone === 'warn' ? 'text-warning' : 'text-primary'
  return (
    <div className="bg-surface border border-border rounded-xl px-3 py-2.5">
      <div className="text-xs font-semibold text-muted">{label}</div>
      <div className={`text-2xl font-bold tabular-nums leading-tight ${color}`}>{value}</div>
    </div>
  )
}

function NavButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="min-w-[44px] h-11 rounded-xl border border-border bg-card hover:bg-accent/20 text-primary text-xl font-bold transition-colors"
    >
      {children}
    </button>
  )
}

// ─── Dialog ──────────────────────────────────────────────────────────────────

export default function DaySummary({
  onClose,
  onOpenPatient,
}: {
  onClose: () => void
  /** Load this patient into the cockpit. The caller closes the dialog. */
  onOpenPatient: (patientId: number) => void
}) {
  const [tab, setTab] = useState<Tab>('today')
  const [dayStart, setDayStart] = useState(() => startOfDay(Date.now()))
  const [data, setData] = useState<{ visits: Visit[]; patients: Patient[] } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Mount-only: focus first control, close on Escape, restore focus on close
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [])

  // Reload whenever the tab changes so numbers are never stale
  useEffect(() => {
    let cancelled = false
    Promise.all([getLiveVisits(), getLivePatients()]).then(([visits, patients]) => {
      if (!cancelled) setData({ visits, patients })
    })
    return () => { cancelled = true }
  }, [tab])

  const summary = useMemo(
    () => (data ? summarizeDay(data.visits, data.patients, dayStart) : null),
    [data, dayStart],
  )
  const dues = useMemo(() => (data ? duesList(data.visits, data.patients) : []), [data])
  const usage = useMemo(
    () => (data ? medicineUsage(data.visits, addDays(startOfDay(Date.now()), -USAGE_DAYS)).slice(0, USAGE_TOP) : []),
    [data],
  )

  const todayStart = startOfDay(Date.now())
  const isToday = dayStart === todayStart

  const handleCsv = useCallback(() => {
    if (!summary) return
    downloadText(`register-${isoDay(summary.dayStart)}.csv`, dayToCsv(summary), 'text/csv;charset=utf-8')
  }, [summary])

  const tabBtn = (id: Tab, label: string) => (
    <button
      role="tab"
      id={`daysum-tab-${id}`}
      aria-selected={tab === id}
      aria-controls="daysum-panel"
      onClick={() => setTab(id)}
      className={`flex-1 h-12 text-base font-bold border-b-4 transition-colors ${
        tab === id ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-primary'
      }`}
    >
      {label}
      {id === 'dues' && dues.length > 0 && (
        <span className="ml-2 text-xs bg-danger text-white rounded-full px-2 py-0.5 align-middle">{dues.length}</span>
      )}
    </button>
  )

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-center justify-center" onClick={onClose}>
        <div className="absolute inset-0 bg-primary/60 backdrop-blur-sm" />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="daysum-title"
          className="relative z-10 bg-panel rounded-2xl border border-border shadow-2xl w-full max-w-3xl mx-3 max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-2 shrink-0">
            <h2 id="daysum-title" className="text-lg font-bold text-primary">Day summary</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="w-11 h-11 rounded-xl text-muted hover:bg-card hover:text-primary text-2xl leading-none"
            >
              ×
            </button>
          </div>

          <div role="tablist" className="flex shrink-0 border-b border-border px-3">
            {tabBtn('today', 'Today')}
            {tabBtn('dues', 'Dues')}
            {tabBtn('medicines', 'Medicines')}
          </div>

          <div id="daysum-panel" role="tabpanel" aria-labelledby={`daysum-tab-${tab}`} className="overflow-y-auto p-5">
            {!data || !summary ? (
              <div className="text-muted py-10 text-center animate-pulse">Loading…</div>
            ) : tab === 'today' ? (
              <>
                {/* Day navigation */}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <NavButton onClick={() => setDayStart((d) => addDays(d, -1))} label="Previous day">‹</NavButton>
                  <div className="flex-1 min-w-[10rem] text-center font-bold text-primary text-base">
                    {fullDate(dayStart)}
                  </div>
                  <NavButton onClick={() => setDayStart((d) => addDays(d, 1))} label="Next day">›</NavButton>
                  <button
                    onClick={() => setDayStart(todayStart)}
                    disabled={isToday}
                    className="h-11 px-4 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-sm disabled:opacity-40 transition-colors"
                  >
                    Today
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
                  <Tile label="Patients" value={summary.uniquePatients} />
                  <Tile label="Visits" value={summary.visitCount} />
                  <Tile label="New patients" value={summary.newPatients} />
                  <Tile label="Collected" value={rupees(summary.collected)} tone="good" />
                  <Tile label="New credit" value={rupees(summary.newCredit)} tone={summary.newCredit > 0 ? 'warn' : undefined} />
                  <Tile label="Fees" value={rupees(summary.totalFees)} />
                </div>
                <p className="text-xs text-muted mb-4 leading-relaxed">{COLLECTED_NOTE}</p>

                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => window.print()}
                    disabled={summary.visitCount === 0}
                    className="flex-1 sm:flex-none h-12 px-5 rounded-xl bg-accent hover:bg-accent-hover text-white font-bold text-sm disabled:opacity-40 transition-colors"
                  >
                    Print register
                  </button>
                  <button
                    onClick={handleCsv}
                    disabled={summary.visitCount === 0}
                    className="flex-1 sm:flex-none h-12 px-5 rounded-xl border border-border bg-card hover:bg-accent/20 text-primary font-bold text-sm disabled:opacity-40 transition-colors"
                  >
                    Download CSV
                  </button>
                </div>

                {summary.rows.length === 0 ? (
                  <div className="text-center text-muted py-8 border border-dashed border-border rounded-xl">
                    No visits recorded on this day.
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-border rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-card text-muted text-left">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Time</th>
                          <th className="px-3 py-2 font-semibold">Patient</th>
                          <th className="px-3 py-2 font-semibold text-right">Visit</th>
                          <th className="px-3 py-2 font-semibold">Medicines</th>
                          <th className="px-3 py-2 font-semibold text-right">Fee</th>
                          <th className="px-3 py-2 font-semibold text-right">Paid</th>
                          <th className="px-3 py-2 font-semibold text-right">Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.rows.map((r, i) => (
                          <tr key={r.visitId ?? i} className="border-t border-border align-top">
                            <td className="px-3 py-2 whitespace-nowrap tabular-nums text-muted">{r.timeLabel}</td>
                            <td className="px-3 py-2 font-semibold text-primary">{r.patientName}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{r.visitNumber}</td>
                            <td className="px-3 py-2 text-primary">{r.medicines || <span className="text-muted">—</span>}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{r.fee}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-success">{r.paid}</td>
                            <td className={`px-3 py-2 text-right tabular-nums ${r.due > 0 ? 'text-danger font-bold' : 'text-muted'}`}>
                              {r.due > 0 ? r.due : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {summary.topMedicines.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm font-bold text-primary mb-2">Top medicines this day</div>
                    <div className="flex flex-wrap gap-2">
                      {summary.topMedicines.slice(0, 8).map((m) => (
                        <span key={m.name} className="bg-card border border-border rounded-full px-3 py-1.5 text-sm text-primary">
                          {m.name} <b className="tabular-nums">×{m.count}</b>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : tab === 'dues' ? (
              dues.length === 0 ? (
                <div className="text-center text-success font-semibold py-10">No outstanding dues. ✓</div>
              ) : (
                <>
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="text-sm text-muted">{dues.length} patients owe money. Tap a name to open them.</span>
                    <span className="text-lg font-bold text-danger tabular-nums">
                      {rupees(dues.reduce((s, d) => s + d.outstanding, 0))}
                    </span>
                  </div>
                  <ul className="border border-border rounded-xl divide-y divide-border overflow-hidden">
                    {dues.map((d) => (
                      <li key={d.patientId}>
                        <button
                          onClick={() => onOpenPatient(d.patientId)}
                          className="w-full min-h-[56px] px-4 py-2 flex items-center gap-3 text-left hover:bg-accent/10 transition-colors"
                        >
                          <span className="flex-1 min-w-0">
                            <span className="block font-bold text-primary truncate">{d.name}</span>
                            <span className="block text-xs text-muted">
                              {d.lastVisitDate ? `Last visit ${shortDate(d.lastVisitDate)}` : 'No visits'}
                              {d.dueVisits > 1 ? ` · ${d.dueVisits} unpaid visits` : ''}
                            </span>
                          </span>
                          <span className="text-lg font-bold text-danger tabular-nums">{rupees(d.outstanding)}</span>
                          <span aria-hidden className="text-muted text-xl">›</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )
            ) : usage.length === 0 ? (
              <div className="text-center text-muted py-10">No medicines prescribed in the last {USAGE_DAYS} days.</div>
            ) : (
              <>
                <p className="text-sm text-muted mb-1">
                  Times prescribed in the last {USAGE_DAYS} days (top {USAGE_TOP}).
                </p>
                <p className="text-sm text-warning font-semibold mb-4">
                  Consider reordering: {usage.slice(0, 3).map((m) => m.name).join(', ')}
                </p>
                <ul className="space-y-2">
                  {usage.map((m) => {
                    const pct = Math.max(4, Math.round((m.count / usage[0].count) * 100))
                    return (
                      <li key={m.name} className="flex items-center gap-3">
                        <span className="w-40 sm:w-52 shrink-0 text-sm font-semibold text-primary truncate" title={m.name}>
                          {m.name}
                        </span>
                        <span className="flex-1 h-5 bg-card rounded-full overflow-hidden" aria-hidden>
                          <span className="block h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                        </span>
                        <span className="w-10 text-right text-sm font-bold tabular-nums text-primary">{m.count}</span>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      </div>
      {summary && tab === 'today' && <PrintSheet summary={summary} />}
    </>
  )
}
