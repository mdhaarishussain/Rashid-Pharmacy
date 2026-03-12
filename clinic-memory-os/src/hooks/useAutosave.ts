import { useEffect, useRef } from 'react'
import { upsertVisit } from '../db/db'
import { addToIndex } from '../search/searchEngine'
import type { VisitDraft } from '../db/db'
import type { AppAction } from '../state/useAppState'

const DRAFT_KEY = 'clinic_os_draft'

// ─── Persist draft to localStorage for crash recovery ─────────────────────────

export function saveDraftToStorage(draft: VisitDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Ignore storage errors — non-critical
  }
}

export function loadDraftFromStorage(): VisitDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    return raw ? (JSON.parse(raw) as VisitDraft) : null
  } catch {
    return null
  }
}

export function clearDraftFromStorage() {
  localStorage.removeItem(DRAFT_KEY)
}

// ─── useAutosave hook ─────────────────────────────────────────────────────────

interface UseAutosaveOptions {
  draft: VisitDraft | null
  patientName: string
  dispatch: React.Dispatch<AppAction>
}

export function useAutosave({ draft, patientName, dispatch }: UseAutosaveOptions) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedMedicinesRef = useRef<string>('')

  useEffect(() => {
    if (!draft || !draft.dirty) return

    // Mirror to localStorage immediately for crash recovery
    saveDraftToStorage(draft)

    // Debounce IndexedDB write
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const visitId = await upsertVisit({
          id: draft.visit_id,
          patient_id: draft.patient_id,
          date: Date.now(),
          symptoms_text: draft.symptoms_text,
          medicines_json: draft.medicines_json,
          fee_total: draft.fee_total,
          amount_paid: draft.amount_paid,
          amount_due: draft.amount_due,
          visit_number: draft.visit_number,
        })

        dispatch({ type: 'MARK_SAVED', visitId })

        // Update search index incrementally
        const medStr = JSON.stringify(draft.medicines_json)
        if (medStr !== lastSavedMedicinesRef.current) {
          lastSavedMedicinesRef.current = medStr
          addToIndex(
            {
              id: visitId,
              patient_id: draft.patient_id,
              date: Date.now(),
              symptoms_text: draft.symptoms_text,
              medicines_json: draft.medicines_json,
              fee_total: draft.fee_total,
              amount_paid: draft.amount_paid,
              amount_due: draft.amount_due,
              visit_number: draft.visit_number,
            },
            patientName
          )
        }

        // Clear localStorage once safely persisted to IndexedDB
        clearDraftFromStorage()
      } catch (err) {
        console.error('Autosave failed:', err)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [draft, patientName, dispatch])
}
