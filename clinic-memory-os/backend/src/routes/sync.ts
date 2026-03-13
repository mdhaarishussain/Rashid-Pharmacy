import { Router, Response } from 'express';
import { getDB, Patient, Visit, SyncLog } from '../db/mongodb.js';
import { AuthRequest } from '../middleware/auth.js';

const router = Router();

// POST sync - pull new changes from server
router.post('/pull', async (req: AuthRequest, res: Response) => {
  try {
    const { lastSync } = req.body;
    const db = getDB();
    const deviceId = req.deviceId!;

    const lastSyncTimestamp = Number(lastSync) || 0;

    // Only fetch records that have local_id set (can be mapped back to Dexie)
    const patients = await db.collection<Patient>('patients')
      .find({ updated_at: { $gt: lastSyncTimestamp }, local_id: { $exists: true } })
      .toArray();

    const visits = await db.collection<Visit>('visits')
      .find({ updated_at: { $gt: lastSyncTimestamp }, local_id: { $exists: true } })
      .toArray();

    // Update device sync log
    const now = Date.now();
    await db.collection<SyncLog>('sync_log').updateOne(
      { device_id: deviceId },
      { $set: { last_sync: now, timestamp: now } },
      { upsert: true }
    );

    // Return data in local Dexie-compatible format so App.tsx can bulkPut directly
    res.json({
      timestamp: now,
      patients: patients.map(p => ({
        id: (p as any).local_id as number,
        name: p.name,
        quick_note: p.quick_note || '',
        created_at: p.created_at,
      })),
      visits: visits.map(v => ({
        id: (v as any).local_id as number,
        patient_id: (v as any).local_patient_id as number,
        date: v.date,
        symptoms_text: v.symptoms_text,
        medicines_json: v.medicines_json,
        fee_total: v.fee_total,
        amount_paid: v.amount_paid,
        amount_due: v.amount_due,
        visit_number: v.visit_number,
      })),
    });
  } catch (error) {
    console.error('Error pulling sync:', error);
    res.status(500).json({ error: 'Sync pull failed' });
  }
});

// POST sync - push local changes to server
router.post('/push', async (req: AuthRequest, res: Response) => {
  try {
    const { patients = [], visits = [] } = req.body;

    if (!Array.isArray(patients) || !Array.isArray(visits)) {
      return res.status(400).json({ error: 'Invalid sync data format' });
    }

    if (patients.length > 1000 || visits.length > 5000) {
      return res.status(413).json({ error: 'Sync payload too large' });
    }

    const db = getDB();
    const deviceId = req.deviceId!;
    const results = { patientsUpserted: 0, visitsUpserted: 0, errors: [] as any[] };

    // Upsert patients — dedup by local_id (the Dexie auto-increment numeric id)
    for (const patient of patients) {
      try {
        const localId = Number(patient.id);
        if (!localId) continue;
        const now = Date.now();

        await db.collection('patients').updateOne(
          { local_id: localId },
          {
            $set: {
              local_id: localId,
              name: String(patient.name || '').trim().substring(0, 200),
              quick_note: String(patient.quick_note || '').trim().substring(0, 500),
              created_at: Number(patient.created_at) || now,
              updated_at: now,
            },
          },
          { upsert: true }
        );
        results.patientsUpserted++;
      } catch (error) {
        results.errors.push({ type: 'patient', data: patient, error: String(error) });
      }
    }

    // Upsert visits — dedup by local_id
    for (const visit of visits) {
      try {
        const localId = Number(visit.id);
        const localPatientId = Number(visit.patient_id);
        if (!localId) continue;
        const now = Date.now();

        const feeTotal = Number(visit.fee_total) || 0;
        const amountPaid = Number(visit.amount_paid) || 0;

        await db.collection('visits').updateOne(
          { local_id: localId },
          {
            $set: {
              local_id: localId,
              local_patient_id: localPatientId,
              patient_id: String(localPatientId),
              date: Number(visit.date) || now,
              symptoms_text: String(visit.symptoms_text || '').substring(0, 5000),
              medicines_json: Array.isArray(visit.medicines_json) ? visit.medicines_json : [],
              fee_total: feeTotal,
              amount_paid: amountPaid,
              amount_due: feeTotal - amountPaid,
              visit_number: Number(visit.visit_number) || 1,
              created_at: Number(visit.created_at) || now,
              updated_at: now,
            },
          },
          { upsert: true }
        );
        results.visitsUpserted++;
      } catch (error) {
        results.errors.push({ type: 'visit', data: visit, error: String(error) });
      }
    }

    // Update device sync log
    const now = Date.now();
    await db.collection<SyncLog>('sync_log').updateOne(
      { device_id: deviceId },
      { $set: { last_sync: now, timestamp: now } },
      { upsert: true }
    );

    res.json({ success: true, timestamp: now, ...results });
  } catch (error) {
    console.error('Error pushing sync:', error);
    res.status(500).json({ error: 'Sync push failed' });
  }
});

// GET last sync time for device
router.get('/status', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDB();
    const deviceId = req.deviceId!;
    const syncLog = await db.collection<SyncLog>('sync_log').findOne({ device_id: deviceId });
    res.json({ deviceId, lastSync: syncLog?.last_sync || 0, timestamp: Date.now() });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

export default router;
