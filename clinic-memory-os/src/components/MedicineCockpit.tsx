import React, { useCallback, useEffect, useRef, useState } from 'react'
import { VariableSizeList, type ListChildComponentProps } from 'react-window'
import type { MedicineSlot, AppAction } from '../state/useAppState'
import type { Visit, MedicineEntry } from '../db/db'
import { SHELF_ROWS, type ShelfRow, getShortCode, isDropPotency, getMedicinePotencies } from '../data/medicines'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  slots: MedicineSlot[]
  activeSlotIndex: number
  lastVisit: Visit | null
  activePatient: { id?: number; name: string } | null
  draft: { visit_number: number } | null
  dispatch: React.Dispatch<AppAction>
}

// ─── Dosage chip constants ────────────────────────────────────────────────────

const FREQ_CHIPS = ['OD', 'BD', 'TD', 'QD', 'HS'] as const
const FOOD_CHIPS = ['AC', 'PC'] as const
const DAYS_CHIPS = [3, 5, 7, 10] as const
const PILL_CHIPS = [1, 2, 3, 6] as const
const DROP_CHIPS = [5, 10, 15, 20] as const

// Common prescription presets — 1 tap fills freq + food + days
const PRESETS: Array<{ label: string; patch: Partial<MedicineEntry> }> = [
  { label: 'BD · AC · 5d', patch: { freq: 'BD', food: 'AC', days: 5 } },
  { label: 'TD · AC · 3d', patch: { freq: 'TD', food: 'AC', days: 3 } },
  { label: 'HS · 10d',     patch: { freq: 'HS', food: undefined, days: 10 } },
  { label: 'BD · PC · 7d', patch: { freq: 'BD', food: 'PC', days: 7 } },
]

function chipCls(active: boolean): string {
  return (
    'text-xs px-1.5 py-0.5 rounded-md font-semibold border transition-colors shrink-0 ' +
    (active
      ? 'bg-accent text-panel border-accent'
      : 'bg-surface text-muted border-border hover:border-accent hover:text-accent')
  )
}

// ─── MedicineSlots ────────────────────────────────────────────────────────────

function MedicineSlots({
  slots,
  activeSlotIndex,
  lastVisit,
  activePatient,
  draft,
  dispatch,
}: Props) {
  const handleRepeatAndModify = useCallback(() => {
    dispatch({ type: 'REPEAT_AND_MODIFY' })
  }, [dispatch])

  const handleInitDraft = useCallback(() => {
    if (!activePatient) return
    dispatch({ type: 'INIT_DRAFT', visitNumber: draft ? draft.visit_number : 1 })
  }, [activePatient, dispatch, draft])

  return (
    <div className="overflow-y-auto px-4 pt-4 pb-3 border-b border-border bg-panel max-h-[50vh]">
      {/* Patient header */}
      {activePatient ? (
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <span className="text-primary font-bold text-xl">{activePatient.name}</span>
            {draft && (
              <span className="ml-2 text-sm text-muted font-medium">Visit #{draft.visit_number}</span>
            )}
          </div>
          {!draft && (
            <button
              onClick={handleInitDraft}
              className="text-sm bg-accent hover:bg-accent-hover text-panel px-3 py-2 rounded-lg font-semibold transition-colors shadow-sm"
            >
              New Visit
            </button>
          )}
        </div>
      ) : (
        <div className="text-muted text-base mb-3">← Select a patient</div>
      )}

      {/* Last visit summary + Repeat & Modify */}
      {lastVisit && (
        <div className="mb-3 bg-card rounded-xl p-3 border border-border shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-primary">Last Visit</span>
            <span className="text-xs text-muted">
              {new Date(lastVisit.date).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {lastVisit.medicines_json.map((m, i) => (
              <span
                key={i}
                className="text-sm bg-panel border border-border px-2.5 py-1 rounded-lg text-primary font-medium shadow-sm inline-block"
              >
                {m.name.split(' ')[0]}{' '}
                <span className={`font-semibold ${isDropPotency(m.potency) ? 'text-sky-400' : 'text-accent'}`}>
                  {isDropPotency(m.potency) ? '💧' : ''}{m.potency}
                </span>
                {(m.freq || m.food || m.days || m.qty) && (
                  <span className="block text-xs text-muted font-mono mt-0.5">
                    {[
                      m.freq,
                      m.food,
                      m.days && `${m.days}d`,
                      m.qty && `${m.qty}${isDropPotency(m.potency) ? '💧' : 'p'}`,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  </span>
                )}
              </span>
            ))}
          </div>
          <button
            onClick={handleRepeatAndModify}
            className="w-full bg-accent hover:bg-accent-hover text-panel font-bold text-base py-3 rounded-lg transition-colors shadow-md"
          >
            Repeat &amp; Modify
          </button>
        </div>
      )}

      {/* Active medicine slots */}
      {activePatient && (
        <div className="space-y-1.5">
          {slots.map((slot, i) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              index={i}
              isActive={i === activeSlotIndex}
              dispatch={dispatch}
            />
          ))}
          {slots.length < 8 && (
            <button
              onClick={() => dispatch({ type: 'ADD_SLOT' })}
              className="w-full text-sm text-muted hover:text-accent border border-dashed border-border hover:border-accent rounded-lg py-3 transition-colors"
            >
              + Add slot
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── SlotRow ──────────────────────────────────────────────────────────────────

function SlotRow({
  slot,
  index,
  isActive,
  dispatch,
}: {
  slot: MedicineSlot
  index: number
  isActive: boolean
  dispatch: React.Dispatch<AppAction>
}) {
  const med = slot.medicine
  const isTincture = med ? isDropPotency(med.potency) : false
  const isBiochemic = med ? (med.potency === '6x' || med.potency === '12x') : false
  const qtyCh = isTincture ? DROP_CHIPS : PILL_CHIPS

  // editMode switches between quick (presets+qty) and custom (individual chips)
  const [editMode, setEditMode] = useState<'quick' | 'custom'>('quick')

  // Compact: collapse dosage area once freq + qty are both chosen
  const isCompact = !!med && !!med.freq && !!med.qty && editMode === 'quick'

  // Build compact summary string
  const dosageSummary = med
    ? [
        med.freq,
        med.food,
        med.days && `${med.days}d`,
        med.qty && `${med.qty}${isTincture ? '💧' : 'p'}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  // Potency badge colour
  const potencyCls = isTincture
    ? 'bg-sky-500/10 border border-sky-400/30 text-sky-400'
    : isBiochemic
    ? 'bg-emerald-500/10 border border-emerald-400/30 text-emerald-400'
    : 'bg-accent/10 border border-accent/30 text-accent'

  const presetIsActive = (p: (typeof PRESETS)[number]) =>
    med?.freq === p.patch.freq &&
    med?.food === (p.patch.food ?? undefined) &&
    med?.days === p.patch.days

  return (
    <div
      className={`rounded-xl cursor-pointer transition-all ${
        isActive
          ? 'border-2 border-accent bg-accent/10 shadow-xl shadow-accent/20 ring-4 ring-accent/30 ring-offset-1'
          : 'border border-border bg-panel hover:border-accent/50 hover:bg-card shadow-sm'
      }`}
      onClick={() => dispatch({ type: 'SET_ACTIVE_SLOT', index })}
    >
      {/* ── Row 1: medicine info bar ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 min-w-0">
        {/* Badge */}
        <span
          className={`flex items-center justify-center rounded-full font-black shrink-0 transition-all ${
            isActive
              ? 'w-8 h-8 text-base bg-accent text-white shadow-md shadow-accent/40'
              : 'w-6 h-6 text-sm text-muted bg-card border border-border'
          }`}
        >
          {index + 1}
        </span>

        {med ? (
          <>
            {/* Shortcode */}
            <span className="text-xs font-black text-accent bg-accent/10 border border-accent/25 px-1.5 py-0.5 rounded font-mono shrink-0">
              {getShortCode({ name: med.name, abbr: '' })}
            </span>
            {/* Name */}
            <span className="text-base text-primary font-semibold truncate min-w-0">
              {med.name}
            </span>
            {/* Potency */}
            <span className={`text-sm px-2 py-0.5 rounded-md font-bold shrink-0 ${potencyCls}`}>
              {isTincture ? '💧' : ''}{med.potency}
            </span>
            {/* Compact dosage pill — tap to edit */}
            {isCompact && (
              <button
                onClick={(e) => { e.stopPropagation(); setEditMode('custom') }}
                className="flex items-center gap-1.5 text-xs bg-accent/5 border border-accent/20 rounded-lg px-2 py-1 text-accent hover:bg-accent/10 transition-colors shrink-0 font-mono font-semibold"
                title="Edit dosage"
              >
                {dosageSummary}
                <svg className="w-2.5 h-2.5 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}
          </>
        ) : (
          <span className={`flex-1 text-base ${isActive ? 'text-accent font-medium' : 'text-muted'} italic`}>
            {isActive ? 'Select from shelf ↓' : 'Empty'}
          </span>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {med && (
            <button
              onClick={(e) => { e.stopPropagation(); dispatch({ type: 'CLEAR_SLOT', slotIndex: index }) }}
              className="text-muted hover:text-danger transition-colors p-0.5"
              title="Clear medicine"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); dispatch({ type: 'REMOVE_SLOT', slotIndex: index }) }}
            className="text-border hover:text-danger transition-colors p-0.5"
            title="Remove slot"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Row 2: dosage area (hidden when compact) ── */}
      {med && !isCompact && (
        <div
          className="border-t border-border/50 px-3 py-2.5 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          {editMode === 'quick' ? (
            <>
              {/* Preset chips — one tap fills freq + food + days */}
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() =>
                      dispatch({ type: 'UPDATE_SLOT_MEDICINE', slotIndex: index, patch: p.patch })
                    }
                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-colors ${
                      presetIsActive(p)
                        ? 'bg-accent/15 border-accent text-accent'
                        : 'bg-card border-border text-muted hover:border-accent hover:text-accent'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
                <button
                  onClick={() => setEditMode('custom')}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-dashed border-border text-muted hover:border-accent hover:text-accent transition-colors"
                >
                  Custom…
                </button>
              </div>

              {/* Qty row */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-semibold text-muted w-8 shrink-0">
                  {isTincture ? '💧' : 'Qty'}
                </span>
                {qtyCh.map((n) => (
                  <button
                    key={n}
                    onClick={() =>
                      dispatch({ type: 'UPDATE_SLOT_MEDICINE', slotIndex: index, patch: { qty: med.qty === n ? undefined : n } })
                    }
                    className={chipCls(med.qty === n)}
                  >
                    {isTincture ? '💧' : ''}{n}{isTincture ? '' : 'p'}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Freq + food row */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs font-semibold text-muted w-8 shrink-0">Freq</span>
                {FREQ_CHIPS.map((f) => (
                  <button
                    key={f}
                    onClick={() =>
                      dispatch({ type: 'UPDATE_SLOT_MEDICINE', slotIndex: index, patch: { freq: med.freq === f ? undefined : f } })
                    }
                    className={chipCls(med.freq === f)}
                  >
                    {f}
                  </button>
                ))}
                <span className="text-border mx-0.5 shrink-0 text-xs">·</span>
                {FOOD_CHIPS.map((f) => (
                  <button
                    key={f}
                    onClick={() =>
                      dispatch({ type: 'UPDATE_SLOT_MEDICINE', slotIndex: index, patch: { food: med.food === f ? undefined : f } })
                    }
                    className={chipCls(med.food === f)}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {/* Days + qty row */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs font-semibold text-muted w-8 shrink-0">Days</span>
                {DAYS_CHIPS.map((d) => (
                  <button
                    key={d}
                    onClick={() =>
                      dispatch({ type: 'UPDATE_SLOT_MEDICINE', slotIndex: index, patch: { days: med.days === d ? undefined : d } })
                    }
                    className={chipCls(med.days === d)}
                  >
                    {d}d
                  </button>
                ))}
                <span className="text-border mx-0.5 shrink-0 text-xs">·</span>
                <span className="text-xs font-semibold text-muted shrink-0">
                  {isTincture ? '💧' : 'Qty'}
                </span>
                {qtyCh.map((n) => (
                  <button
                    key={n}
                    onClick={() =>
                      dispatch({ type: 'UPDATE_SLOT_MEDICINE', slotIndex: index, patch: { qty: med.qty === n ? undefined : n } })
                    }
                    className={chipCls(med.qty === n)}
                  >
                    {isTincture ? '💧' : ''}{n}{isTincture ? '' : 'p'}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setEditMode('quick')}
                className="text-xs text-muted hover:text-accent transition-colors"
              >
                ← Back to presets
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── MedicineShelf ────────────────────────────────────────────────────────────

const ROW_HEIGHTS: Record<string, number> = {
  header: 40,
  medicine: 82,
}

function getRowHeight(row: ShelfRow): number {
  return ROW_HEIGHTS[row.type]
}

interface ShelfRowData {
  rows: ShelfRow[]
  activeSlotIndex: number
  dispatch: React.Dispatch<AppAction>
  shelfQuery: string
}

function ShelfRowRenderer({
  index,
  style,
  data,
}: ListChildComponentProps<ShelfRowData>) {
  const { rows, activeSlotIndex, dispatch, shelfQuery } = data
  const row = rows[index]

  if (row.type === 'header') {
    return (
      <div
        style={style}
        className="flex items-center px-4 bg-card z-10 border-b border-border"
      >
        <span className="text-sm font-extrabold text-primary uppercase tracking-wider">{row.letter}</span>
      </div>
    )
  }

  const med = row.medicine
  const shortCode = getShortCode(med)
  const nameDisplay = shelfQuery ? highlightMatch(med.name, shelfQuery) : med.name

  return (
    <div
      style={style}
      className="flex items-center gap-3 px-3 hover:bg-card border-b border-border/60 transition-colors"
    >
      {/* 2-letter short code badge */}
      <div className="w-9 h-9 rounded-lg bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
        <span className="text-xs font-black text-accent tracking-tight">{shortCode}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm text-primary font-medium truncate leading-snug">{nameDisplay}</div>
        <div className="text-xs text-muted">{med.abbr}</div>
      </div>

      {/* Potency buttons — type-appropriate set for this medicine */}
      <div className="flex gap-1 shrink-0">
        {getMedicinePotencies(med).map((p) => {
          const isTinc = isDropPotency(p)
          return (
            <button
              key={p}
              onClick={() =>
                dispatch({
                  type: 'SET_SLOT_MEDICINE',
                  slotIndex: activeSlotIndex,
                  medicine: { name: med.name, potency: p },
                })
              }
              className={
                isTinc
                  ? 'text-sm bg-panel hover:bg-sky-500 hover:text-white border-2 border-sky-300/40 hover:border-sky-500 active:scale-95 px-1.5 py-2 rounded-lg transition-all font-mono font-bold min-w-[46px] text-center shadow-sm text-sky-400'
                  : 'text-sm bg-panel hover:bg-accent hover:text-panel border-2 border-border hover:border-accent active:scale-95 px-1.5 py-2 rounded-lg transition-all font-mono font-bold min-w-[38px] text-center shadow-sm text-primary'
              }
            >
              {isTinc ? '💧' : ''}{p}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function highlightMatch(text: string, query: string): React.ReactNode {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx < 0) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent/30 text-accent rounded">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

// ─── MedicineCockpit (combined) ───────────────────────────────────────────────

export default function MedicineCockpit(props: Props) {
  const listRef = useRef<VariableSizeList>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerHeight, setContainerHeight] = useState(400)
  const [shelfQuery, setShelfQuery] = useState('')
  const shelfDebounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [visibleRows, setVisibleRows] = useState<ShelfRow[]>(SHELF_ROWS)

  const handleShelfSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setShelfQuery(val)
    if (shelfDebounce.current) clearTimeout(shelfDebounce.current)
    shelfDebounce.current = setTimeout(() => {
      if (!val.trim()) {
        setVisibleRows(SHELF_ROWS)
        return
      }
      const q = val.toLowerCase()
      const filtered: ShelfRow[] = []
      let lastHeader: ShelfRow | null = null
      for (const row of SHELF_ROWS) {
        if (row.type === 'header') {
          lastHeader = row
        } else if (
          row.medicine.name.toLowerCase().includes(q) ||
          row.medicine.abbr.toLowerCase().includes(q) ||
          getShortCode(row.medicine).toLowerCase().startsWith(q)
        ) {
          if (lastHeader && (filtered.length === 0 || filtered[filtered.length - 1] !== lastHeader)) {
            filtered.push(lastHeader)
          }
          filtered.push(row)
        }
      }
      setVisibleRows(filtered)
      listRef.current?.resetAfterIndex(0)
    }, 100)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setContainerHeight(el.clientHeight))
    ro.observe(el)
    setContainerHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    listRef.current?.resetAfterIndex(0)
  }, [visibleRows])

  const itemData: ShelfRowData = {
    rows: visibleRows,
    activeSlotIndex: props.activeSlotIndex,
    dispatch: props.dispatch,
    shelfQuery,
  }

  return (
    <div id="tutorial-cockpit" className="flex flex-col h-full flex-1 bg-surface lg:border-r border-border">
      {/* Slots area */}
      <MedicineSlots {...props} />

      {/* Shelf search */}
      <div className="px-4 py-3 border-b border-border shrink-0 bg-panel">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-primary shrink-0">Shelf</span>
          <div className="relative flex-1">
            <input
              type="text"
              value={shelfQuery}
              onChange={handleShelfSearch}
              placeholder="Filter medicines…"
              className="w-full bg-surface border border-border rounded-lg px-3 py-3 text-base text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-colors shadow-sm"
            />
            {shelfQuery && (
              <button
                onClick={() => {
                  setShelfQuery('')
                  setVisibleRows(SHELF_ROWS)
                  listRef.current?.resetAfterIndex(0)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-primary"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Medicine shelf — virtualized */}
      <div ref={containerRef} className="flex-1 overflow-hidden">
        <VariableSizeList
          ref={listRef}
          height={containerHeight}
          width="100%"
          itemCount={visibleRows.length}
          itemSize={(i) => getRowHeight(visibleRows[i])}
          itemData={itemData}
          overscanCount={10}
        >
          {ShelfRowRenderer}
        </VariableSizeList>
      </div>
    </div>
  )
}
