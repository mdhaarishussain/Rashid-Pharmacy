import { Router, Response } from 'express';
import { getDB, Patient } from '../db/mongodb.js';
import { AuthRequest } from '../middleware/auth.js';
import { ObjectId } from 'mongodb';

const router = Router();

// Helper: Validate ObjectId
const isValidObjectId = (id: string): boolean => {
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id;
};

// GET all patients
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const db = getDB();
    const patients = await db.collection<Patient>('patients')
      .find({})
      .sort({ created_at: -1 })
      .toArray();

    res.json(patients);
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// GET single patient
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid patient ID format' });
    }

    const db = getDB();
    const patient = await db.collection<Patient>('patients').findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json(patient);
  } catch (error) {
    console.error('Error fetching patient:', error);
    res.status(500).json({ error: 'Failed to fetch patient' });
  }
});

// POST create patient
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, quick_note } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Patient name is required' });
    }

    if (name.trim().length > 200) {
      return res.status(400).json({ error: 'Patient name too long (max 200 chars)' });
    }

    const db = getDB();
    const now = Date.now();

    const patient: Patient = {
      name: name.trim(),
      quick_note: quick_note ? String(quick_note).trim().substring(0, 500) : '',
      created_at: now,
      updated_at: now,
    };

    const result = await db.collection<Patient>('patients').insertOne(patient as any);

    res.status(201).json({
      _id: result.insertedId.toString(),
      ...patient,
    });
  } catch (error) {
    console.error('Error creating patient:', error);
    res.status(500).json({ error: 'Failed to create patient' });
  }
});

// PUT update patient
router.put('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid patient ID format' });
    }

    const { name, quick_note } = req.body;
    const db = getDB();

    const updateData: any = {
      updated_at: Date.now(),
    };

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Invalid patient name' });
      }
      updateData.name = name.trim().substring(0, 200);
    }

    if (quick_note !== undefined) {
      updateData.quick_note = String(quick_note).trim().substring(0, 500);
    }

    const result = await db.collection<Patient>('patients').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    const updated = await db.collection<Patient>('patients').findOne({
      _id: new ObjectId(req.params.id),
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating patient:', error);
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// DELETE patient
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid patient ID format' });
    }

    const db = getDB();
    const patientIdStr = req.params.id;

    // Delete patient visits first (patient_id is stored as string)
    const deleteVisitsResult = await db.collection('visits').deleteMany({
      patient_id: patientIdStr,
    });

    // Delete patient
    const result = await db.collection<Patient>('patients').deleteOne({
      _id: new ObjectId(patientIdStr),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    res.json({ 
      success: true, 
      message: 'Patient deleted',
      visitsDeleted: deleteVisitsResult.deletedCount 
    });
  } catch (error) {
    console.error('Error deleting patient:', error);
    res.status(500).json({ error: 'Failed to delete patient' });
  }
});

export default router;
