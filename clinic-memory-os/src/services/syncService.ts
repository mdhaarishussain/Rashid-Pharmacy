import { db, markRemote, type Patient, type Visit } from '../db/db'
import { applyRemote } from '../sync/applyRemote'
import { patientToWire, visitToWire, type WirePatient, type WireVisit } from '../sync/protocol'

// ─── Configuration ───────────────────────────────────────────────────────────
// The sync key is never built into the JS bundle (anyone could read it there).
// Each device is paired once — either through the "Connect" dialog or by
// opening the app with ?pair=<key> — and keeps the key in its own storage.

const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000/api' : '')

const KEY_STORAGE = 'clinic_sync_key'
const DEVICE_STORAGE = 'clinic_device_id'
const LAST_OK_STORAGE = 'clinic_last_sync_ok'
const cursorStorage = (kind: Kind) => `clinic_sync_v2_cursor_${kind}`

const PUSH_BATCH = 200
const PULL_PAGE = 500
const MAX_BATCHES = 1000            // hard stop for a single sync cycle
const PULL_OVERLAP_MS = 5000        // re-read a few seconds back to tolerate server clock skew
const INTERVAL_MS = 30_000

type Kind = 'patients' | 'visits'
interface Cursor { t: number; uid: string }

export function syncAvailable(): boolean {
  return !!API_BASE_URL
}

export function getSyncKey(): string | null {
  try { return localStorage.getItem(KEY_STORAGE) } catch { return null }
}

export function setSyncKey(key: string | null) {
  if (key) localStorage.setItem(KEY_STORAGE, key.trim())
  else localStorage.removeItem(KEY_STORAGE)
}

export function isSyncConfigured(): boolean {
  return syncAvailable() && !!getSyncKey()
}

/** Store a key passed as ?pair=<key> and remove it from the address bar. */
export function consumePairingLink(): boolean {
  const url = new URL(window.location.href)
  const key = url.searchParams.get('pair')
  if (!key) return false
  setSyncKey(key)
  url.searchParams.delete('pair')
  window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  return true
}

export function getLastSyncOk(): number | null {
  const raw = localStorage.getItem(LAST_OK_STORAGE)
  return raw ? Number(raw) : null
}

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_STORAGE)
  if (!id) {
    id = `device_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
    localStorage.setItem(DEVICE_STORAGE, id)
  }
  return id
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': getSyncKey() ?? '',
      'X-Device-ID': getDeviceId(),
    },
    body: JSON.stringify(body),
  })
  if (res.status === 401 || res.status === 403) {
    throw new Error('Sync key rejected — reconnect this device')
  }
  if (!res.ok) throw new Error(`Server error ${res.status}`)
  return res.json() as Promise<T>
}

// ─── Push (outbox: rows with dirty = 1) ──────────────────────────────────────

async function clearDirty(table: typeof db.patients | typeof db.visits, rows: Array<Patient | Visit>) {
  await db.transaction('rw', table, async (tx) => {
    markRemote(tx)
    for (const row of rows) {
      const current = await table.get(row.id!)
      // Only clear if nothing changed while the request was in flight
      if (current && current.updated_at === row.updated_at) {
        await table.update(row.id!, { dirty: 0 })
      }
    }
  })
}

async function pushPatients(): Promise<number> {
  let pushed = 0
  for (let i = 0; i < MAX_BATCHES; i++) {
    const rows = await db.patients.where('dirty').equals(1).limit(PUSH_BATCH).toArray()
    if (!rows.length) break
    await post('/v2/sync/push', { patients: rows.map(patientToWire) })
    await clearDirty(db.patients, rows)
    pushed += rows.length
    if (rows.length < PUSH_BATCH) break
  }
  return pushed
}

async function pushVisits(): Promise<number> {
  let pushed = 0
  for (let i = 0; i < MAX_BATCHES; i++) {
    const rows = await db.visits.where('dirty').equals(1).limit(PUSH_BATCH).toArray()
    if (!rows.length) break
    const patients = await db.patients.bulkGet([...new Set(rows.map((v) => v.patient_id))])
    const uidById = new Map(patients.filter((p): p is Patient => !!p).map((p) => [p.id!, p.uid!]))
    const sendable = rows.filter((v) => uidById.has(v.patient_id))
    if (sendable.length) {
      await post('/v2/sync/push', { visits: sendable.map((v) => visitToWire(v, uidById.get(v.patient_id)!)) })
    }
    // Visits whose patient row no longer exists can never be uploaded — drop them from the outbox
    await clearDirty(db.visits, rows)
    pushed += sendable.length
    if (rows.length < PUSH_BATCH) break
  }
  return pushed
}

// ─── Pull (server-ordered cursor per table) ──────────────────────────────────

function loadCursor(kind: Kind): Cursor | null {
  try {
    const raw = localStorage.getItem(cursorStorage(kind))
    return raw ? (JSON.parse(raw) as Cursor) : null
  } catch {
    return null
  }
}

async function pull(kind: Kind): Promise<number> {
  const saved = loadCursor(kind)
  let after: Cursor | null = saved ? { t: saved.t - PULL_OVERLAP_MS, uid: '' } : null
  let written = 0
  for (let i = 0; i < MAX_BATCHES; i++) {
    const page = await post<{ records: Array<WirePatient | WireVisit>; next: Cursor | null; hasMore: boolean }>(
      '/v2/sync/pull',
      { kind, after, limit: PULL_PAGE }
    )
    if (page.records.length) {
      const result = kind === 'patients'
        ? await applyRemote(page.records as WirePatient[], [])
        : await applyRemote([], page.records as WireVisit[])
      written += result.patientsWritten + result.visitsWritten
      if (result.orphanedVisits) console.warn(`Sync: ${result.orphanedVisits} visit(s) skipped — patient not found`)
    }
    if (page.next) {
      after = page.next
      localStorage.setItem(cursorStorage(kind), JSON.stringify(page.next))
    }
    if (!page.hasMore) break
  }
  return written
}

// ─── Full cycle ──────────────────────────────────────────────────────────────

export interface SyncCycleResult {
  pushed: number
  pulled: number   // rows written locally — > 0 means the search index needs a rebuild
  at: number
}

let inFlight: Promise<SyncCycleResult> | null = null

/** Push the outbox, then pull remote changes. Concurrent calls share one cycle. */
export function runSyncCycle(): Promise<SyncCycleResult> {
  if (!isSyncConfigured()) return Promise.reject(new Error('Cloud sync not connected'))
  if (inFlight) return inFlight
  inFlight = (async () => {
    // Patients first so the server (and other devices) always know a visit's patient
    const pushed = (await pushPatients()) + (await pushVisits())
    const pulled = (await pull('patients')) + (await pull('visits'))
    const at = Date.now()
    localStorage.setItem(LAST_OK_STORAGE, String(at))
    return { pushed, pulled, at }
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}

/** Run a sync cycle every 30 s while online. Returns a stop function. */
export function startBackgroundSync(
  onResult: (result: SyncCycleResult) => void,
  onError: (error: Error) => void
): () => void {
  const tick = () => {
    if (!navigator.onLine || !isSyncConfigured()) return
    runSyncCycle().then(onResult, (err) => onError(err instanceof Error ? err : new Error(String(err))))
  }
  tick()
  const timer = setInterval(tick, INTERVAL_MS)
  window.addEventListener('online', tick)
  return () => {
    clearInterval(timer)
    window.removeEventListener('online', tick)
  }
}
