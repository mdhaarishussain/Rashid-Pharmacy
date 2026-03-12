import { Router, Response } from 'express';
import { getDB, Patient, Visit, SyncLog } from '../db/mongodb.js';
import { AuthRequest } from '../middleware/auth.js';
import { ObjectId } from 'mongodb';

const router = Router();

// POST sync - pull new changes from server
router.post('/pull', async (req: AuthRequest, res: Response) => {
  try {
    const { lastSync } = req.body;
    const db = getDB();
    const deviceId = req.deviceId!;

    const lastSyncTimestamp = Number(lastSync) || 0;

    // Fetch patients changed since lastSync
    const patients = await db.collection<Patient>('patients')
      .find({
        updated_at: { $gt: lastSyncTimestamp },
      })
      .toArray();

    // Fetch visits changed since lastSync
    const visits = await db.collection<Visit>('visits')
      .find({
        updated_at: { $gt: lastSyncTimestamp },
      })
      .toArray();

    // Update device sync log
    const now = Date.now();
    await db.collection<SyncLog>('sync_log').updateOne(
      { device_id: deviceId },
      {
        $set: {
          last_sync: now,
          timestamp: now,
        },
      },
      { upsert: true }
    );

    res.json({
      timestamp: now,
      patients: patients.map(p => ({
        ...p,
        _id: p._id?.toString(),
      })),
      visits: visits.map(v => ({
        ...v,
        _id: v._id?.toString(),
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

    // Validate arrays
    if (!Array.isArray(patients) || !Array.isArray(visits)) {
      return res.status(400).json({ error: 'Invalid sync data format' });
    }

    if (patients.length > 1000 || visits.length > 5000) {
      return res.status(413).json({ error: 'Sync payload too large' });
    }

    const db = getDB();
    const deviceId = req.deviceId!;

    const results = {
      patientsUpserted: 0,
      visitsUpserted: 0,
      errors: [] as any[],
    };

    // Upsert patients
    for (const patient of patients) {
      try {
        const { _id, ...data } = patient;
        const now = Date.now();

        if (_id) {
          // Update existing (convert string _id to ObjectId)
          const objectId = ObjectId.isValid(_id) ? new ObjectId(_id) : null;
          if (!objectId) {
            throw new Error('Invalid patient _id format');
          }

          await db.collection<Patient>('patients').updateOne(
            { _id: objectId },
            {
              $set: {
                name: String(data.name || '').trim().substring(0, 200),
                quick_note: String(data.quick_note || '').trim().substring(0, 500),
                created_at: Number(data.created_at) || now,
                updated_at: now,
              },
            },
            { upsert: true }
          );
        } else {
          // Insert new
          await db.collection<Patient>('patients').insertOne({
            name: String(data.name || '').trim().substring(0, 200),
            quick_note: String(data.quick_note || '').trim().substring(0, 500),
            created_at: Number(data.created_at) || now,
            updated_at: now,
          } as any);
        }
        results.patientsUpserted++;
      } catch (error) {
        results.errors.push({
          type: 'patient',
          data: patient,
          error: String(error),
        });
      }
    }

    // Upsert visits
    for (const visit of visits) {
      try {
        const { _id, ...data } = visit;
        const now = Date.now();

        const feeTotal = Number(data.fee_total) || 0;
        const amountPaid = Number(data.amount_paid) || 0;

        const visitData = {
          patient_id: String(data.patient_id || ''),
          date: Number(data.date) || now,
          symptoms_text: String(data.symptoms_text || '').substring(0, 5000),
          medicines_json: Array.isArray(data.medicines_json) ? data.medicines_json : [],
          fee_total: feeTotal,
          amount_paid: amountPaid,
          amount_due: feeTotal - amountPaid,
          visit_number: Number(data.visit_number) || 1,
          created_at: Number(data.created_at) || now,
          updated_at: now,
        };

        if (_id) {
          // Update existing
          const objectId = ObjectId.isValid(_id) ? new ObjectId(_id) : null;
          if (!objectId) {
            throw new Error('Invalid visit _id format');
          }

          await db.collection<Visit>('visits').updateOne(
            { _id: objectId },
            { $set: visitData },
            { upsert: true }
          );
        } else {
          // Insert new
          await db.collection<Visit>('visits').insertOne(visitData as any);
        }
        results.visitsUpserted++;
      } catch (error) {
        results.errors.push({
          type: 'visit',
          data: visit,
          error: String(error),
        });
      }
    }

    // Update device sync log
    const now = Date.now();
    await db.collection<SyncLog>('sync_log').updateOne(
      { device_id: deviceId },
      {
        $set: {
          last_sync: now,
          timestamp: now,
        },
      },
      { upsert: true }
    );

    res.json({
      success: true,
      timestamp: now,
      ...results,
    });
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

    const syncLog = await db.collection<SyncLog>('sync_log').findOne({
      device_id: deviceId,
    });

    res.json({
      deviceId,
      lastSync: syncLog?.last_sync || 0,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

export default router;
