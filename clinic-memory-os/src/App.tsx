import { useCallback, useEffect, useRef, useState } from 'react'
import { db } from './db/db'
import { seedDemoData } from './db/seed'
import { buildIndex, search } from './search/searchEngine'
import { useAppState } from './state/useAppState'
import { useAutosave } from './hooks/useAutosave'
import { loadDraftFromStorage } from './hooks/useAutosave'
import TimelinePanel from './components/TimelinePanel'
import MedicineCockpit from './components/MedicineCockpit'
import ClosurePanel from './components/ClosurePanel'
import MigrationModal from './components/MigrationModal'

// ─── Live clock — updates every 30 s ─────────────────────────────────────────

function LiveClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return (
    <span className="text-muted text-sm tabular-nums select-none">
      {now.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}
      {' · '}
      {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
    </span>
  )
}

// ─── Tutorial modal ───────────────────────────────────────────────────────────

// ─── Tutorial — interactive spotlight ────────────────────────────────────────

const TUTORIAL_STEPS = [
  {
    targetId: 'tutorial-timeline',
    title: 'Patient List',
    body: 'Search patients by name, medicine, or symptom. Click a patient row to load their history. Use the green "+ New" button to add a brand-new patient instantly.',
  },
  {
    targetId: 'tutorial-cockpit',
    title: 'Starting a Visit',
    body: 'After selecting a patient, click "New Visit" to begin. If the patient came before, "Repeat & Modify" copies the last prescription — great for returning cases.',
  },
  {
    targetId: 'tutorial-cockpit',
    title: 'Prescribing Medicines',
    body: 'Click slot 1, 2, or 3 to activate it (turns blue). In the Shelf below, search by full name or 2-letter short code — e.g. type "NV" for Nux Vomica, "MS" for Merc Sol. Then click a potency (6, 30, 200, 1M, 10M) to add it.',
  },
  {
    targetId: 'tutorial-closure',
    title: 'Symptoms & Notes',
    body: 'Tap a quick-symptom chip (Headache, Fever, Cough…) to add it in one tap. Type freely in the Notes box for anything else. All saved automatically.',
  },
  {
    targetId: 'tutorial-closure',
    title: 'Recording Payment',
    body: 'Enter the Total Fee and how much was Paid. Tap "Paid Full" to auto-fill, or "Credit" to mark as unpaid. There is no Save button — the visit saves itself.',
  },
  {
    targetId: 'tutorial-import-history',
    title: 'Importing Past History',
    body: 'For patients already on treatment, click the green "Import History" button in the header. Select or create the patient, then add each past visit — date, medicines, fees. Everything saves at once.',
  },
  {
    targetId: 'tutorial-closure',
    title: 'Managing Patient Dues',
    body: 'The right panel shows outstanding dues per patient. Click the red "Outstanding ₹X" button to open the Dues Ledger — see each visit\'s balance, edit payments, and settle unpaid balances. Fully paid patients show a green checkmark.',
  },
  {
    targetId: 'tutorial-closure',
    title: 'Deleting a Patient',
    body: 'To remove a patient completely, click the trash icon in their card header. A confirmation appears — verify the patient name and visit count, then confirm. All visits and records are permanently deleted.',
  },
]

function TutorialModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [dims, setDims] = useState({ w: window.innerWidth, h: window.innerHeight })
  const total = TUTORIAL_STEPS.length
  const current = TUTORIAL_STEPS[step]

  // Measure the spotlight target
  useEffect(() => {
    const measure = () => {
      const el = document.getElementById(current.targetId)
      setTargetRect(el ? el.getBoundingClientRect() : null)
      setDims({ w: window.innerWidth, h: window.innerHeight })
    }
    const t = setTimeout(measure, 50)
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); window.removeEventListener('resize', measure) }
  }, [step, current.targetId])

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') setStep(s => Math.min(s + 1, total - 1))
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') setStep(s => Math.max(s - 1, 0))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, total])

  const PAD = 14
  const r = targetRect
  const { w: W, h: H } = dims

  // Place card at bottom if spotlight is in upper half, else at top
  const cardAtBottom = !r || r.top < H * 0.55

  return (
    <div className="fixed inset-0 z-[50]" onClick={onClose}>
      {/* SVG overlay — dark everywhere, transparent hole over target */}
      <svg
        style={{ position: 'fixed', inset: 0, zIndex: 50, pointerEvents: 'none' }}
        width={W} height={H}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* The mask is white (show overlay) everywhere, black (hide = transparent) over target */}
          <mask id="tm-mask">
            <rect width={W} height={H} fill="white" />
            {r && (
              <rect
                x={r.left - PAD} y={r.top - PAD}
                width={r.width + PAD * 2} height={r.height + PAD * 2}
                rx="12" fill="black"
              />
            )}
          </mask>
          <filter id="tm-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* Dimmed overlay with the hole */}
        <rect width={W} height={H} fill="rgba(14,32,46,0.84)" mask="url(#tm-mask)" />
        {/* Glowing accent border around the spotlight */}
        {r && (
          <rect
            x={r.left - PAD} y={r.top - PAD}
            width={r.width + PAD * 2} height={r.height + PAD * 2}
            rx="12" fill="none"
            stroke="#0369a1" strokeWidth="2.5"
            filter="url(#tm-glow)"
          />
        )}
      </svg>

      {/* Transparent click-to-close layer behind card */}
      <div className="fixed inset-0 z-[51]" onClick={onClose} />

      {/* Tutorial info card */}
      <div
        className="fixed z-[52] w-[22rem] bg-panel rounded-2xl shadow-2xl border-2 border-accent/40 overflow-hidden"
        style={{
          left: '50%',
          transform: 'translateX(-50%)',
          ...(cardAtBottom ? { bottom: 24 } : { top: 24 }),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step header */}
        <div className="bg-gradient-to-r from-accent to-accent-hover px-5 py-4 flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-white/25 flex items-center justify-center font-black text-2xl text-white shrink-0 select-none">
            {step + 1}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white/70 text-[11px] font-medium tracking-wide uppercase">Step {step + 1} of {total}</div>
            <div className="text-white font-bold text-base leading-snug">{current.title}</div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors shrink-0" title="Close (Esc)">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pt-4 pb-5">
          {/* Description */}
          <p className="text-primary text-sm leading-relaxed mb-5">{current.body}</p>

          {/* Pill progress indicators */}
          <div className="flex justify-center items-center gap-1.5 mb-5">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  i === step ? 'bg-accent w-7' : 'bg-border hover:bg-muted w-2.5'
                }`}
                title={`Step ${i + 1}`}
              />
            ))}
          </div>

          {/* Prev / Next navigation */}
          <div className="flex gap-2.5">
            <button
              onClick={() => setStep(s => Math.max(s - 1, 0))}
              disabled={step === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-card border border-border text-sm font-semibold text-primary disabled:opacity-25 hover:bg-card/80 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>
            {step < total - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-panel font-bold text-sm transition-colors shadow-sm"
              >
                Next
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                onClick={onClose}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-success hover:bg-success/80 text-white font-bold text-sm transition-colors shadow-sm"
              >
                Got it!
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </button>
            )}
          </div>

          <div className="flex justify-center gap-1 mt-3 text-[11px] text-muted">
            <kbd className="bg-card border border-border rounded px-1.5 py-0.5 font-mono">←</kbd>
            <kbd className="bg-card border border-border rounded px-1.5 py-0.5 font-mono">→</kbd>
            <span className="ml-1">navigate</span>
            <span className="mx-1">·</span>
            <kbd className="bg-card border border-border rounded px-1.5 py-0.5 font-mono">Esc</kbd>
            <span className="ml-1">close</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const { state, dispatch } = useAppState()
  const [indexReady, setIndexReady] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const [showMigration, setShowMigration] = useState(false)
  const [searchResetKey, setSearchResetKey] = useState(0)
  const [activeMobileTab, setActiveMobileTab] = useState<'patients' | 'medicines' | 'payment'>('medicines')
  const prevSavedAtRef = useRef<number | null>(null)

  // ── Refresh timeline after autosave updates index ──────────────────────────
  useEffect(() => {
    if (!state.savedAt || state.savedAt === prevSavedAtRef.current) return
    prevSavedAtRef.current = state.savedAt
    const results = search(state.searchQuery)
    dispatch({ type: 'SET_SEARCH_RESULTS', results })
  }, [state.savedAt, state.searchQuery, dispatch])

  // ── Global keyboard shortcuts ──────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, button')) return
      if (showTutorial || showMigration) return
      if (e.key === '1') { e.preventDefault(); dispatch({ type: 'SET_ACTIVE_SLOT', index: 0 }) }
      if (e.key === '2') { e.preventDefault(); dispatch({ type: 'SET_ACTIVE_SLOT', index: 1 }) }
      if (e.key === '3') { e.preventDefault(); dispatch({ type: 'SET_ACTIVE_SLOT', index: 2 }) }
      if (e.key === 'Enter' && state.activePatient && !state.draft) {
        e.preventDefault()
        if (state.lastVisit) {
          dispatch({ type: 'REPEAT_AND_MODIFY' })
        } else {
          dispatch({ type: 'INIT_DRAFT', visitNumber: state.patientVisits.length + 1 })
        }
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'SET_SEARCH_QUERY', query: '' })
        dispatch({ type: 'SET_SEARCH_RESULTS', results: search('') })
        setSearchResetKey((k) => k + 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dispatch, showTutorial, showMigration, state.activePatient, state.draft, state.lastVisit, state.patientVisits.length])

  // ── Bootstrap: seed + build search index + restore draft ──────────────────
  useEffect(() => {
    async function init() {
      await seedDemoData()

      const [visits, patients] = await Promise.all([
        db.visits.toArray(),
        db.patients.toArray(),
      ])
      buildIndex(visits, patients)
      setIndexReady(true)

      // Draft recovery after refresh
      const savedDraft = loadDraftFromStorage()
      if (savedDraft) {
        const patient = await db.patients.get(savedDraft.patient_id)
        if (patient) {
          dispatch({ type: 'RESTORE_DRAFT', draft: savedDraft, patient })
        }
      }
    }
    init()
  }, [dispatch])

  // ── Autosave ───────────────────────────────────────────────────────────────
  useAutosave({
    draft: state.draft,
    patientName: state.activePatient?.name ?? '',
    dispatch,
  })

  // ── Visit count + last visit date ──────────────────────────────────────────
  const patientVisitCount = state.patientVisits.length
  const lastVisitDate = state.patientVisits.length > 0 ? state.patientVisits[0].date : null
  const totalOutstanding = state.patientVisits.reduce((s, v) => s + (v.amount_due || 0), 0)

  const handlePatientDeleted = useCallback(() => {
    const results = search('')
    dispatch({ type: 'SET_SEARCH_RESULTS', results })
  }, [dispatch])

  if (!indexReady) {
    return (
      <div className="h-screen bg-surface flex items-center justify-center">
        <div className="text-muted text-lg animate-pulse">Loading…</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface text-primary">
      {showTutorial && <TutorialModal onClose={() => setShowTutorial(false)} />}
      {showMigration && <MigrationModal onClose={() => setShowMigration(false)} />}

      {/* ── Top header bar ─────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-5 py-2.5 bg-panel border-b-2 border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center shrink-0 shadow-sm">
            {/* Homoeopathic bottle icon */}
            <svg className="w-5 h-5 text-panel" viewBox="0 0 24 24" fill="currentColor">
              {/* Cap */}
              <rect x="9.5" y="2" width="5" height="2.5" rx="1.1"/>
              {/* Neck (trapezoid) */}
              <path d="M10.5 4.5 L9 8 H15 L13.5 4.5 Z"/>
              {/* Body */}
              <rect x="6" y="7.5" width="12" height="13.5" rx="3.2"/>
              {/* Pills — rendered as semi-transparent punched holes */}
              <circle cx="10" cy="12" r="1.55" fill="rgba(0,53,100,0.35)"/>
              <circle cx="14" cy="12" r="1.55" fill="rgba(0,53,100,0.35)"/>
              <circle cx="12" cy="16.2" r="1.55" fill="rgba(0,53,100,0.35)"/>
            </svg>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-primary text-lg tracking-tight">Rashid Pharmacy</span>
            <span className="text-muted text-xs font-medium">Dr. Saood Ahmad · Consultation</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LiveClock />
          <button
            id="tutorial-import-history"
            onClick={() => setShowMigration(true)}
            className="flex items-center gap-1.5 bg-card hover:bg-success/20 hover:text-success border border-border hover:border-success/40 text-muted px-3 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            title="Import past patient visits"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span className="hidden sm:inline">Import History</span>
          </button>
          <button
            onClick={() => setShowTutorial(true)}
            className="flex items-center gap-1.5 bg-card hover:bg-accent hover:text-panel border border-border text-muted hover:border-accent px-3 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
            title="How to use this system"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">How to Use</span>
          </button>
        </div>
      </div>

      {/* ── Three panel layout ──────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden flex-col lg:flex-row">
        {/* Mobile tab bar */}
        <div className="lg:hidden flex shrink-0 border-b border-border bg-card">
          <button
            onClick={() => setActiveMobileTab('patients')}
            className={`flex-1 py-3 px-2 text-sm font-semibold transition-colors border-b-2 ${'patients' === activeMobileTab ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-primary'}`}
          >
            Patients
          </button>
          <button
            onClick={() => setActiveMobileTab('medicines')}
            className={`flex-1 py-3 px-2 text-sm font-semibold transition-colors border-b-2 ${'medicines' === activeMobileTab ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-primary'}`}
          >
            Medicines
          </button>
          <button
            onClick={() => setActiveMobileTab('payment')}
            className={`flex-1 py-3 px-2 text-sm font-semibold transition-colors border-b-2 ${'payment' === activeMobileTab ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-primary'}`}
          >
            Payment
          </button>
        </div>

        {/* LEFT — Timeline Panel (hidden on mobile except when tab is "patients") */}
        {(activeMobileTab === 'patients' || window.innerWidth >= 1024) && (
          <div className="hidden lg:flex lg:flex-col shrink-0" style={{ width: '22%', minWidth: 200 }}>
            <TimelinePanel
              searchQuery={state.searchQuery}
              searchResults={state.searchResults}
              dispatch={dispatch}
              activePatientId={state.activePatient?.id ?? null}
              searchResetKey={searchResetKey}
            />
          </div>
        )}

        {activeMobileTab === 'patients' && window.innerWidth < 1024 && (
          <div className="flex flex-col h-full flex-1">
            <TimelinePanel
              searchQuery={state.searchQuery}
              searchResults={state.searchResults}
              dispatch={dispatch}
              activePatientId={state.activePatient?.id ?? null}
              searchResetKey={searchResetKey}
            />
          </div>
        )}

        {/* CENTER — Medicine Cockpit (shown on mobile when "medicines" tab, always on desktop) */}
        {(activeMobileTab === 'medicines' || window.innerWidth >= 1024) && (
          <MedicineCockpit
            slots={state.slots}
            activeSlotIndex={state.activeSlotIndex}
            lastVisit={state.lastVisit}
            activePatient={state.activePatient}
            draft={state.draft}
            dispatch={dispatch}
          />
        )}

        {/* RIGHT — Closure Panel (hidden on mobile except when tab is "payment") */}
        {(activeMobileTab === 'payment' || window.innerWidth >= 1024) && (
          <div className="hidden lg:flex lg:flex-col shrink-0" style={{ width: '22%', minWidth: 200 }}>
            <ClosurePanel
              draft={state.draft}
              activePatient={state.activePatient}
              patientVisitCount={patientVisitCount}
              lastVisitDate={lastVisitDate}
              savedAt={state.savedAt}
              totalOutstanding={totalOutstanding}
              onPatientDeleted={handlePatientDeleted}
              dispatch={dispatch}
            />
          </div>
        )}

        {activeMobileTab === 'payment' && window.innerWidth < 1024 && (
          <div className="flex flex-col h-full flex-1">
            <ClosurePanel
              draft={state.draft}
              activePatient={state.activePatient}
              patientVisitCount={patientVisitCount}
              lastVisitDate={lastVisitDate}
              savedAt={state.savedAt}
              totalOutstanding={totalOutstanding}
              onPatientDeleted={handlePatientDeleted}
              dispatch={dispatch}
            />
          </div>
        )}
      </div>
    </div>
  )
}
