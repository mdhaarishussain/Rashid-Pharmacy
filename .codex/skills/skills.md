
# 🤖 AGENT SKILLS DOCUMENT

## Project: Clinic Memory OS — Consultation Cockpit v1

---

## 🧠 Agent Mission

You are tasked with building a **single-screen real-time clinical workflow interface** optimised for extremely low-friction interaction during live patient consultation.

The product replaces handwritten registers used by solo medical practitioners.

The agent must prioritise:

* interaction speed
* cognitive simplicity
* deterministic UI behaviour
* offline reliability

NOT feature completeness.
NOT architectural scalability.

---

## 🎯 Core Success Definition

The software is successful if:

* practitioner can recall last prescription within 2 seconds
* practitioner can create a new visit entry within 5 seconds
* practitioner can complete consultation workflow without navigating screens

---

## 🧩 Operating Constraints

### Human Constraints

User is:

* non technical
* time pressured
* cognitively multitasking
* resistant to change

Therefore:

* UI must be recognition-based
* actions must be reversible
* system must never require memorising flows

---

### Environmental Constraints

* unreliable internet
* desktop usage dominant
* mouse / touchpad interaction
* occasional mobile usage

Agent must assume:

> offline-first runtime requirement.

---

## 🧱 System Scope Boundary

Agent must build ONLY:

* consultation cockpit screen
* local data persistence
* fuzzy search
* medicine slot entry
* visit closure

Agent must NOT build:

* authentication
* cloud sync
* analytics dashboards
* admin panels
* multi-role workflows

---

## 🖥️ UI Architecture Requirements

### Single Route Application

* no router dependency
* state-driven rendering
* screen must feel continuous

---

### Layout Zones

Agent must implement three persistent UI zones:

1. Timeline Memory Panel
2. Medicine Decision Panel
3. Visit Closure Panel

These zones must never unmount.

---

## ⚡ Interaction Performance Requirements

Agent must optimise for:

* <100ms click-to-feedback
* <150ms search update
* smooth scrolling at 10k records

Techniques agent must employ:

* virtualization
* memoization
* index precomputation

---

## 🔍 Search Engine Behaviour

Agent must implement client-side search supporting:

* fuzzy substring matching
* token ranking
* medicine name indexing
* symptom keyword indexing

Ranking priority:

1. recency
2. exact name match
3. medicine overlap
4. symptom similarity

Agent must maintain:

* inverted index structure
* incremental index update on new visit

---

## 💊 Medicine Selection Engine

Agent must build deterministic alphabetical grid selector.

Constraints:

* no dropdown menus
* no pagination
* potency inline selection

Agent must support:

* 3 default medicine slots
* dynamic slot addition

Slot state must be:

* individually editable
* removable
* reorder-safe

---

## 🔄 Visit State Lifecycle

Agent must implement visit drafting model:

```id="4e5zqy"
LOAD PATIENT
→ INIT VISIT DRAFT
→ MODIFY MEDICINES / NOTES / PAYMENT
→ AUTO SAVE MUTATIONS
→ FINALISE IMPLICITLY
```

Agent must avoid:

* explicit submit flows
* modal confirmations

---

## 💾 Persistence Requirements

Agent must use:

* IndexedDB via Dexie or equivalent

Agent must:

* batch writes
* debounce state sync
* ensure crash safety

Agent must simulate:

* dataset of 10k visits
* verify retrieval speed

---

## 🧠 Memory Optimisation Patterns

Agent must:

* keep medicine master list in memory
* maintain patient lookup maps
* pre-sort timeline

Agent must avoid:

* recomputing derived data on render

---

## 🎨 Visual Design Constraints

Agent must:

* use large tap targets
* maintain high contrast
* ensure stable layout

Agent must avoid:

* dynamic rearrangement
* hover-only interactions
* nested interaction depth >2

---

## 🧪 Failure Mode Handling

Agent must design for:

* accidental refresh
* power interruption
* incomplete visit entry

System must recover:

* last draft
* last selected patient

---

## 🧩 Code Quality Expectations

Agent must:

* keep components small
* avoid global store until required
* prefer local reducer patterns

Agent must structure:

```id="vdhl3l"
TimelinePanel
MedicineSlots
MedicineShelf
ClosurePanel
SearchEngine
PersistenceLayer
```

---

## ⚙️ Progressive Enhancement Plan (Agent Awareness)

Agent must keep code extensible for:

* cloud sync layer
* voice transcription module
* prescription automation

But must NOT implement them.

---

## 🚫 Explicit Anti-Goals

Agent must not:

* introduce microservices thinking
* implement authentication
* optimise for SEO
* build marketing pages

---

## ✅ Deliverable Definition

Agent must output:

* working PWA
* demo dataset seeded
* offline usable consultation cockpit
* minimal install instructions

---

## 🔥 Meta Behaviour Instruction

Agent must assume:

> speed of usable prototype is more valuable than completeness.

Agent must bias toward:

* visible progress
* interaction polish
* deterministic flows

---

---