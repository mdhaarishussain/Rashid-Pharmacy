import Fuse from 'fuse.js'
import type { Visit, Patient } from '../db/db'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchRecord {
  visitId: number
  patientId: number
  patientName: string
  date: number
  medicineNames: string[]   // lowercase
  symptomTokens: string[]   // lowercase words
  visitNumber: number
}

export interface SearchResult {
  visitId: number
  patientId: number
  patientName: string
  date: number
  medicineSummary: string
  visitNumber: number
  score: number
}

// ─── Engine state (module-level singleton) ────────────────────────────────────

let index: SearchRecord[] = []
let fuseInstance: Fuse<SearchRecord> | null = null

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,./;:()-]+/)
    .filter((t) => t.length > 1)
}

export function buildFuse(records: SearchRecord[]) {
  // Fuse mutates the array it is given on add/remove — hand it its own copy
  fuseInstance = new Fuse([...records], {
    keys: ['patientName', 'medicineNames', 'symptomTokens'],
    includeScore: true,
    threshold: 0.45,
    ignoreLocation: true,
    useExtendedSearch: false,
  })
}

// ─── Build / rebuild ──────────────────────────────────────────────────────────

export function buildIndex(visits: Visit[], patients: Patient[]) {
  const patientMap = new Map<number, string>()
  patients.forEach((p) => {
    if (!p.deleted_at) patientMap.set(p.id!, p.name)
  })

  index = visits
    .filter((v) => !v.deleted_at && patientMap.has(v.patient_id))
    .map((v) => toRecord(v, patientMap.get(v.patient_id)!))

  // sort descending by date so recency rank is preserved
  index.sort((a, b) => b.date - a.date)
  buildFuse(index)
}

function toRecord(visit: Visit, patientName: string): SearchRecord {
  return {
    visitId: visit.id!,
    patientId: visit.patient_id,
    patientName,
    date: visit.date,
    medicineNames: visit.medicines_json.map((m) => m.name.toLowerCase()),
    symptomTokens: tokenise(visit.symptoms_text),
    visitNumber: visit.visit_number,
  }
}

export function removePatientFromIndex(patientId: number) {
  index = index.filter((r) => r.patientId !== patientId)
  fuseInstance?.remove((r) => r.patientId === patientId)
}

// Incremental update — autosave calls this every few hundred ms, so avoid
// re-tokenising the whole index (noticeable once there are tens of thousands of visits).
export function addToIndex(visit: Visit, patientName: string) {
  const record = toRecord(visit, patientName)
  const existingIdx = index.findIndex((r) => r.visitId === visit.id)
  if (existingIdx >= 0) index.splice(existingIdx, 1)
  // keep the array sorted newest-first
  let lo = 0
  let hi = index.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (index[mid].date > record.date) lo = mid + 1
    else hi = mid
  }
  index.splice(lo, 0, record)

  if (!fuseInstance) {
    buildFuse(index)
    return
  }
  fuseInstance.remove((r) => r.visitId === record.visitId)
  fuseInstance.add(record)
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

function recencyScore(date: number): number {
  const ageDays = (Date.now() - date) / (24 * 3600 * 1000)
  return Math.max(0, 1 - ageDays / 365)
}

function medicineSummary(record: SearchRecord): string {
  return record.medicineNames
    .slice(0, 3)
    .map((n) => {
      const parts = n.split(' ')
      return parts.length === 1 ? parts[0] : parts[parts.length - 1] === 'album' ||
        parts[parts.length - 1] === 'officinalis' ||
        parts[parts.length - 1] === 'nigricans'
        ? parts[0]
        : parts[0]
    })
    .join(' + ')
}

// ─── Search ───────────────────────────────────────────────────────────────────

export function search(query: string, limit = 50): SearchResult[] {
  if (!query.trim()) {
    // Return most recent unique patient visits (one per patient)
    const seen = new Set<number>()
    const results: SearchResult[] = []
    for (const record of index) {
      if (!seen.has(record.patientId)) {
        seen.add(record.patientId)
        results.push({
          visitId: record.visitId,
          patientId: record.patientId,
          patientName: record.patientName,
          date: record.date,
          medicineSummary: medicineSummary(record),
          visitNumber: record.visitNumber,
          score: recencyScore(record.date),
        })
      }
      if (results.length >= limit) break
    }
    return results
  }

  if (!fuseInstance) return []

  const queryLower = query.toLowerCase()
  const fuseResults = fuseInstance.search(queryLower, { limit: limit * 2 })

  const scored = fuseResults.map(({ item, score: fuseScore }) => {
    let score = 1 - (fuseScore ?? 1) // fuse score is 0=perfect, invert

    // Recency boost
    score += recencyScore(item.date) * 0.4

    // Exact name match boost
    if (item.patientName.toLowerCase().includes(queryLower)) score += 0.5

    // Medicine match boost
    if (item.medicineNames.some((m) => m.includes(queryLower))) score += 0.3

    // Symptom match boost
    if (item.symptomTokens.some((t) => t.startsWith(queryLower))) score += 0.2

    return {
      visitId: item.visitId,
      patientId: item.patientId,
      patientName: item.patientName,
      date: item.date,
      medicineSummary: medicineSummary(item),
      visitNumber: item.visitNumber,
      score,
    }
  })

  return scored.sort((a, b) => b.score - a.score).slice(0, limit)
}
