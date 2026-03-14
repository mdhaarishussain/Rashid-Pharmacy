import { useReducer, useCallback } from 'react'
import type { Patient, Visit, VisitDraft, MedicineEntry } from '../db/db'
import type { SearchResult } from '../search/searchEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MedicineSlot {
  id: string // stable key for react reconciliation
  medicine: MedicineEntry | null
}

export interface AppState {
  // Patient context
  activePatient: Patient | null
  patientVisits: Visit[]
  lastVisit: Visit | null

  // Current visit draft
  draft: VisitDraft | null

  // Medicine slots
  slots: MedicineSlot[]
  activeSlotIndex: number

  // Search
  searchQuery: string
  searchResults: SearchResult[]

  // UI feedback
  savedAt: number | null // timestamp of last successful save, null = not saved yet
}

export type AppAction =
  | { type: 'LOAD_PATIENT'; patient: Patient; visits: Visit[] }
  | { type: 'CLEAR_PATIENT' }
  | { type: 'NEW_PATIENT'; patient: Patient }
  | { type: 'INIT_DRAFT'; visitNumber: number }
  | { type: 'REPEAT_AND_MODIFY' }
  | { type: 'SET_SLOT_MEDICINE'; slotIndex: number; medicine: MedicineEntry }
  | { type: 'UPDATE_SLOT_MEDICINE'; slotIndex: number; patch: Partial<MedicineEntry> }
  | { type: 'CLEAR_SLOT'; slotIndex: number }
  | { type: 'ADD_SLOT' }
  | { type: 'REMOVE_SLOT'; slotIndex: number }
  | { type: 'SET_ACTIVE_SLOT'; index: number }
  | { type: 'SET_SYMPTOMS'; text: string }
  | { type: 'UPDATE_PAYMENT'; field: 'fee_total' | 'amount_paid'; value: number }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'SET_SEARCH_RESULTS'; results: SearchResult[] }
  | { type: 'MARK_SAVED'; visitId: number }
  | { type: 'RESTORE_DRAFT'; draft: VisitDraft; patient: Patient }

// ─── Initial state ────────────────────────────────────────────────────────────

function makeDefaultSlots(): MedicineSlot[] {
  return [
    { id: 's1', medicine: null },
    { id: 's2', medicine: null },
    { id: 's3', medicine: null },
  ]
}

export const INITIAL_STATE: AppState = {
  activePatient: null,
  patientVisits: [],
  lastVisit: null,
  draft: null,
  slots: makeDefaultSlots(),
  activeSlotIndex: 0,
  searchQuery: '',
  searchResults: [],
  savedAt: null,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let slotCounter = 4

function slotId(): string {
  return `s${slotCounter++}`
}

function slotsFromMedicines(meds: MedicineEntry[]): MedicineSlot[] {
  const slots: MedicineSlot[] = meds.map((m) => ({ id: slotId(), medicine: m }))
  // Ensure at least 3 slots
  while (slots.length < 3) slots.push({ id: slotId(), medicine: null })
  return slots
}

function rebuildDraftMedicines(slots: MedicineSlot[]): MedicineEntry[] {
  return slots.filter((s) => s.medicine !== null).map((s) => s.medicine!)
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'LOAD_PATIENT': {
      const lastVisit = action.visits.length > 0 ? action.visits[0] : null
      return {
        ...state,
        activePatient: action.patient,
        patientVisits: action.visits,
        lastVisit,
        draft: null,
        slots: makeDefaultSlots(),
        activeSlotIndex: 0,
        savedAt: null,
      }
    }

    case 'CLEAR_PATIENT': {
      return {
        ...state,
        activePatient: null,
        patientVisits: [],
        lastVisit: null,
        draft: null,
        slots: makeDefaultSlots(),
        activeSlotIndex: 0,
        savedAt: null,
      }
    }

    case 'NEW_PATIENT': {
      return {
        ...state,
        activePatient: action.patient,
        patientVisits: [],
        lastVisit: null,
        draft: null,
        slots: makeDefaultSlots(),
        activeSlotIndex: 0,
        savedAt: null,
      }
    }

    case 'INIT_DRAFT': {
      if (!state.activePatient) return state
      const draft: VisitDraft = {
        patient_id: state.activePatient.id!,
        visit_id: undefined,
        medicines_json: rebuildDraftMedicines(state.slots),
        symptoms_text: '',
        fee_total: 0,
        amount_paid: 0,
        amount_due: 0,
        visit_number: action.visitNumber,
        dirty: true,
      }
      return { ...state, draft }
    }

    case 'REPEAT_AND_MODIFY': {
      if (!state.activePatient || !state.lastVisit) return state
      const slots = slotsFromMedicines(state.lastVisit.medicines_json)
      const draft: VisitDraft = {
        patient_id: state.activePatient.id!,
        visit_id: undefined,
        medicines_json: state.lastVisit.medicines_json,
        symptoms_text: '',
        fee_total: 0,
        amount_paid: 0,
        amount_due: 0,
        visit_number: state.patientVisits.length + 1,
        dirty: true,
      }
      return {
        ...state,
        slots,
        activeSlotIndex: 0,
        draft,
        savedAt: null,
      }
    }

    case 'SET_SLOT_MEDICINE': {
      const slots = state.slots.map((s, i) => {
        if (i !== action.slotIndex) return s
        // Preserve dosage fields when the medicine name is unchanged (user just changed potency)
        const existing = s.medicine
        const medicine: MedicineEntry =
          existing?.name === action.medicine.name
            ? { freq: existing.freq, food: existing.food, days: existing.days, qty: existing.qty, ...action.medicine, type: action.medicine.type ?? existing?.type }
            : action.medicine
        return { ...s, medicine }
      })
      const draft = state.draft
        ? { ...state.draft, medicines_json: rebuildDraftMedicines(slots), dirty: true }
        : null
      // Auto-advance to next empty slot
      let nextActive = state.activeSlotIndex
      const nextEmpty = slots.findIndex((s, i) => i > action.slotIndex && !s.medicine)
      if (nextEmpty >= 0) nextActive = nextEmpty
      return { ...state, slots, draft, activeSlotIndex: nextActive }
    }

    case 'UPDATE_SLOT_MEDICINE': {
      const slots = state.slots.map((s, i) =>
        i === action.slotIndex && s.medicine
          ? { ...s, medicine: { ...s.medicine, ...action.patch } }
          : s
      )
      const draft = state.draft
        ? { ...state.draft, medicines_json: rebuildDraftMedicines(slots), dirty: true }
        : null
      return { ...state, slots, draft }
    }

    case 'CLEAR_SLOT': {
      const slots = state.slots.map((s, i) =>
        i === action.slotIndex ? { ...s, medicine: null } : s
      )
      const draft = state.draft
        ? { ...state.draft, medicines_json: rebuildDraftMedicines(slots), dirty: true }
        : null
      return { ...state, slots, draft }
    }

    case 'ADD_SLOT': {
      if (state.slots.length >= 8) return state
      const slots = [...state.slots, { id: slotId(), medicine: null }]
      return { ...state, slots, activeSlotIndex: slots.length - 1 }
    }

    case 'REMOVE_SLOT': {
      if (state.slots.length <= 1) return state
      const slots = state.slots.filter((_, i) => i !== action.slotIndex)
      const activeSlotIndex = Math.min(state.activeSlotIndex, slots.length - 1)
      const draft = state.draft
        ? { ...state.draft, medicines_json: rebuildDraftMedicines(slots), dirty: true }
        : null
      return { ...state, slots, activeSlotIndex, draft }
    }

    case 'SET_ACTIVE_SLOT': {
      return { ...state, activeSlotIndex: action.index }
    }

    case 'SET_SYMPTOMS': {
      const draft = state.draft
        ? { ...state.draft, symptoms_text: action.text, dirty: true }
        : null
      return { ...state, draft }
    }

    case 'UPDATE_PAYMENT': {
      if (!state.draft) return state
      const updated = { ...state.draft, [action.field]: action.value, dirty: true }
      updated.amount_due = updated.fee_total - updated.amount_paid
      return { ...state, draft: updated }
    }

    case 'SET_SEARCH_QUERY': {
      return { ...state, searchQuery: action.query }
    }

    case 'SET_SEARCH_RESULTS': {
      return { ...state, searchResults: action.results }
    }

    case 'MARK_SAVED': {
      const draft = state.draft
        ? { ...state.draft, visit_id: action.visitId, dirty: false }
        : null
      return { ...state, draft, savedAt: Date.now() }
    }

    case 'RESTORE_DRAFT': {
      const slots = slotsFromMedicines(action.draft.medicines_json)
      return {
        ...state,
        activePatient: action.patient,
        draft: action.draft,
        slots,
        activeSlotIndex: 0,
        savedAt: null,
      }
    }

    default:
      return state
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppState() {
  const [state, dispatch] = useReducer(appReducer, INITIAL_STATE)

  const loadPatient = useCallback(
    (patient: Patient, visits: Visit[]) => dispatch({ type: 'LOAD_PATIENT', patient, visits }),
    []
  )

  return { state, dispatch, loadPatient }
}
