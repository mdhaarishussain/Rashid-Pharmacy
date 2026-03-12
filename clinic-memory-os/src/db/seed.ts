import { db } from './db'
import type { MedicineEntry } from './db'

const SEED_KEY = 'clinic_os_seeded_v1'

const patients = [
  { name: 'Arjun Mehta', quick_note: 'Chronic asthma, sensitive to cold' },
  { name: 'Priya Sharma', quick_note: 'Recurrent migraines, left-sided' },
  { name: 'Mohammed Siddiq', quick_note: 'Arthritis, worse in damp weather' },
  { name: 'Rekha Nair', quick_note: 'Anxiety, palpitations, insomnia' },
  { name: 'Deepak Verma', quick_note: 'Chronic sinusitis, headaches' },
]

type VisitTemplate = {
  daysAgo: number
  symptoms: string
  medicines: MedicineEntry[]
  fee: number
  paid: number
}

const visitTemplates: VisitTemplate[][] = [
  // Arjun Mehta — asthma
  [
    { daysAgo: 180, symptoms: 'Dry cough, chest tightness, worse at night', medicines: [{ name: 'Arsenicum Album', potency: '30' }, { name: 'Spongia Tosta', potency: '30' }], fee: 300, paid: 300 },
    { daysAgo: 120, symptoms: 'Wheezing, shortness of breath, cold exposure', medicines: [{ name: 'Arsenicum Album', potency: '200' }, { name: 'Spongia Tosta', potency: '30' }, { name: 'Antimonium Tartaricum', potency: '30' }], fee: 300, paid: 300 },
    { daysAgo: 60, symptoms: 'Improved but still nocturnal cough', medicines: [{ name: 'Arsenicum Album', potency: '200' }, { name: 'Drosera Rotundifolia', potency: '30' }], fee: 300, paid: 200 },
    { daysAgo: 15, symptoms: 'Acute episode after dust exposure', medicines: [{ name: 'Arsenicum Album', potency: '1M' }, { name: 'Spongia Tosta', potency: '200' }], fee: 400, paid: 400 },
  ],
  // Priya Sharma — migraines
  [
    { daysAgo: 150, symptoms: 'Left-sided throbbing headache, nausea, photophobia', medicines: [{ name: 'Belladonna', potency: '200' }, { name: 'Iris Versicolor', potency: '30' }], fee: 250, paid: 250 },
    { daysAgo: 90, symptoms: 'Migraine with visual aura, starts left eye', medicines: [{ name: 'Natrum Muriaticum', potency: '200' }, { name: 'Iris Versicolor', potency: '30' }, { name: 'Bryonia Alba', potency: '30' }], fee: 300, paid: 300 },
    { daysAgo: 30, symptoms: 'Headache from sun exposure, worse motion', medicines: [{ name: 'Natrum Muriaticum', potency: '1M' }, { name: 'Glonoinum', potency: '30' }], fee: 350, paid: 300 },
    { daysAgo: 5, symptoms: 'Menstrual migraine, left temple, vomiting', medicines: [{ name: 'Natrum Muriaticum', potency: '1M' }, { name: 'Sepia Officinalis', potency: '200' }], fee: 400, paid: 400 },
  ],
  // Mohammed Siddiq — arthritis
  [
    { daysAgo: 200, symptoms: 'Joint stiffness morning, knees and fingers, worse cold damp', medicines: [{ name: 'Rhus Toxicodendron', potency: '30' }, { name: 'Bryonia Alba', potency: '30' }], fee: 250, paid: 250 },
    { daysAgo: 130, symptoms: 'Acute flare, swelling right knee, hot to touch', medicines: [{ name: 'Apis Mellifica', potency: '30' }, { name: 'Bryonia Alba', potency: '200' }, { name: 'Rhus Toxicodendron', potency: '200' }], fee: 300, paid: 300 },
    { daysAgo: 65, symptoms: 'Pain better with movement, worse rest and cold', medicines: [{ name: 'Rhus Toxicodendron', potency: '200' }, { name: 'Calcarea Carbonica', potency: '200' }], fee: 300, paid: 0 },
    { daysAgo: 10, symptoms: 'Settled, maintenance dose requested', medicines: [{ name: 'Rhus Toxicodendron', potency: '1M' }], fee: 200, paid: 500 },
  ],
  // Rekha Nair — anxiety
  [
    { daysAgo: 170, symptoms: 'Heart palpitations, fear, trembling, worse alone', medicines: [{ name: 'Argentum Nitricum', potency: '30' }, { name: 'Aconitum Napellus', potency: '200' }], fee: 300, paid: 300 },
    { daysAgo: 100, symptoms: 'Insomnia, mind racing, fear of death', medicines: [{ name: 'Arsenicum Album', potency: '200' }, { name: 'Coffea Cruda', potency: '30' }, { name: 'Aconitum Napellus', potency: '30' }], fee: 350, paid: 350 },
    { daysAgo: 40, symptoms: 'Anxiety before social events, trembling hands', medicines: [{ name: 'Gelsemium Sempervirens', potency: '200' }, { name: 'Argentum Nitricum', potency: '200' }], fee: 300, paid: 300 },
    { daysAgo: 3, symptoms: 'Sudden anxiety attack, chest tightness, shortness of breath', medicines: [{ name: 'Aconitum Napellus', potency: '1M' }, { name: 'Arsenicum Album', potency: '200' }, { name: 'Ignatia Amara', potency: '200' }], fee: 400, paid: 400 },
  ],
  // Deepak Verma — sinusitis
  [
    { daysAgo: 160, symptoms: 'Blocked nose, yellow discharge, headache forehead', medicines: [{ name: 'Kali Bichromicum', potency: '30' }, { name: 'Pulsatilla Nigricans', potency: '30' }], fee: 250, paid: 250 },
    { daysAgo: 95, symptoms: 'Sinusitis worse in morning, pressure cheeks, facial pain', medicines: [{ name: 'Kali Bichromicum', potency: '200' }, { name: 'Mercurius Solubilis', potency: '30' }, { name: 'Silicea', potency: '30' }], fee: 300, paid: 300 },
    { daysAgo: 45, symptoms: 'Recurrence after cold, thick green discharge', medicines: [{ name: 'Kali Bichromicum', potency: '200' }, { name: 'Hepar Sulphuris', potency: '30' }], fee: 300, paid: 150 },
    { daysAgo: 7, symptoms: 'Post nasal drip, cough, irritating throat', medicines: [{ name: 'Kali Bichromicum', potency: '1M' }, { name: 'Lycopodium Clavatum', potency: '200' }], fee: 350, paid: 350 },
  ],
]

export async function seedDemoData(): Promise<void> {
  if (localStorage.getItem(SEED_KEY)) return

  const now = Date.now()

  for (let i = 0; i < patients.length; i++) {
    const p = patients[i]
    const patientId = (await db.patients.add({
      name: p.name,
      quick_note: p.quick_note,
      created_at: now - 200 * 24 * 3600 * 1000,
    })) as number

    const templates = visitTemplates[i]
    for (let j = 0; j < templates.length; j++) {
      const t = templates[j]
      await db.visits.add({
        patient_id: patientId,
        date: now - t.daysAgo * 24 * 3600 * 1000,
        symptoms_text: t.symptoms,
        medicines_json: t.medicines,
        fee_total: t.fee,
        amount_paid: t.paid,
        amount_due: t.fee - t.paid,
        visit_number: j + 1,
      })
    }
  }

  localStorage.setItem(SEED_KEY, '1')
}
