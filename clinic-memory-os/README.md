# 🏥 Clinic Memory OS – Homeopathic Practitioner Console

> A **single-screen, installable PWA consultation cockpit** built for solo homeopathic practitioners who need to **prescribe, track payments, and manage patient history** with laser focus—no distractions, no clutter.

![Rashid Pharmacy](https://img.shields.io/badge/For-Homeopathic%20Practitioners-blue?style=flat-square)
![PWA](https://img.shields.io/badge/Installable-PWA-green?style=flat-square)
![Mobile Ready](https://img.shields.io/badge/Mobile%20Ready-Yes-success?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-3178c6?style=flat-square)

---

## ✨ Why This Exists

**The Problem:**
A homeopathic practitioner in the clinic needs something **fast, reliable, and offline-capable**. They juggle 3 simultaneous tasks:
1. Find the patient & see their history
2. Pick medicines at different potencies  
3. Record symptoms, calculate fees → track dues

Most EMR software is bloated, cloud-dependent, and slow. **This is different.**

**The Solution:**
A **desktop-class React app** that fits on **one screen**, works **offline**, persists to **IndexedDB**, searches **instantly**, and auto-saves **every keystroke**.

---

## 🎯 Core Features

### 📋 Patient Timeline (Left Panel)
- **Instant search** by name, medicine, or symptom using Fuse.js fuzzy search
- **Medicine chips** showing last visit prescriptions at a glance (`[Nux] [Aloe] [Merc]`)
- **Add new patient instantly** with inline form (no modal, no extra clicks)
- **Auto-focus search box** on load — just start typing
- **Smart scroll memory** — selection stays visible

### 💊 Medicine Cockpit (Center)
- **3 medicine slots** (can add up to 8) — click to activate, turn blue on focus
- **Potency selector** — 6 / 30 / 200 / 1M / 10M in large, tactile buttons
- **Medicine shelf** with **`179+ remedies`** sorted A-Z
  - Search by **full name** (`Nux Vomica`) or **2-letter short code** (`NV`)
  - Shows abbreviation + last visit uses
- **Last visit card** — quickly repeat & modify with one click
- **Active slot visual feedback** — thick border, glow, numbered badge

### 💰 Payment & Dues Panel (Right)
- **Record fee**, mark **paid**, auto-calculate **due amount**
- **Outstanding dues badge** (red when unpaid) — click to open **Dues Ledger**
  - See every unpaid visit
  - Edit payment per visit
  - Mark full/partial settlements instantly
- **Quick buttons**: "Paid Full" / "Credit"
- **Real-time autosave** — no Save button needed
- **Delete patient** with confirmation (red modal, shows visit history)

### 🎓 Interactive Tutorial
- **8-step spotlight tutorial** with SVG mask highlights
- Teaches: Patient search → Medicine selection → Prescribing → Payments → Import history → Dues management → Delete
- Keyboard navigation: `←` `→` to step, `Esc` to close

### ⌨️ Keyboard Shortcuts (Built for Older Practitioners)
- `1` / `2` / `3` → activate medicine slot  
- `Enter` → repeat last visit or start new
- `Esc` → clear search, re-focus input

### 🌍 Data Import
- **"Import History"** button — bulk-add past visits for existing patients
- New visit modal with date + medicine + fee tracking
- Auto-sorts chronologically, saves in one go

---

## ☁️ Cloud Sync with MongoDB Atlas

**NEW**: Data syncs automatically across all devices (phone, laptop, tablet):

- **Cloud backup**: All data stored in MongoDB Atlas (never lost)
- **Multi-device sync**: Changes made on phone instantly appear on laptop
- **Offline-first**: App works offline, syncs when online (every 30 seconds)
- **Last-write-wins**: Conflict resolution by timestamp
- **No external login**: One API key per clinic, works across all devices

How it works:
```
Your Phone IndexedDB  ←→→→→→→→→→→→→  MongoDB Atlas (Cloud)
Your Laptop IndexedDB ←←←←←←←←←←←←→  (Master copy)
Your Tablet IndexedDB ←→→→→→→→→→→→→
```

---

## 🏗️ Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend UI** | React 18 + TypeScript |
| **Build** | Vite 6.4.1 |
| **Styling** | TailwindCSS 3.4 + custom tokens |
| **Local DB** | Dexie 4 (IndexedDB wrapper) |
| **Search** | Fuse.js 7 (fuzzy matching) |
| **Virtualization** | react-window (FixedSizeList, VariableSizeList) |
| **PWA** | vite-plugin-pwa 0.21 |
| **Backend API** | Node.js + Express 4.18 |
| **Cloud Database** | MongoDB Atlas |
| **Sync Engine** | Custom real-time bidirectional sync |

---

## 📦 Installation & Usage

### Development (Local)

```bash
# Clone & install
git clone <repo-url>
cd clinic-memory-os

# Install both frontend + backend
npm install
cd backend && npm install

# Start both servers (in separate terminals)
# Terminal 1: Backend (http://localhost:3000)
cd backend && npm run dev

# Terminal 2: Frontend (http://localhost:5174)
npm run dev:frontend

# Or start both together
npm run dev
```

### Production Deployment to Vercel

See [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step instructions.

**Quick summary:**
1. Push to GitHub
2. Create 2 Vercel projects (one for frontend, one for backend)
3. Add MongoDB Atlas URI + API key to environment variables
4. Deploy → auto-syncs with MongoDB

---

## 🎨 Design Philosophy

### Light Theme (60+ Year Old Practitioner)
- **Surface**: `#f0f5fb` (soft pale blue)
- **Primary text**: `#1b3649` (dark navy)
- **Accent**: `#0369a1` (sky blue, high contrast)
- **Large fonts** (14px body, 16-18px headings)
- **Wide scrollbars**, **big touch targets** (44px minimum)

### Responsive Design
- **Desktop (lg+)**: 3-panel layout side-by-side
- **Tablet/Mobile**: Tab-based navigation (Patients → Medicines → Payment)
  - Only MedicineCockpit shows by default (most interactive)
  - Swipe-friendly tab bar

---

## 📊 Database Schema

### IndexedDB (Local Cache)
```typescript
patients: {
  id: number (auto-increment)
  name: string
  quick_note: string
  created_at: number
  updated_at: number
}

visits: {
  id: number
  patient_id: number
  date: number
  symptoms_text: string
  medicines_json: MedicineEntry[]
  fee_total: number
  amount_paid: number
  amount_due: number
  visit_number: number
  created_at: number
  updated_at: number
}
```

### MongoDB Atlas (Cloud Master)
Same schema as above, synced bidirectionally.

---

## 🔄 Autosave & Persistence

- **IndexedDB**: Primary storage (works offline)
- **localStorage**: Draft backup (survives browser clear)
- **MongoDB Atlas**: Cloud backup (synced every 30 seconds when online)
- **Search index**: In-memory Fuse.js (rebuilt on sync)
- **PWA service worker**: Caches app shell for instant load

---

## 🛠️ Key Files

```
clinic-memory-os/
├── backend/                       # Node.js Express API
│   ├── src/
│   │   ├── server.ts             # Express server
│   │   ├── db/
│   │   │   └── mongodb.ts        # MongoDB connection
│   │   ├── routes/
│   │   │   ├── patients.ts       # Patient CRUD + endpoints
│   │   │   ├── visits.ts         # Visit CRUD + endpoints
│   │   │   └── sync.ts           # Sync push/pull logic
│   │   └── middleware/
│   │       └── auth.ts           # API key validation
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
├── src/                          # React frontend
│   ├── services/
│   │   └── syncService.ts        # MongoDB real-time sync
│   ├── components/
│   │   ├── TimelinePanel.tsx
│   │   ├── MedicineCockpit.tsx
│   │   ├── ClosurePanel.tsx
│   │   ├── DuesModal.tsx
│   │   └── ...
│   ├── db/
│   │   ├── db.ts                 # Dexie IndexedDB schema
│   │   └── seed.ts               # Demo data seeder
│   ├── state/
│   │   └── useAppState.ts        # Redux-like state
│   ├── search/
│   │   └── searchEngine.ts       # Fuse.js index
│   ├── hooks/
│   │   └── useAutosave.ts        # 300ms debounce
│   └── data/
│       └── medicines.ts          # 179 remedies
├── .env                          # Frontend local config
├── .env.production               # Frontend production config
├── vercel.json                   # Vercel monorepo config
├── DEPLOYMENT.md                 # Deployment guide
└── README.md                     # This file
```

---

## 🏥 Demo Data

**Pre-seeded with:**
- **179+ homeopathic medicines** (Aconitum, Nux Vomica, Merc Sol, Sulfur, etc.)
- **Potencies**: 6, 30, 200, 1M, 10M
- **Drop/tincture remedies**: Crataegus, Chelidonium, Justicia, etc.
- **5 demo patients** with visit history (ready to explore)

---

## 🎙️ For Practitioners

### Why This Works in Real Clinic
✅ **One screen** — no tabs, no dialogs (except modals)  
✅ **Big buttons** — no precision clicks needed  
✅ **Auto-save** — no Save button to miss  
✅ **Offline** — WiFi drops? Still works  
✅ **Fast search** — medicine name appears in <50ms  
✅ **Keyboard shortcuts** — older users love physical keys  
✅ **Installable** — looks like native app on home screen  
✅ **Multi-device** — phone, laptop, tablet all in sync  
✅ **Cloud backup** — never lose patient data  

### Training New Users
1. Launch → shows interactive 8-step tutorial
2. "How to Use" button (header) — replay anytime
3. Type `NV` in shelf to find Nux Vomica instantly
4. Click medicine slot, then pick potency
5. Record fee → all auto-saves & syncs to cloud
6. Open on phone → sees same data instantly

---

## 🔐 Privacy & Data

- ✅ **No cloud sync until deployed** — local-only during dev
- ✅ **Your MongoDB instance** — data stays in your Atlas account
- ✅ **No third-party tracking** — no analytics, no beacons
- ✅ **No login required** — API key auth (simple, secure)
- ✅ **Export** — right-click visit history → save JSON
- ✅ **HIPAA-friendly** — manage patient data locally & in your cloud account

---

## 🚀 Future Roadmap

- [ ] **PDF receipts** — print visit summaries + fee receipts
- [ ] **Repeat reminder** — notify if patient due for follow-up
- [ ] **Voice input** — dictate symptoms (PWA speech API)
- [ ] **Barcode scan** — quick patient lookup via QR code
- [ ] **Dark mode** — for late-night clinics
- [ ] **Multi-user** — support multiple doctors with role-based access
- [ ] **Analytics** — patient visit trends, revenue reports

---

## 📝 License

**Proprietary Software**  
Copyright © 2026 The Last Neuron. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, modification, or distribution is strictly prohibited.

---

## 👨‍⚕️ About

Built as a **single-screen consultation cockpit** for **Dr. Saood Ahmad** at **Rashid Pharmacy**, this PWA is a proprietary product of **The Last Neuron**—demonstrating that **enterprise software doesn't need to be complex**. Sometimes simplicity is the ultimate tool.

**Homeopathy. Clarity. Results.**

---

## 📧 Support

Found a bug? Want a feature? Open an issue or reach out—practitioners' feedback drives every update.

```
Rashid Pharmacy
Dr. Saood Ahmad · Consultation Cockpit
2026 · The Last Neuron
```
