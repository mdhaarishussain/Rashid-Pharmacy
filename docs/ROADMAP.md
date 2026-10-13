# Clinic Memory OS: roadmap

Covers the review findings, the plan to replace the paper register, and the path to a clinician SaaS.

## Context
Rashid Pharmacy's Clinic Memory OS is a single-screen offline PWA (React + Dexie + Fuse) with an optional Express/MongoDB sync backend. It was built for one homeopath who sees 60–90 patients a day. The user wants three things: ideas to make it stronger, a plan to fully replace the paper register, and a path to selling it as a micro-SaaS to clinicians. The core UX choices hold up well: one screen, Repeat & Modify, potency-aware shelf, autosave, and crash-recovery draft. The weak points are in data safety and the sync layer. Those need fixing before more features, and before any second clinic touches it.

---

## 1. Fix first: these could lose or leak data today

| # | Issue | Where | Why it matters |
|---|---|---|---|
| 1 | **Sync will stop working at about 5,000 visits.** Every 30 s the app pushes *all* patients and visits. The server rejects more than 5,000 visits with a 413, and Vercel's body limit is about 4.5 MB. At 75 visits a day that is about 65 clinic days. If the app has been in use for a couple of months, **it may already be failing.** | `App.tsx:438-441`, `backend/src/routes/sync.ts:84` | The cloud backup silently goes stale. The only sign is a small red "Sync failed" label. |
| 2 | **Local auto-increment IDs are used as global IDs.** Phone and laptop can each create "patient #57", and the server upserts by `local_id`, so one overwrites the other. | `sync.ts:96-100, 119-123` | Patient records from different devices get mixed together. |
| 3 | **The API key ships inside the JS bundle** (`VITE_API_KEY`). Anyone who opens the site can read it and call `/api/sync/pull` to download every patient. | `syncService.ts:4` | Health data is exposed. This blocks selling the product. |
| 4 | **Deletes don't sync.** Deleted patients come back on the next pull. | `db.ts:96`, no tombstones | Users stop trusting the app. |
| 5 | **Demo seed runs in production.** Five fake patients get inserted on first load and then synced to the cloud. | `App.tsx:370`, `db/seed.ts` | Real register data mixed with fake data. |
| 6 | **Last-write-wins is based on server receive time**, not edit time (`updated_at: now`). | `sync.ts` | Old offline edits overwrite newer ones. |
| 7 | **No backup or export.** If the browser storage is cleared and sync is broken, everything is lost. | — | The paper register never had this risk. |

**Phase 0 (done, Oct 2026).** Sync v2 (uid + outbox + server cursor + tombstones), pairing instead of a bundled key, demo seed gated, Backup & Restore with a 7-day reminder, and Vitest suites for the frontend and backend. See `clinic-memory-os/DEPLOYMENT.md` → *Upgrading from sync v1*. One deviation: devices store the shared key once through pairing, not separate per-device tokens; real per-user auth arrives with Phase 3.

**Original Phase 0 plan:**
- Add `uid` (UUID), `updated_at` (client time), and `deleted_at` to `Patient` and `Visit`. Use a Dexie `version(2)` migration that backfills existing rows.
- Make sync incremental. Push only rows where `updated_at > lastPushedAt`, in batches of about 200. Pull by `updated_at` cursor. Upsert by `uid` and resolve conflicts on `updated_at`.
- Change deletes to soft-delete tombstones, and filter `deleted_at` everywhere: search index, timeline, dues.
- Remove the shared key from the browser. Short term: per-device tokens issued once through a PIN-protected pairing step. Long term: real auth (Phase 3).
- Only seed when `?demo=1` is in the URL or the app is in dev mode.
- Add one-tap **Export backup (JSON + CSV)**, plus a weekly reminder banner if no backup or sync has happened in 7 days.
- Add Vitest and tests for the reducer, the sync merge logic, and the migration. There are currently no tests.

## 2. Make it better: product and engineering polish

**Performance and correctness**
- `addToIndex` rebuilds the whole Fuse index on every autosave (`searchEngine.ts:94`). At 20k+ visits that is noticeable lag every 300 ms. Use `fuse.add`/`removeAt` instead, or index per patient rather than per visit.
- Search results aren't grouped by patient when a query is typed, so "Rahul" returns every Rahul visit. Group them: one row per patient with a visit-count badge.
- `NOW` in `searchEngine.ts:101` is frozen at page load, and the `setInterval` there is dead code. Compute it at query time.
- Add React error boundaries around each panel, so one crash doesn't blank the whole screen mid-consultation.

**Accessibility.** The current choices help a 60+ sighted mouse/touch user: large targets, high contrast, no modals in the core flow. The rest of WCAG is missing.
- There are **zero `aria-*`/`role` attributes** in `src/`. Add labels on icon buttons, `aria-live` for the "Saved" and sync status, `role="dialog"`, focus traps, and focus return on the modals (Dues, Migration, Delete, Tutorial).
- `text-xs` (12 px) is used heavily for dosage chips, dues labels, and Migration inputs. Add a **text-size setting (A / A+ / A++)** driven by a root CSS variable. This is a strong selling point for older clinicians.
- Check that the muted text color still meets 4.5:1 contrast. Add a visible `:focus-visible` ring everywhere.
- Respect `prefers-reduced-motion` for the tutorial spotlight.

**Clinical features that make it hard to give up**
- **Patient identity:** add a phone number (the main way to tell two "Rahul"s apart), age/sex, and an optional family or household link. The PRD calls out "multiple patients with similar names", but the data model has only `name`.
- **Printable or WhatsApp prescription slip.** Generate a clean slip (clinic header, medicines, dosage in English plus Hindi/Urdu, next-visit date) and share it with `navigator.share` or a `wa.me` link. Patients see this, so it's the most visible improvement.
- **Follow-up date** on each visit, plus a "Due today / overdue" strip at the top of the timeline.
- **Day-end summary:** patients seen, cash collected, new credit, top medicines. This replaces the register's daily total line.
- **Medicine stock hints:** count medicine usage from visit history so the doctor knows what to reorder. No full inventory system needed.
- **Voice note per visit** (MediaRecorder, stored locally). This is faster than typing for this user, and transcription can come later.

## 3. Replacing the paper register: the adoption playbook
The software isn't the hard part. The goal is to make the doctor reach for the tablet instead of the book.
1. **Run both in parallel for 2 weeks.** The compounder or assistant enters each visit after the consultation, and the doctor just looks at the screen. Use *Repeat & Modify* as the hook: show the doctor that recalling the last prescription takes 2 seconds instead of flipping pages.
2. **Back-fill only chronic and high-value patients**, using the existing MigrationModal. Add a **"photo of register page" attachment** per patient (camera → stored blob), so old history is viewable on day 1 without retyping. OCR can come later.
3. **Paper-parity features before cutover:** the day-end total (§2), a daily printable or PDF register page as a legal fallback, and a dues list sorted by amount.
4. **Hardware:** a 10–11" Android tablet on a stand, installed as a PWA in landscape, with a UPS or power bank. The app is already offline-first, so internet outages don't matter.
5. **Cutover criteria:** 10 consecutive clinic days with no register use, sync healthy, and a weekly backup taken. Keep the last register on the shelf as an emotional safety net.
6. **Measure it:** log local timestamps such as time-to-recall and visits per hour. Before/after numbers become the case study for selling the product (§4).

## 4. Micro-SaaS for clinicians

**Positioning.** "The 2-second register for solo practitioners: works offline, no training." Start with the niche that's already built in, **Indian homeopaths** (about 300k registered, with AYUSH policy support). Then AYUSH more broadly (Unani and Ayurveda medicine lists), then GPs, physiotherapists, and dentists by swapping the medicine catalogue for a specialty catalogue. Competitors (Practo Ray, HealthPlix, Docon) are cloud-first, complex, and allopathic-focused. Offline speed and the homeopathic potency model set this product apart.

**Architecture changes for multi-tenant use**
- Swap the custom Express plus a single global Mongo collection for **Supabase (Postgres + Auth + Row-Level Security)** or Postgres plus a proper sync engine (PowerSync or ElectricSQL work well with offline-first). Every row gets a `clinic_id`, and RLS enforces isolation between clinics. This also replaces the hand-rolled sync from §1.
- Auth: phone OTP login (doctors are used to it), a clinic workspace, and roles for doctor and compounder/receptionist.
- Make the medicine catalogue data per clinic (`src/data/medicines.ts` is currently hardcoded). Let each clinic add custom medicines, potencies, presets, and symptom chips.
- Settings: clinic name and logo (for the prescription slip), default fee, language, text size.
- Encrypt data at rest. Optionally add client-side encryption of `symptoms_text` with a clinic passphrase, which is a strong privacy message.

**Compliance (India first)**
- **DPDP Act 2023:** consent, a privacy policy, data export/delete on request, and a breach process. The product is a data processor for the clinic.
- **ABDM/ABHA** integration (Health ID linking, HFR registration) is optional but opens government programs.
- Host in India (Mumbai region). Add an audit log of who changed which visit.

**Pricing and packaging**
- Free: 1 device, local only, export.
- Solo ₹299–499/month: cloud backup, 3 devices, prescription slip, WhatsApp share.
- Clinic ₹999/month: staff logins, reports, ABDM.
- Offer annual plans with 2 months free. Collect payments through Razorpay subscriptions. Run a 14-day trial with a guided import.

**Go-to-market**
- Use Dr. Saood Ahmad as the reference customer, with a before/after time study and video.
- Reach homeopathy college alumni WhatsApp groups and the HMAI association, plus demos at homeopathic pharmacies, which see many doctors every day.
- Build a marketing landing page separate from the app (the current PRD forbids this inside the app, which is still correct).

**Engineering hygiene before taking a second customer**
- CI (GitHub Actions): typecheck, lint, Vitest, build.
- Error reporting (Sentry), uptime checks, and versioned DB migrations.
- Proper PWA update prompt ("New version, tap to reload") instead of silent `autoUpdate` during a consultation.
- Rewrite the README for buyers. Clean up `prd.md`/`.codex` (agent prompts in the repo look unprofessional to acquirers or partners).

---

## Suggested sequencing
| Phase | Scope | Est. |
|---|---|---|
| 0 ✅ | Data safety: UUIDs, incremental sync, tombstones, no prod seed, backup export, tests | done |
| 1 ✅ | Register parity: phone/age, prescription slip + WhatsApp, follow-ups, day-end summary, text-size and ARIA pass | done (Hindi/Urdu slip wording needs a native-speaker check) |
| 2 | Cutover at the uncle's clinic and time study | 2–3 wks (parallel) |
| 3 | Multi-tenant: Supabase + RLS + OTP auth, per-clinic catalogue and settings, Razorpay | 3–4 wks |
| 4 | Pilot with 5–10 homeopaths, then ABDM and more specialties | ongoing |

## Critical files (Phase 0)
- `clinic-memory-os/src/db/db.ts`: schema v2, uid/updated_at/deleted_at, soft delete
- `clinic-memory-os/src/services/syncService.ts` + `src/App.tsx:398-460`: incremental, batched sync
- `clinic-memory-os/backend/src/routes/sync.ts` + `middleware/auth.ts`: uid upsert, conflict resolution, device tokens
- `clinic-memory-os/src/hooks/useAutosave.ts`: set `updated_at`
- `clinic-memory-os/src/search/searchEngine.ts`: incremental Fuse, filter deleted rows, group by patient
- `clinic-memory-os/src/App.tsx:370`: gate `seedDemoData`

## Verification
- `npm run build` (tsc + vite) passes, and the new Vitest suite passes (reducer, migration v1→v2, sync merge).
- Seed 10k synthetic visits and confirm that search takes under 150 ms and autosave causes no visible lag.
- Two-browser test against a local backend: create patients offline on both, then reconnect. There should be no ID collisions, deletes should propagate, and the newer edit should win.
- Check the production bundle with `grep` to confirm it contains no API secret.
- Lighthouse accessibility score ≥ 95, plus keyboard-only and screen-reader passes on the core flow.
