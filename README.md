<div align="center">

```
██████╗  █████╗ ███████╗██╗  ██╗██╗██████╗
██╔══██╗██╔══██╗██╔════╝██║  ██║██║██╔══██╗
██████╔╝███████║███████╗███████║██║██║  ██║
██╔══██╗██╔══██║╚════██║██╔══██║██║██║  ██║
██║  ██║██║  ██║███████║██║  ██║██║██████╔╝
╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝╚═════╝

P H A R M A C Y  ·  C O N S U L T A T I O N  C O C K P I T
```

### **Clinic Memory OS v1**
*A single-screen PWA built for Dr. Saood Ahmad — replacing a handwritten register that sees 60–90 patients a day*

<br/>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6.4-646cff?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![PWA](https://img.shields.io/badge/Installable-PWA-5bb974?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Offline](https://img.shields.io/badge/Works-Offline-orange?style=for-the-badge&logo=serviceworker&logoColor=white)](#)

<br/>

</div>

---

## The Problem

A solo practitioner sees **60–90 patients a day**. Every thirty seconds matters. The existing tools are:

- ❌ Slow — cloud round-trips before every page loads
- ❌ Cluttered — six tabs when you need one screen
- ❌ Fragile — WiFi drops and the session dies
- ❌ Imprecise — no concept of potency, tincture, or biochemic salt

And the handwritten register? **Lost, illegible, and impossible to search.**

## The Solution

> **One screen. Three panels. Zero network dependency.**

Clinic Memory OS is a **React + IndexedDB PWA** that boots in under a second, works fully offline, auto-saves every keystroke, and fits the entire consultation workflow on a single view — patient history on the left, prescription cockpit in the center, payment on the right.

---

## Feature Tour

### `LEFT PANEL` — Patient Timeline

| Feature | Detail |
|---------|--------|
| **Instant fuzzy search** | Fuse.js — search by name, medicine prescribed, or symptom in < 50 ms |
| **Medicine chips** | Last visit's prescriptions shown as coloured chips on the patient row |
| **Inline add patient** | No modal — a single text field appears in the list, Enter to confirm |
| **Auto-focus on load** | Cursor lands in the search box; just start typing |
| **Virtualized list** | react-window `FixedSizeList` — 10,000 patients scroll at 60 fps |

---

### `CENTER PANEL` — Medicine Cockpit

#### Prescription Slots
Up to **8 medicine slots** (3 by default). The active slot glows with an accent ring and a numbered badge.

```
┌─────────────────────────────────────────────────────┐
│  ●1  NV  Nux Vomica             30   BD·AC·5d ✎  ✕  │
│  ○2  BS  Berberis Vulgaris      💧Ø  HS·10d    ✕  │
│  ○3  ─── Empty ─────────────────────────────────  │
│  + Add slot                                         │
└─────────────────────────────────────────────────────┘
```

#### Three-Mode Dosage System

| Mode | Trigger | What you see |
|------|---------|-------------|
| **Quick** (default) | Medicine selected | 4 preset chips + pill/drop qty |
| **Compact** | Both freq & qty chosen | Collapsed `BD·AC·5d·2p ✎` pill — 1 tap to edit |
| **Custom** | Tap "Custom…" or ✎ | Full Freq / Food / Days / Qty rows |

**Preset chips** — one tap fills three fields simultaneously:

| Chip | Means |
|------|-------|
| `BD · AC · 5d` | Twice daily · before meals · 5 days |
| `TD · AC · 3d` | Three times · before meals · 3 days |
| `HS · 10d` | At bedtime · 10 days |
| `BD · PC · 7d` | Twice daily · after meals · 7 days |

#### Medicine Type Awareness

The shelf intelligently shows **only valid potencies per medicine type:**

| Type | Potencies | Qty unit |
|------|-----------|---------|
| **Homeopathic Remedy** (~150) | 6 · 30 · 200 · 1M · 10M | Pills (1p / 2p / 3p / 6p) |
| **Biochemic Tissue Salt** (13) | 6x · 12x | Pills |
| **Mother Tincture** (24) | 💧 Ø | Drops (5 / 10 / 15 / 20) |

#### Medicine Shelf
- **179+ medicines** sorted A–Z in a virtualized `VariableSizeList`
- Search by **full name** (`Nux Vomica`) or **2-letter code** (`NV`, `BS`, `CH`)
- Potency buttons adapt per medicine type — tinctures show only `💧Ø`

---

### `RIGHT PANEL` — Payment & Closure

| Feature | Detail |
|---------|--------|
| **Fee entry** | Total fee + amount paid; auto-computes due |
| **Quick fill** | "Paid Full" fills exact amount; "Credit" marks ₹0 paid |
| **Symptom chips** | 20 alphabetical chips — Acidity, Anxiety, Back Pain … Weakness |
| **Dues badge** | Red `Outstanding ₹X` — opens per-visit ledger |
| **Dues ledger** | Edit each visit's payment, mark settled, shows running balance |
| **Delete patient** | Confirmed deletion with visit count shown, irreversible |
| **Auto-save** | 300 ms debounce → IndexedDB + localStorage crash recovery |

---

### `GLOBAL` — Keyboard Shortcuts

> Designed for a practitioner who would rather not lift their hand from the desk.

| Key | Action |
|-----|--------|
| `1` `2` `3` | Activate medicine slot 1, 2, or 3 |
| `Enter` | New visit (or Repeat & Modify if patient has history) |
| `Esc` | Clear search · re-focus patient list |
| `b` | Apply preset **BD · AC · 5d** to active slot |
| `t` | Apply preset **TD · AC · 3d** to active slot |
| `h` | Apply preset **HS · 10d** to active slot |
| `p` | Apply preset **BD · PC · 7d** to active slot |

> Shortcuts fire only when no input/textarea/button has focus — never interfere with typing.

---

### `HEADER` — How to Use Tutorial

A **10-step interactive spotlight tutorial** walks new users through the entire workflow:
Patient search → New visit → Prescribing → Dosage system → Keyboard shortcuts → Symptoms → Payment → Import history → Dues ledger → Patient deletion.

Navigate with `←` `→` keys or click the pill indicators. Spotlight highlights the exact panel being explained.

---

### `IMPORT` — Bulk History Migration

For patients already on treatment — enter all past visits at once:

- Pick or create a patient
- Add each past visit (date, medicines with **full dosage details**, fee)
- Potency dropdown auto-adapts when you select a medicine (tinctures → drops, biochemics → 6x/12x)
- Saves all visits in a single transaction

---

## Architecture

```
clinic-memory-os/
├── src/
│   ├── App.tsx                    ← Layout · keyboard handler · tutorial · sync UI
│   ├── components/
│   │   ├── TimelinePanel.tsx      ← Virtualized patient list · fuzzy search
│   │   ├── MedicineCockpit.tsx    ← Slots · shelf · 3-mode dosage UI
│   │   ├── ClosurePanel.tsx       ← Symptoms · fees · dues · delete
│   │   ├── DuesModal.tsx          ← Per-visit balance ledger
│   │   └── MigrationModal.tsx     ← Bulk import with dosage support
│   ├── state/
│   │   └── useAppState.ts         ← Single useReducer (AppState + AppAction)
│   ├── db/
│   │   ├── db.ts                  ← Dexie schema · MedicineEntry type
│   │   └── seed.ts                ← Demo patients + visit data
│   ├── search/
│   │   └── searchEngine.ts        ← Fuse.js module singleton · build/search
│   ├── hooks/
│   │   └── useAutosave.ts         ← 300 ms debounce → IndexedDB + localStorage
│   ├── services/
│   │   └── syncService.ts         ← Push/pull to MongoDB backend every 30 s
│   └── data/
│       └── medicines.ts           ← 179+ medicines · types · potency sets · shortcodes
│
└── backend/                       ← Vercel serverless (Express + MongoDB)
    └── src/server.ts              ← /api/patients · /api/visits · /api/sync
```

### State Flow

```
User action
    │
    ▼
AppAction dispatch
    │
    ▼
useReducer (useAppState.ts)
    │
    ├─► IndexedDB write (Dexie) ──► Search index rebuild (Fuse.js)
    │
    └─► useAutosave debounce (300 ms)
            └─► localStorage crash snapshot
```

---

## Data Schema

```typescript
interface Patient {
  id:          number       // auto-increment
  name:        string
  quick_note:  string
  created_at:  number       // unix ms
}

interface MedicineEntry {
  name:    string
  potency: string
  type?:   'remedy' | 'biochemic' | 'tincture'
  freq?:   string           // 'OD' | 'BD' | 'TD' | 'QD' | 'HS'
  food?:   string           // 'AC' | 'PC'
  days?:   number           // 3 | 5 | 7 | 10
  qty?:    number           // pills: 1/2/3/6  |  drops: 5/10/15/20
}

interface Visit {
  id:            number
  patient_id:    number
  date:          number      // unix ms
  symptoms_text: string
  medicines_json: MedicineEntry[]
  fee_total:     number
  amount_paid:   number
  amount_due:    number
  visit_number:  number
}
```

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **UI** | React 18 + TypeScript | Component model, strong typing |
| **Build** | Vite 6.4 | Sub-second HMR, fast production builds |
| **Styling** | TailwindCSS 3.4 + CSS custom properties | Utility classes + design token theming |
| **Local DB** | Dexie 4 (IndexedDB) | Offline persistence, reactive queries |
| **Search** | Fuse.js 7 | Client-side fuzzy search, zero latency |
| **Virtualization** | react-window | 60 fps lists at any dataset size |
| **PWA** | vite-plugin-pwa 0.21 | Service worker, installable, offline shell |
| **Backend** | Express + MongoDB on Vercel | Serverless sync endpoint |

---

## Getting Started

```bash
# 1. Clone
git clone https://github.com/mdhaarishussain/Rashid-Pharmacy.git
cd Rashid-Pharmacy/clinic-memory-os

# 2. Install
npm install

# 3. Develop (localhost:5174 with HMR)
npm run dev

# 4. Type-check
npx tsc -b --noEmit

# 5. Production build
npm run build
```

### Environment Variables (optional — for cloud sync)

```env
# clinic-memory-os/.env.local
VITE_API_URL=https://your-backend.vercel.app
VITE_API_KEY=your-secret-key
```

Without these the app works entirely offline with no sync.

### Deploy Frontend

**Vercel (zero-config):**
```bash
vercel --prod
```

**Any static host:**
```bash
npm run build
# Serve the dist/ folder — that's the entire app
```

### Deploy Backend

```bash
cd backend
vercel --prod
# Set MONGODB_URI and API_KEY in Vercel environment variables
```

---

## Design Philosophy

The UI was built for a **60+ year old practitioner** who uses it 8 hours a day on a mid-range Android tablet.

| Principle | Implementation |
|-----------|---------------|
| **Large targets** | Minimum 44 px touch targets everywhere |
| **High contrast** | Navy `#1b3649` on pale-blue `#f0f5fb` surface |
| **Accent** | Sky blue `#0369a1` — high contrast ratio |
| **No modals for core flow** | Inline patient add, auto-save, no OK dialogs |
| **Offline-first** | Every keystroke persists locally; sync is additive |
| **One screen** | No navigation, no breadcrumbs, no page loads |

**Responsive layout:**
- **Desktop / tablet (≥ 1024 px):** three panels side-by-side, all visible at once
- **Mobile (< 1024 px):** tab bar with Patients · Medicines · Payment

---

## Privacy & Data

| Property | Status |
|----------|--------|
| Local storage | IndexedDB on your device |
| Network calls | Only when `VITE_API_URL` is set |
| Analytics / tracking | None |
| Login required | No |
| Patient data leaves device | Only on explicit sync, opt-in |

---

## License

**Proprietary Software**
Copyright © 2026 The Last Neuron. All rights reserved.

Unauthorized copying, modification, or distribution — in whole or in part — is strictly prohibited.

---

<div align="center">

**Rashid Pharmacy · Dr. Saood Ahmad · Consultation Cockpit**

*Built by [The Last Neuron](https://github.com/mdhaarishussain) · Homeopathy. Clarity. Results.*

</div>
