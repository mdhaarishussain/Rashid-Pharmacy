// ─── Homeopathic medicine master list ────────────────────────────────────────
// Remedies (~150), Biochemic Tissue Salts (12), Mother Tinctures (24)

export type MedicineType = 'remedy' | 'biochemic' | 'tincture'

export interface Medicine {
  name: string
  abbr: string
  type?: MedicineType // omit = 'remedy' (default)
}

/**
 * Returns a 2-letter practitioner short code from the medicine name.
 * Multi-word names: first letter of each of the first two words → "Nux Vomica" → "NV"
 * Single-word names: first two letters → "Belladonna" → "BE"
 */
export function getShortCode(medicine: Medicine): string {
  const words = medicine.name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return medicine.name.slice(0, 2).toUpperCase()
}

// ─── Potency sets per medicine type ──────────────────────────────────────────

export const REMEDY_POTENCIES = ['6', '30', '200', '1M', '10M'] as const
export const BIOCHEMIC_POTENCIES = ['6x', '12x'] as const
export const TINCTURE_POTENCY = ['Ø'] as const

// Combined type (for backward compat if referenced elsewhere)
export const POTENCIES = [...REMEDY_POTENCIES, ...BIOCHEMIC_POTENCIES, ...TINCTURE_POTENCY] as const
export type Potency = (typeof POTENCIES)[number]

export function getMedicinePotencies(med: Medicine): readonly string[] {
  if (med.type === 'tincture') return TINCTURE_POTENCY
  if (med.type === 'biochemic') return BIOCHEMIC_POTENCIES
  return REMEDY_POTENCIES
}

/** True only for mother tincture potency (Ø). Used to switch qty chips to drops. */
export function isDropPotency(p: string): boolean {
  return p === 'Ø'
}

// ─── Medicine list ────────────────────────────────────────────────────────────

export const MEDICINES: Medicine[] = [
  { name: 'Aconitum Napellus', abbr: 'Acon' },
  { name: 'Aethusa Cynapium', abbr: 'Aeth' },
  { name: 'Allium Cepa', abbr: 'All-c' },
  { name: 'Aloe Socotrina', abbr: 'Aloe' },
  { name: 'Alumina', abbr: 'Alum' },
  { name: 'Ambra Grisea', abbr: 'Ambr' },
  { name: 'Ammonium Carbonicum', abbr: 'Am-c' },
  { name: 'Ammonium Muriaticum', abbr: 'Am-m' },
  { name: 'Anacardium Orientale', abbr: 'Anac' },
  { name: 'Antimonium Crudum', abbr: 'Ant-c' },
  { name: 'Antimonium Tartaricum', abbr: 'Ant-t' },
  { name: 'Apis Mellifica', abbr: 'Apis' },
  { name: 'Argentum Nitricum', abbr: 'Arg-n' },
  { name: 'Arnica Montana', abbr: 'Arn' },
  { name: 'Arsenicum Album', abbr: 'Ars' },
  { name: 'Arsenicum Iodatum', abbr: 'Ars-i' },
  { name: 'Aurum Metallicum', abbr: 'Aur' },
  { name: 'Baptisia Tinctoria', abbr: 'Bapt' },
  { name: 'Baryta Carbonica', abbr: 'Bar-c' },
  { name: 'Belladonna', abbr: 'Bell' },
  { name: 'Berberis Vulgaris', abbr: 'Berb' },
  { name: 'Borax Veneta', abbr: 'Borx' },
  { name: 'Bovista', abbr: 'Bov' },
  { name: 'Bromium', abbr: 'Brom' },
  { name: 'Bryonia Alba', abbr: 'Bry' },
  { name: 'Calcarea Carbonica', abbr: 'Calc' },
  { name: 'Calcarea Fluorica', abbr: 'Calc-f', type: 'biochemic' },
  { name: 'Calcarea Phosphorica', abbr: 'Calc-p', type: 'biochemic' },
  { name: 'Calcarea Sulphurica', abbr: 'Calc-s', type: 'biochemic' },
  { name: 'Calendula Officinalis', abbr: 'Calen' },
  { name: 'Camphora', abbr: 'Camph' },
  { name: 'Cannabis Indica', abbr: 'Cann-i' },
  { name: 'Cantharis Vesicatoria', abbr: 'Canth' },
  { name: 'Capsicum Annuum', abbr: 'Caps' },
  { name: 'Carbo Animalis', abbr: 'Carb-an' },
  { name: 'Carbo Vegetabilis', abbr: 'Carb-v' },
  { name: 'Causticum', abbr: 'Caust' },
  { name: 'Chamomilla', abbr: 'Cham' },
  { name: 'China Officinalis', abbr: 'Chin' },
  { name: 'Cimicifuga Racemosa', abbr: 'Cimic' },
  { name: 'Cina', abbr: 'Cina' },
  { name: 'Clematis Erecta', abbr: 'Clem' },
  { name: 'Cocculus Indicus', abbr: 'Cocc' },
  { name: 'Coffea Cruda', abbr: 'Coff' },
  { name: 'Colchicum Autumnale', abbr: 'Colch' },
  { name: 'Colocynthis', abbr: 'Coloc' },
  { name: 'Conium Maculatum', abbr: 'Con' },
  { name: 'Crocus Sativus', abbr: 'Croc' },
  { name: 'Crotalus Horridus', abbr: 'Crot-h' },
  { name: 'Cuprum Metallicum', abbr: 'Cupr' },
  { name: 'Cyclamen Europaeum', abbr: 'Cycl' },
  { name: 'Digitalis Purpurea', abbr: 'Dig' },
  { name: 'Dioscorea Villosa', abbr: 'Dios' },
  { name: 'Drosera Rotundifolia', abbr: 'Dros' },
  { name: 'Dulcamara', abbr: 'Dulc' },
  { name: 'Eupatorium Perfoliatum', abbr: 'Eup-per' },
  { name: 'Euphrasia Officinalis', abbr: 'Euphr' },
  { name: 'Ferrum Metallicum', abbr: 'Ferr' },
  { name: 'Ferrum Phosphoricum', abbr: 'Ferr-p', type: 'biochemic' },
  { name: 'Five Phos', abbr: '5Phos', type: 'biochemic' },
  { name: 'Fluoricum Acidum', abbr: 'Fl-ac' },
  { name: 'Gelsemium Sempervirens', abbr: 'Gels' },
  { name: 'Glonoinum', abbr: 'Glon' },
  { name: 'Graphites', abbr: 'Graph' },
  { name: 'Hamamelis Virginiana', abbr: 'Ham' },
  { name: 'Hepar Sulphuris', abbr: 'Hep' },
  { name: 'Hydrastis Canadensis', abbr: 'Hydr' },
  { name: 'Hyoscyamus Niger', abbr: 'Hyos' },
  { name: 'Hypericum Perforatum', abbr: 'Hyper' },
  { name: 'Ignatia Amara', abbr: 'Ign' },
  { name: 'Iodum', abbr: 'Iod' },
  { name: 'Ipecacuanha', abbr: 'Ip' },
  { name: 'Iris Versicolor', abbr: 'Iris' },
  { name: 'Kali Bichromicum', abbr: 'Kali-bi' },
  { name: 'Kali Bromatum', abbr: 'Kali-br' },
  { name: 'Kali Carbonicum', abbr: 'Kali-c' },
  { name: 'Kali Iodatum', abbr: 'Kali-i' },
  { name: 'Kali Muriaticum', abbr: 'Kali-m', type: 'biochemic' },
  { name: 'Kali Nitricum', abbr: 'Kali-n' },
  { name: 'Kali Phosphoricum', abbr: 'Kali-p', type: 'biochemic' },
  { name: 'Kali Sulphuricum', abbr: 'Kali-s', type: 'biochemic' },
  { name: 'Kreosotum', abbr: 'Kreos' },
  { name: 'Lac Caninum', abbr: 'Lac-c' },
  { name: 'Lachesis Mutus', abbr: 'Lach' },
  { name: 'Ledum Palustre', abbr: 'Led' },
  { name: 'Lilium Tigrinum', abbr: 'Lil-t' },
  { name: 'Lycopodium Clavatum', abbr: 'Lyc' },
  { name: 'Magnesia Carbonica', abbr: 'Mag-c' },
  { name: 'Magnesia Muriatica', abbr: 'Mag-m' },
  { name: 'Magnesia Phosphorica', abbr: 'Mag-p', type: 'biochemic' },
  { name: 'Medorrhinum', abbr: 'Med' },
  { name: 'Mercurius Corrosivus', abbr: 'Merc-c' },
  { name: 'Mercurius Solubilis', abbr: 'Merc' },
  { name: 'Mezereum', abbr: 'Mez' },
  { name: 'Moschus', abbr: 'Mosch' },
  { name: 'Muriaticum Acidum', abbr: 'Mur-ac' },
  { name: 'Natrum Carbonicum', abbr: 'Nat-c' },
  { name: 'Natrum Muriaticum', abbr: 'Nat-m', type: 'biochemic' },
  { name: 'Natrum Phosphoricum', abbr: 'Nat-p', type: 'biochemic' },
  { name: 'Natrum Sulphuricum', abbr: 'Nat-s', type: 'biochemic' },
  { name: 'Nitricum Acidum', abbr: 'Nit-ac' },
  { name: 'Nux Moschata', abbr: 'Nux-m' },
  { name: 'Nux Vomica', abbr: 'Nux-v' },
  { name: 'Opium', abbr: 'Op' },
  { name: 'Petroleum', abbr: 'Petr' },
  { name: 'Phosphoricum Acidum', abbr: 'Ph-ac' },
  { name: 'Phosphorus', abbr: 'Phos' },
  { name: 'Phytolacca Decandra', abbr: 'Phyt' },
  { name: 'Platina', abbr: 'Plat' },
  { name: 'Plumbum Metallicum', abbr: 'Plb' },
  { name: 'Podophyllum Peltatum', abbr: 'Podo' },
  { name: 'Psorinum', abbr: 'Psor' },
  { name: 'Pulsatilla Nigricans', abbr: 'Puls' },
  { name: 'Pyrogenium', abbr: 'Pyrog' },
  { name: 'Ranunculus Bulbosus', abbr: 'Ran-b' },
  { name: 'Rheum Officinale', abbr: 'Rheum' },
  { name: 'Rhododendron Chrysanthum', abbr: 'Rhod' },
  { name: 'Rhus Toxicodendron', abbr: 'Rhus-t' },
  { name: 'Rumex Crispus', abbr: 'Rumx' },
  { name: 'Ruta Graveolens', abbr: 'Ruta' },
  { name: 'Sabadilla', abbr: 'Sabad' },
  { name: 'Sabal Serrulata', abbr: 'Sabal' },
  { name: 'Sambucus Nigra', abbr: 'Samb' },
  { name: 'Sanguinaria Canadensis', abbr: 'Sang' },
  { name: 'Secale Cornutum', abbr: 'Sec' },
  { name: 'Selenium', abbr: 'Sel' },
  { name: 'Sepia Officinalis', abbr: 'Sep' },
  { name: 'Silicea', abbr: 'Sil', type: 'biochemic' },
  { name: 'Spigelia Anthelmia', abbr: 'Spig' },
  { name: 'Spongia Tosta', abbr: 'Spong' },
  { name: 'Squilla Maritima', abbr: 'Squil' },
  { name: 'Stannum Metallicum', abbr: 'Stann' },
  { name: 'Staphysagria', abbr: 'Staph' },
  { name: 'Stramonium', abbr: 'Stram' },
  { name: 'Sulphur', abbr: 'Sulph' },
  { name: 'Sulphuricum Acidum', abbr: 'Sul-ac' },
  { name: 'Syphilinum', abbr: 'Syph' },
  { name: 'Tabacum', abbr: 'Tab' },
  { name: 'Tarentula Hispanica', abbr: 'Tarent' },
  { name: 'Tellurium', abbr: 'Tell' },
  { name: 'Thuja Occidentalis', abbr: 'Thuj' },
  { name: 'Tuberculinum', abbr: 'Tub' },
  { name: 'Urtica Urens', abbr: 'Urt-u' },
  { name: 'Ustilago Maidis', abbr: 'Ust' },
  { name: 'Valeriana Officinalis', abbr: 'Valer' },
  { name: 'Veratrum Album', abbr: 'Verat' },
  { name: 'Verbascum Thapsus', abbr: 'Verb' },
  { name: 'Viscum Album', abbr: 'Visc' },
  { name: 'Zincum Metallicum', abbr: 'Zinc' },

  // ─── Mother Tinctures (Ø — dosage in drops) ──────────────────────────────
  { name: 'Alfalfa', abbr: 'Alf', type: 'tincture' },
  { name: 'Avena Sativa', abbr: 'Aven', type: 'tincture' },
  { name: 'Berberis Aquifolium', abbr: 'Berb-aq', type: 'tincture' },
  { name: 'Cactus Grandiflorus', abbr: 'Cact', type: 'tincture' },
  { name: 'Ceanothus Americanus', abbr: 'Cean', type: 'tincture' },
  { name: 'Chelidonium Majus', abbr: 'Chel', type: 'tincture' },
  { name: 'Cholesterinum', abbr: 'Chol', type: 'tincture' },
  { name: 'Crataegus Oxyacantha', abbr: 'Crat', type: 'tincture' },
  { name: 'Echinacea Angustifolia', abbr: 'Echi', type: 'tincture' },
  { name: 'Helonias Dioica', abbr: 'Helon', type: 'tincture' },
  { name: 'Hydrocotyle Asiatica', abbr: 'Hydc', type: 'tincture' },
  { name: 'Justicia Adhatoda', abbr: 'Just', type: 'tincture' },
  { name: 'Lycopus Virginicus', abbr: 'Lycp', type: 'tincture' },
  { name: 'Mitchella Repens', abbr: 'Mitch', type: 'tincture' },
  { name: 'Mullein Oil', abbr: 'Muln', type: 'tincture' },
  { name: 'Passiflora Incarnata', abbr: 'Pass', type: 'tincture' },
  { name: 'Phaseolus Nanus', abbr: 'Phas', type: 'tincture' },
  { name: 'Rauwolfia Serpentina', abbr: 'Rauw', type: 'tincture' },
  { name: 'Sarsaparilla Officinalis', abbr: 'Sars', type: 'tincture' },
  { name: 'Solidago Virgaurea', abbr: 'Solid', type: 'tincture' },
  { name: 'Thlaspi Bursa Pastoris', abbr: 'Thlsp', type: 'tincture' },
  { name: 'Tribulus Terrestris', abbr: 'Trib', type: 'tincture' },
  { name: 'Viburnum Opulus', abbr: 'Vib', type: 'tincture' },
  { name: 'Withania Somnifera', abbr: 'With', type: 'tincture' },
]

// Pre-built alphabetical groups for the shelf display
export interface MedicineGroup {
  letter: string
  medicines: Medicine[]
}

export const MEDICINE_GROUPS: MedicineGroup[] = (() => {
  const groups = new Map<string, Medicine[]>()
  for (const m of MEDICINES) {
    const letter = m.name[0].toUpperCase()
    if (!groups.has(letter)) groups.set(letter, [])
    groups.get(letter)!.push(m)
  }
  const result: MedicineGroup[] = []
  const sortedLetters = [...groups.keys()].sort()
  for (const letter of sortedLetters) {
    result.push({ letter, medicines: groups.get(letter)! })
  }
  return result
})()

// Flat row model for virtualized list
export type ShelfRow =
  | { type: 'header'; letter: string }
  | { type: 'medicine'; medicine: Medicine }

export const SHELF_ROWS: ShelfRow[] = (() => {
  const rows: ShelfRow[] = []
  for (const g of MEDICINE_GROUPS) {
    rows.push({ type: 'header', letter: g.letter })
    for (const m of g.medicines) {
      rows.push({ type: 'medicine', medicine: m })
    }
  }
  return rows
})()
