import React, { useCallback, useEffect, useRef, useState } from 'react'
import { FixedSizeList, type ListChildComponentProps } from 'react-window'
import { db } from '../db/db'
import { search } from '../search/searchEngine'
import type { SearchResult } from '../search/searchEngine'
import type { AppAction } from '../state/useAppState'
import { getVisitsByPatient } from '../db/db'
import { loadDue, type DueItem } from '../db/due'
import { summariseDue } from '../utils/followUp'
import { cleanPhone, cleanPhoneInput, identityLabel } from '../utils/identity'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  searchQuery: string
  searchResults: SearchResult[]
  dispatch: React.Dispatch<AppAction>
  activePatientId: number | null
  searchResetKey?: number
  /** Changes whenever data may have changed (autosave, sync, edits) so the due strip refreshes. */
  dueRefreshKey?: string | number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function dueLabel(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'Due today'
  return daysOverdue === 1 ? 'Overdue 1 day' : `Overdue ${daysOverdue} days`
}

function abbreviateName(name: string): string {
  const parts = name.split(' ')
  if (parts.length === 1) return name
  return parts[0]
}

// ─── Row component ────────────────────────────────────────────────────────────

interface RowData {
  results: SearchResult[]
  activePatientId: number | null
  onSelect: (result: SearchResult) => void
  query: string
  onAddNewPatient: (name: string) => void
}

function VisitRow({ index, style, data }: ListChildComponentProps<RowData>) {
  const { results, activePatientId, onSelect, query, onAddNewPatient } = data
  const totalItems = results.length
  const showAddNew = query.trim().length > 1

  // Last item is the "Add new patient" option when applicable
  if (showAddNew && index === totalItems) {
    return (
      <div
        style={style}
        className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-card border-t-2 border-border text-accent"
        onClick={() => onAddNewPatient(query.trim())}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            e.stopPropagation()
            onAddNewPatient(query.trim())
          }
        }}
      >
        <span className="text-xl leading-none font-bold">+</span>
        <span className="text-base">
          Add new patient: <strong>{query.trim()}</strong>
        </span>
      </div>
    )
  }

  const result = results[index]
  if (!result) return null

  const isActive = result.patientId === activePatientId
  const identity = identityLabel({ phone: result.patientPhone, birth_year: result.patientBirthYear })
  const chips = (result.medicineSummary || '').split(' + ').filter(Boolean)

  return (
    <div
      style={style}
      className={`flex items-center gap-0 px-3 cursor-pointer select-none transition-colors ${
        isActive
          ? 'bg-accent/10 border-l-4 border-accent'
          : 'hover:bg-card border-l-4 border-transparent'
      }`}
      onClick={() => onSelect(result)}
      role="button"
      tabIndex={0}
      aria-current={isActive ? 'true' : undefined}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && isActive) return // let the global Enter shortcut start a visit
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          onSelect(result)
        }
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm text-muted shrink-0">{formatDate(result.date)}</span>
          <span
            className={`text-base font-semibold truncate ${isActive ? 'text-accent' : 'text-primary'}`}
          >
            {abbreviateName(result.patientName)}
          </span>
          {identity && (
            <span className="text-xs text-muted shrink-0 tabular-nums" title={result.patientName}>
              {identity}
            </span>
          )}
        </div>
        {chips.length > 0 ? (
          <div className="flex items-center gap-1 mt-0.5 flex-nowrap overflow-hidden">
            {chips.map((c, ci) => (
              <span
                key={ci}
                className={`text-xs px-1.5 py-0.5 rounded font-semibold leading-none shrink-0 ${
                  isActive
                    ? 'bg-panel text-accent border border-accent/30'
                    : 'bg-card text-muted border border-border/60'
                }`}
              >
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-xs text-muted" aria-label="No medicines">—</div>
        )}
      </div>
    </div>
  )
}

// ─── TimelinePanel ────────────────────────────────────────────────────────────

export default function TimelinePanel({ searchQuery, searchResults, dispatch, activePatientId, searchResetKey = 0, dueRefreshKey = 0 }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const newPatientInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef = useRef<FixedSizeList<RowData>>(null)
  const [localQuery, setLocalQuery] = useState(searchQuery)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [dueItems, setDueItems] = useState<DueItem[]>([])
  const [showDue, setShowDue] = useState(false)

  // Follow-ups due today / overdue — one indexed query, refreshed after saves and sync
  useEffect(() => {
    let cancelled = false
    loadDue()
      .then((items) => { if (!cancelled) setDueItems(items) })
      .catch((err) => console.error('Could not load follow-ups:', err))
    return () => { cancelled = true }
  }, [dueRefreshKey])

  const dueSummary = summariseDue(dueItems)
  const dueCount = dueSummary.today + dueSummary.overdue
  const dueVisible = showDue && dueCount > 0

  // Debounced search
  const handleQueryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value
      setLocalQuery(val)
      if (val) setShowDue(false) // a new search replaces the due list
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        dispatch({ type: 'SET_SEARCH_QUERY', query: val })
        const results = search(val)
        dispatch({ type: 'SET_SEARCH_RESULTS', results })
      }, 120)
    },
    [dispatch]
  )

  const clearQuery = useCallback(() => {
    setLocalQuery('')
    dispatch({ type: 'SET_SEARCH_QUERY', query: '' })
    const results = search('')
    dispatch({ type: 'SET_SEARCH_RESULTS', results })
    inputRef.current?.focus()
  }, [dispatch])

  const loadPatientById = useCallback(
    async (patientId: number) => {
      const patient = await db.patients.get(patientId)
      if (!patient) return
      const visits = await getVisitsByPatient(patientId)
      dispatch({ type: 'LOAD_PATIENT', patient, visits })
    },
    [dispatch]
  )

  const handleSelect = useCallback(
    (result: SearchResult) => loadPatientById(result.patientId),
    [loadPatientById]
  )

  const handleAddNewPatient = useCallback(
    async (name: string, phone = '') => {
      const trimmed = name.trim()
      if (!trimmed) return
      const cleanedPhone = cleanPhone(phone)
      const id = await db.patients.add({
        name: trimmed,
        quick_note: '',
        created_at: Date.now(),
        ...(cleanedPhone && { phone: cleanedPhone }),
      })
      const patient = await db.patients.get(id)
      if (!patient) return
      dispatch({ type: 'NEW_PATIENT', patient })
      // Clear search
      setLocalQuery('')
      dispatch({ type: 'SET_SEARCH_QUERY', query: '' })
      const results = search('')
      dispatch({ type: 'SET_SEARCH_RESULTS', results })
    },
    [dispatch]
  )

  // Auto-focus new patient input when form opens
  useEffect(() => {
    if (showNewForm) newPatientInputRef.current?.focus()
  }, [showNewForm])

  // Autofocus search on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleOpenNewForm = useCallback(() => {
    setShowNewForm(true)
    setNewName('')
    setNewPhone('')
  }, [])

  const handleCancelNewForm = useCallback(() => {
    setShowNewForm(false)
    setNewName('')
    setNewPhone('')
  }, [])

  const handleSubmitNewPatient = useCallback(async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    await handleAddNewPatient(trimmed, newPhone)
    setShowNewForm(false)
    setNewName('')
    setNewPhone('')
  }, [newName, newPhone, handleAddNewPatient])

  const handleNewPatientKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSubmitNewPatient()
    if (e.key === 'Escape') handleCancelNewForm()
  }, [handleSubmitNewPatient, handleCancelNewForm])

  // Initial results load  
  useEffect(() => {
    const results = search('')
    dispatch({ type: 'SET_SEARCH_RESULTS', results })
  }, [dispatch])

  // Scroll to keep the active patient visible when selection changes
  useEffect(() => {
    if (!activePatientId) return
    const idx = searchResults.findIndex((r) => r.patientId === activePatientId)
    if (idx >= 0) listRef.current?.scrollToItem(idx, 'smart')
  }, [activePatientId, searchResults])

  // Reset search when triggered from parent (Esc shortcut)
  useEffect(() => {
    if (!searchResetKey) return
    setLocalQuery('')
    const results = search('')
    dispatch({ type: 'SET_SEARCH_RESULTS', results })
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [searchResetKey, dispatch])

  const showAddNew = localQuery.trim().length > 1
  const listItemCount = showAddNew ? searchResults.length + 1 : searchResults.length

  const itemData: RowData = {
    results: searchResults,
    activePatientId,
    onSelect: handleSelect,
    query: localQuery,
    onAddNewPatient: handleAddNewPatient,
  }

  return (
    <div id="tutorial-timeline" role="region" aria-label="Patients" className="flex flex-col h-full w-full bg-panel border-r border-border shadow-sm lg:border-r">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0 bg-panel">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-sm font-bold text-primary">Patients</div>
          <button
            onClick={handleOpenNewForm}
            className="flex items-center gap-1 bg-success/20 hover:bg-success/30 text-green-800 border border-success/30 px-2.5 py-1.5 rounded-lg text-sm font-bold transition-colors"
            title="Add a new patient"
          >
            <span className="text-base leading-none" aria-hidden="true">+</span>
            <span>New</span>
          </button>
        </div>
        {/* Due strip — only when someone is due back */}
        {dueCount > 0 && (
          <button
            type="button"
            onClick={() => setShowDue((v) => !v)}
            aria-expanded={dueVisible}
            aria-controls="due-list"
            className={`w-full min-h-[44px] mb-2.5 flex items-center justify-between gap-2 rounded-lg border px-3 text-sm font-bold transition-colors ${
              dueVisible
                ? 'bg-warning/20 border-warning/50 text-primary'
                : 'bg-warning/10 border-warning/30 text-primary hover:bg-warning/20'
            }`}
          >
            <span>
              Due today: <span className="tabular-nums">{dueSummary.today}</span>
              {' · '}
              <span className={dueSummary.overdue > 0 ? 'text-danger' : ''}>
                Overdue: <span className="tabular-nums">{dueSummary.overdue}</span>
              </span>
            </span>
            <span className="text-sm font-semibold text-muted">{dueVisible ? 'Hide' : 'Show'}</span>
          </button>
        )}
        {/* Search input */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={localQuery}
            onChange={handleQueryChange}
            placeholder="Name, medicine, symptom…"
            aria-label="Search patients by name, medicine or symptom"
            className="w-full bg-surface border border-border rounded-lg pl-10 pr-8 py-3 text-base text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors shadow-sm"
          />
          {localQuery && (
            <button
              onClick={clearQuery}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-muted hover:text-primary"
              aria-label="Clear search"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Inline new patient form */}
        {showNewForm && (
          <div className="mt-2.5 space-y-2">
            <div className="flex gap-2 items-center">
              <input
                ref={newPatientInputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={handleNewPatientKeyDown}
                placeholder="Patient full name…"
                aria-label="New patient name"
                className="flex-1 min-w-0 bg-surface border-2 border-accent rounded-lg px-3 py-2.5 min-h-[44px] text-base text-primary focus:outline-none shadow-sm"
              />
              <button
                onClick={handleSubmitNewPatient}
                className="bg-accent hover:bg-accent-hover text-panel px-3 min-h-[44px] rounded-lg font-bold text-sm transition-colors shadow-sm shrink-0"
              >
                Add
              </button>
              <button
                onClick={handleCancelNewForm}
                aria-label="Cancel new patient"
                className="text-muted hover:text-danger shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              type="tel"
              inputMode="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(cleanPhoneInput(e.target.value))}
              onKeyDown={handleNewPatientKeyDown}
              placeholder="Phone (optional)"
              aria-label="New patient phone number (optional)"
              maxLength={20}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 shadow-sm"
            />
          </div>
        )}
      </div>

      {/* Visit list — virtualized */}
      <div className="flex-1 overflow-hidden">
        {dueVisible ? (
          <div id="due-list" className="h-full overflow-y-auto" role="list" aria-label="Patients due for follow-up">
            {dueItems.map((item) => {
              const isActive = item.patientId === activePatientId
              const identity = identityLabel(item.patient)
              return (
                <div key={item.visitId} role="listitem">
                  <button
                    type="button"
                    onClick={() => loadPatientById(item.patientId)}
                    className={`w-full min-h-[56px] flex items-center justify-between gap-2 px-3 py-2 text-left border-l-4 border-b border-b-border/60 transition-colors ${
                      isActive ? 'bg-accent/10 border-l-accent' : 'border-l-transparent hover:bg-card'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className={`block text-base font-semibold truncate ${isActive ? 'text-accent' : 'text-primary'}`}>
                        {item.patient.name}
                      </span>
                      {identity && <span className="block text-xs text-muted tabular-nums">{identity}</span>}
                    </span>
                    <span className={`shrink-0 text-sm font-bold ${item.daysOverdue > 0 ? 'text-danger' : 'text-warning'}`}>
                      {dueLabel(item.daysOverdue)}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        ) : listItemCount === 0 ? (
          <div className="p-6 text-center text-muted text-base">No results</div>
        ) : (
          <AutoSizer>
            {({ height, width }: { height: number; width: number }) => (
              <FixedSizeList
                ref={listRef}
                height={height}
                width={width}
                itemCount={listItemCount}
                itemSize={68}
                itemData={itemData}
                overscanCount={8}
              >
                {VisitRow}
              </FixedSizeList>
            )}
          </AutoSizer>
        )}
      </div>
    </div>
  )
}

// ─── AutoSizer shim ───────────────────────────────────────────────────────────

function AutoSizer({
  children,
}: {
  children: (size: { height: number; width: number }) => React.ReactNode
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ height: 600, width: 300 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ height: el.clientHeight, width: el.clientWidth })
    })
    ro.observe(el)
    setSize({ height: el.clientHeight, width: el.clientWidth })
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {children(size)}
    </div>
  )
}
