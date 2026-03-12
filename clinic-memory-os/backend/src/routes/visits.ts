import { Router, Response } from 'express';
import { getDB, Visit } from '../db/mongodb.js';
import { AuthRequest } from '../middleware/auth.js';
import { ObjectId } from 'mongodb';

const router = Router();

// Helper: Validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
};

// GET visits for patient
router.get('/patient/:patientId', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDB();
    const visits = await db.collection<Visit>('visits')
      .find({ patient_id: req.params.patientId })
      .sort({ date: -1 })
      .toArray();

    res.json(visits);
  } catch (error) {
    console.error('Error fetching visits:', error);
    res.status(500).json({ error: 'Failed to fetch visits' });
  }
});

// GET single visit
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid visit ID format' });
    }

    const db = getDB();
    const visit = await db.collection<Visit>('visits').findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    res.json(visit);
  } catch (error) {
    console.error('Error fetching visit:', error);
    res.status(500).json({ error: 'Failed to fetch visit' });
  }
});

// POST create visit
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { patient_id, date, symptoms_text, medicines_json, fee_total, amount_paid, visit_number } = req.body;

    // Validation
    if (!patient_id || !date) {
      return res.status(400).json({ error: 'patient_id and date are required' });
    }

    const feeTotal = Number(fee_total) || 0;
    const amountPaid = Number(amount_paid) || 0;

    if (feeTotal < 0 || amountPaid < 0) {
      return res.status(400).json({ error: 'Fee and paid amounts must be non-negative' });
    }

    const db = getDB();
    const now = Date.now();

    const visit: Visit = {
      patient_id: String(patient_id),
      date: Number(date),
      symptoms_text: symptoms_text ? String(symptoms_text).substring(0, 5000) : '',
      medicines_json: Array.isArray(medicines_json) ? medicines_json : [],
      fee_total: feeTotal,
      amount_paid: amountPaid,
      amount_due: feeTotal - amountPaid,
      visit_number: Number(visit_number) || 1,
      created_at: now,
      updated_at: now,
    };

    const result = await db.collection<Visit>('visits').insertOne(visit as any);

    res.status(201).json({
      _id: result.insertedId.toString(),
      ...visit,
    });
  } catch (error) {
    console.error('Error creating visit:', error);
    res.status(500).json({ error: 'Failed to create visit' });
  }
});

// PUT update visit
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid visit ID format' });
    }

    const { symptoms_text, medicines_json, fee_total, amount_paid } = req.body;
    const db = getDB();

    // Fetch existing visit to calculate amount_due correctly
    const existingVisit = await db.collection<Visit>('visits').findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!existingVisit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const updateData: any = {
      updated_at: Date.now(),
    };

    if (symptoms_text !== undefined) {
      updateData.symptoms_text = String(symptoms_text).substring(0, 5000);
    }

    if (medicines_json !== undefined) {
      updateData.medicines_json = Array.isArray(medicines_json) ? medicines_json : [];
    }

    // Calculate new amount_due
    const newFeeTotal = fee_total !== undefined ? Number(fee_total) : existingVisit.fee_total;
    const newAmountPaid = amount_paid !== undefined ? Number(amount_paid) : existingVisit.amount_paid;

    if (newFeeTotal < 0 || newAmountPaid < 0) {
      return res.status(400).json({ error: 'Fee and paid amounts must be non-negative' });
    }

    if (fee_total !== undefined) updateData.fee_total = newFeeTotal;
    if (amount_paid !== undefined) updateData.amount_paid = newAmountPaid;
    updateData.amount_due = newFeeTotal - newAmountPaid;

    const result = await db.collection<Visit>('visits').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    const updated = await db.collection<Visit>('visits').findOne({
      _id: new ObjectId(req.params.id),
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating visit:', error);
    res.status(500).json({ error: 'Failed to update visit' });
  }
});

// DELETE visit
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid visit ID format' });
    }

    const db = getDB();

    const result = await db.collection<Visit>('visits').deleteOne({
      _id: new ObjectId(req.params.id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    res.json({ success: true, message: 'Visit deleted' });
  } catch (error) {
    console.error('Error deleting visit:', error);
    res.status(500).json({ error: 'Failed to delete visit' });
  }
});

export default router;
