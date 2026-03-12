Good. Now you are talking like an operator under time pressure.
So I’ll give you something **usable → not inspirational.**

Below is a **FULL EXECUTION-GRADE PRD + AGENT BUILD SKILLS DOC.**
No fluff. No startup theatre. Just build instructions.

---

# 📄 PRODUCT REQUIREMENT DOCUMENT

## Product Name (Working): **Clinic Memory OS (v1)**

---

## 🎯 Product Objective

Build an ultra-fast **consultation cockpit** for a solo homeopathic practitioner that:

* replaces handwritten register usage during live consultation
* enables instant recall of last prescribed medicines
* allows rapid repeat-modify prescription entry
* tracks payment / credit per visit
* works reliably with minimal cognitive load

Success Metric:

> Doctor uses it continuously for ≥ 3 consultation days without reverting to register.

---

## 👤 Primary User Persona

**Solo Homeopathic Practitioner**

* Age ~50+
* Sees ~60–90 patients/day
* Works seated at desk
* Shelf of alphabetically arranged medicines on right
* Writes notes during consultation
* Remembers patients by story / symptom / timeline
* Needs to recall medicines more than symptoms
* Tech resistant but speed sensitive

---

## 🧠 Core User Problems

1. Slow recall of past prescription
2. Messy credit tracking
3. Manual visit counting
4. Fatigue from writing repetitive medicines
5. Timeline-based searching only
6. Multiple patients with similar names

---

## ✅ Core Product Principles

* One screen only
* Recognition > Recall
* Timeline navigation > Database search
* Repeat-modify > Fresh entry
* Medicine memory > Clinical analytics
* Auto save > Explicit save

---

# 🖥️ PRIMARY SCREEN DESIGN

## Consultation Cockpit Layout

```
| Timeline Panel | Medicine Panel | Closure Panel |
```

---

## 🧾 LEFT PANEL — Timeline Memory System

### Functional Requirements

* Reverse chronological visit list
* Infinite scroll
* Row shows:

```
Date — Patient Name — Medicine Summary
```

Example:

```
Mar 12 — Rahul — Bell + Bry
```

* Clicking row loads patient context

### Search Requirements

Single fuzzy search input supporting:

* patient name
* symptom keywords
* medicine names

Search must return ranked recent matches.

Latency target: **<150ms perceived**

---

## 💊 CENTER PANEL — Medicine Cockpit

### Medicine Slot System

Default: 3 slots visible.

```
[M1]  
[M2]  
[M3]  
[+ Add 4th]
```

Each slot contains:

* medicine name
* potency
* remove button

---

### Medicine Selector

Alphabetical grid:

```
A
Ars 30 | Ars 200

B
Bell 30 | Bry 30
```

Requirements:

* continuous scroll
* no pagination
* potency buttons inline
* click potency → fills selected slot

---

### Repeat & Modify Feature (CRITICAL)

When patient loaded:

Display:

```
LAST VISIT
Bell 30
Bry 30
Rhus 30

[ Repeat & Modify ]
```

On click:

* new visit created
* medicines prefilled
* dosage editable
* visit count incremented

---

## 💰 RIGHT PANEL — Closure System

### Payment Entry

Numeric keypad style UI.

Fields:

* Total Fee
* Paid
* Due auto-calculated

Quick toggles:

* Paid Full
* Credit

---

### Visit Metadata

Display:

* Visit Number
* Last Visit Date
* Treatment Duration (computed)

---

## 📝 Notes Field

Optional short free text field.

Not required.

Must not block save.

---

## 💾 Saving Behaviour

* Auto save on any change
* No submit button
* Show subtle “Saved” indicator

---

# 📊 DATA MODEL

## Patient

```
id
name
quick_note
created_at
```

---

## Visit

```
id
patient_id
date
symptoms_text
medicines_json
fee_total
amount_paid
amount_due
visit_number
```

---

## Medicine JSON Structure

```
[
 { name: "Bell", potency: "30" },
 { name: "Bry", potency: "30" }
]
```

---

# 🔍 SEARCH LOGIC REQUIREMENTS

Search must support:

* substring matching
* token matching
* medicine name matching
* symptom keyword matching

Ranking priority:

1. Recent visits
2. Exact name match
3. Medicine match
4. Symptom match

---

# 🔄 MIGRATION STRATEGY

Not bulk.

Lazy migration:

* old patients digitised when they revisit
* high-value chronic cases manually backfilled
* optional camera OCR helper later

---

# ⚙️ NON FUNCTIONAL REQUIREMENTS

### Performance

* screen load <1s
* search response <150ms
* slot fill instant

### Reliability

* offline capable
* no login required v1
* local persistence

### Usability

* large buttons
* high contrast
* minimal typing

---

# 🧪 FIELD TEST PLAN

Day 1:

* install
* shadow consultation

Day 2:

* observe friction
* patch

Day 3:

* check independent usage

Success condition:

Doctor opens system **without reminder.**

