import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { applyRemote } from './applyRemote'
import { remoteWins, type WirePatient, type WireVisit } from './protocol'
import { runSyncCycle, setSyncKey } from '../services/syncService'
// The fake server uses the backend's real merge rules
import { cursorFilter, pickWinners } from '../../backend/src/sync/merge'

const wp = (uid: string, updated_at: number, extra: Partial<WirePatient> = {}): WirePatient => ({
  uid, name: uid, quick_note: '', created_at: 1, updated_at, deleted_at: null, ...extra,
})
const wv = (uid: string, patient_uid: string, updated_at: number, extra: Partial<WireVisit> = {}): WireVisit => ({
  uid, patient_uid, date: 1, symptoms_text: '', medicines_json: [], fee_total: 300, amount_paid: 300,
  amount_due: 0, visit_number: 1, updated_at, deleted_at: null, ...extra,
})

async function resetDevice() {
  await db.patients.clear()
  await db.visits.clear()
  localStorage.clear()
}

beforeEach(resetDevice)

describe('remoteWins', () => {
  it('only replaces strictly older local copies', () => {
    expect(remoteWins(undefined, { updated_at: 1 })).toBe(true)
    expect(remoteWins({ updated_at: 1 }, { updated_at: 2 })).toBe(true)
    expect(remoteWins({ updated_at: 2 }, { updated_at: 2 })).toBe(false)
    expect(remoteWins({ updated_at: 3 }, { updated_at: 2 })).toBe(false)
  })
})

describe('applyRemote', () => {
  it('links visits to local patient ids and keeps rows clean (not dirty)', async () => {
    const r = await applyRemote([wp('p1', 10)], [wv('v1', 'p1', 10), wv('v2', 'missing', 10)])
    expect(r).toEqual({ patientsWritten: 1, visitsWritten: 1, orphanedVisits: 1 })
    const p = (await db.patients.where('uid').equals('p1').first())!
    const v = (await db.visits.where('uid').equals('v1').first())!
    expect(v.patient_id).toBe(p.id)
    expect(p.dirty).toBe(0)
    expect(v.dirty).toBe(0)
  })

  it('keeps newer local edits and reuses the local id when remote wins', async () => {
    await applyRemote([wp('p1', 10, { name: 'Old' })], [])
    const id = (await db.patients.where('uid').equals('p1').first())!.id
    await applyRemote([wp('p1', 20, { name: 'New' })], [])
    await applyRemote([wp('p1', 15, { name: 'Stale' })], [])
    const all = await db.patients.toArray()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ id, name: 'New', updated_at: 20 })
  })

  it('applies tombstones', async () => {
    await applyRemote([wp('p1', 10)], [])
    await applyRemote([wp('p1', 11, { deleted_at: 11 })], [])
    expect((await db.patients.where('uid').equals('p1').first())!.deleted_at).toBe(11)
  })

  it('queues restored rows for upload when markDirty is set', async () => {
    await applyRemote([wp('p1', 10)], [], { markDirty: true })
    expect((await db.patients.where('uid').equals('p1').first())!.dirty).toBe(1)
  })
})

// ─── In-memory server implementing /v2/sync ──────────────────────────────────

function fakeServer() {
  const tables: Record<string, Array<Record<string, any>>> = { patients: [], visits: [] }
  let clock = 1000
  const requests: Array<{ path: string; body: any }> = []

  const matches = (doc: Record<string, any>, after: any) => {
    const f = cursorFilter(after) as any
    if (!f.$or) return true
    return doc.synced_at > after.t || (doc.synced_at === after.t && doc.uid > after.uid)
  }

  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    const path = url.replace(/^.*\/api/, '')
    const body = JSON.parse(String(init.body))
    requests.push({ path, body })
    if (path === '/v2/sync/push') {
      for (const kind of ['patients', 'visits']) {
        const incoming = body[kind] ?? []
        const stored = new Map(tables[kind].map((d) => [d.uid, d.updated_at]))
        const { winners } = pickWinners(incoming, stored)
        const synced_at = ++clock
        for (const rec of winners) {
          tables[kind] = tables[kind].filter((d) => d.uid !== rec.uid)
          tables[kind].push({ ...rec, synced_at })
        }
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 })
    }
    if (path === '/v2/sync/pull') {
      const sorted = [...tables[body.kind]].sort((a, b) => a.synced_at - b.synced_at || (a.uid < b.uid ? -1 : 1))
      const rows = sorted.filter((d) => matches(d, body.after))
      const page = rows.slice(0, body.limit)
      const last = page[page.length - 1]
      return new Response(JSON.stringify({
        records: page.map(({ synced_at: _s, ...r }) => r),
        next: last ? { t: last.synced_at, uid: last.uid } : null,
        hasMore: rows.length > body.limit,
      }), { status: 200 })
    }
    return new Response('not found', { status: 404 })
  })
  return { tables, requests, fetchImpl }
}

describe('runSyncCycle', () => {
  it('pushes the outbox, clears it, and a second device receives everything', async () => {
    const server = fakeServer()
    vi.stubGlobal('fetch', server.fetchImpl)

    // Device A: register one patient with a visit
    setSyncKey('k')
    const pid = await db.patients.add({ name: 'Rahul', quick_note: '', created_at: 1 }) as number
    await db.visits.add({
      patient_id: pid, date: 5, symptoms_text: 'fever', medicines_json: [{ name: 'Belladonna', potency: '30' }],
      fee_total: 300, amount_paid: 100, amount_due: 200, visit_number: 1,
    })
    const a = await runSyncCycle()
    expect(a.pushed).toBe(2)
    expect(await db.patients.where('dirty').equals(1).count()).toBe(0)
    expect(await db.visits.where('dirty').equals(1).count()).toBe(0)
    expect(server.tables.visits[0].patient_uid).toBe(server.tables.patients[0].uid)
    // API key comes from device storage, not the bundle
    expect((server.fetchImpl.mock.calls[0][1] as RequestInit).headers).toMatchObject({ 'X-API-Key': 'k' })

    // Device B: empty, same cloud
    await resetDevice()
    setSyncKey('k')
    // Give B a patient first so local ids differ from A's
    await db.patients.add({ name: 'Sita', quick_note: '', created_at: 2 })
    const b = await runSyncCycle()
    expect(b.pulled).toBe(2)
    const rahul = (await db.patients.where('name').equals('Rahul').first())!
    const visits = await db.visits.where('patient_id').equals(rahul.id!).toArray()
    expect(visits).toHaveLength(1)
    expect(visits[0]).toMatchObject({ amount_due: 200, dirty: 0 })
    expect(server.tables.patients).toHaveLength(2) // Sita pushed, no id collision with Rahul

    // B deletes Rahul; the tombstone reaches the cloud
    await db.patients.update(rahul.id!, { deleted_at: 99 })
    await runSyncCycle()
    expect(server.tables.patients.find((p) => p.name === 'Rahul')!.deleted_at).toBe(99)

    vi.unstubAllGlobals()
  })

  it('splits large outboxes into batches', async () => {
    const server = fakeServer()
    vi.stubGlobal('fetch', server.fetchImpl)
    setSyncKey('k')
    await db.patients.bulkAdd(Array.from({ length: 450 }, (_, i) => ({ name: `P${i}`, quick_note: '', created_at: i })))
    await runSyncCycle()
    const pushes = server.requests.filter((r) => r.path === '/v2/sync/push')
    expect(pushes.map((r) => r.body.patients.length)).toEqual([200, 200, 50])
    expect(server.tables.patients).toHaveLength(450)
    vi.unstubAllGlobals()
  })

  it('refuses to run without a paired key', async () => {
    await expect(runSyncCycle()).rejects.toThrow(/not connected/)
  })
})
