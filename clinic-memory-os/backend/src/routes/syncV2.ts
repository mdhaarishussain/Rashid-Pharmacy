import { Router, Response } from 'express'
import { getDB } from '../db/mongodb.js'
import { AuthRequest } from '../middleware/auth.js'
import {
  cursorFilter,
  pickWinners,
  sanitizePatient,
  sanitizeVisit,
  type Cursor,
  type Kind,
  type WirePatient,
  type WireVisit,
} from '../sync/merge.js'

// Sync v2: records keyed by client-generated `uid`, last-write-wins on the
// client's `updated_at`, and pulls ordered by the server-assigned `synced_at`
// so a device never misses records pushed late by a device with a slow clock.

const router = Router()

export const V2_COLLECTIONS: Record<Kind, string> = {
  patients: 'patients_v2',
  visits: 'visits_v2',
}

const MAX_PUSH = 500
const MAX_PULL = 1000

async function upsertKind(kind: Kind, raw: unknown[]) {
  const sanitize: (raw: unknown) => WirePatient | WireVisit | null =
    kind === 'patients' ? sanitizePatient : sanitizeVisit
  const records = raw.map(sanitize).filter((r): r is WirePatient | WireVisit => r !== null)
  const invalid = raw.length - records.length
  if (!records.length) return { written: 0, stale: 0, invalid }

  const collection = getDB().collection(V2_COLLECTIONS[kind])
  const stored = await collection
    .find({ uid: { $in: records.map((r) => r.uid) } }, { projection: { uid: 1, updated_at: 1 } })
    .toArray()
  const { winners, stale } = pickWinners(
    records,
    new Map(stored.map((d) => [d.uid as string, d.updated_at as number]))
  )
  if (!winners.length) return { written: 0, stale, invalid }

  const synced_at = Date.now()
  await collection.bulkWrite(
    winners.map((rec) => ({
      updateOne: {
        // Guard against a concurrent newer write landing between find and write
        filter: { uid: rec.uid, $or: [{ updated_at: { $lt: rec.updated_at } }, { updated_at: { $exists: false } }] },
        update: { $set: { ...rec, synced_at } },
        upsert: true,
      },
    })),
    { ordered: false }
  ).catch((err) => {
    // E11000 = the guarded filter missed because a newer copy exists — that record is stale, not an error
    const writeErrors: Array<{ code?: number }> = err?.writeErrors ? [].concat(err.writeErrors) : []
    const onlyDuplicates = writeErrors.length ? writeErrors.every((e) => e.code === 11000) : err?.code === 11000
    if (!onlyDuplicates) throw err
  })
  return { written: winners.length, stale, invalid }
}

router.post('/push', async (req: AuthRequest, res: Response) => {
  const { patients = [], visits = [] } = req.body ?? {}
  if (!Array.isArray(patients) || !Array.isArray(visits)) {
    return res.status(400).json({ error: 'patients and visits must be arrays' })
  }
  if (patients.length > MAX_PUSH || visits.length > MAX_PUSH) {
    return res.status(413).json({ error: `Send at most ${MAX_PUSH} records of each kind per request` })
  }
  try {
    const p = await upsertKind('patients', patients)
    const v = await upsertKind('visits', visits)
    res.json({ success: true, timestamp: Date.now(), patients: p, visits: v })
  } catch (error) {
    console.error('sync v2 push failed:', error)
    res.status(500).json({ error: 'Sync push failed' })
  }
})

router.post('/pull', async (req: AuthRequest, res: Response) => {
  const { kind, after, limit } = req.body ?? {}
  if (kind !== 'patients' && kind !== 'visits') {
    return res.status(400).json({ error: "kind must be 'patients' or 'visits'" })
  }
  const pageSize = Math.min(Math.max(Number(limit) || 500, 1), MAX_PULL)
  try {
    const docs = await getDB()
      .collection(V2_COLLECTIONS[kind as Kind])
      .find(cursorFilter(after as Cursor | null), { projection: { _id: 0 } })
      .sort({ synced_at: 1, uid: 1 })
      .limit(pageSize + 1)
      .toArray()
    const hasMore = docs.length > pageSize
    const page = docs.slice(0, pageSize)
    const last = page[page.length - 1]
    res.json({
      records: page.map(({ synced_at: _s, ...rest }) => rest),
      next: last ? { t: last.synced_at, uid: last.uid } : null,
      hasMore,
    })
  } catch (error) {
    console.error('sync v2 pull failed:', error)
    res.status(500).json({ error: 'Sync pull failed' })
  }
})

export default router
