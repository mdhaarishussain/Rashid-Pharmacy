// ─── Homeopathic medicine master list ────────────────────────────────────────
// ~150 common homeopathic remedies, alphabetically sorted

export interface Medicine {
  name: string
  abbr: string // short form used on shelf label
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

export const POTENCIES = ['6', '30', '200', '1M', '10M'] as const
export type Potency = (typeof POTENCIES)[number]

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
  { name: 'Calcarea Fluorica', abbr: 'Calc-f' },
  { name: 'Calcarea Phosphorica', abbr: 'Calc-p' },
  { name: 'Calcarea Sulphurica', abbr: 'Calc-s' },
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
  { name: 'Ferrum Phosphoricum', abbr: 'Ferr-p' },
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
  { name: 'Kali Muriaticum', abbr: 'Kali-m' },
  { name: 'Kali Nitricum', abbr: 'Kali-n' },
  { name: 'Kali Phosphoricum', abbr: 'Kali-p' },
  { name: 'Kali Sulphuricum', abbr: 'Kali-s' },
  { name: 'Kreosotum', abbr: 'Kreos' },
  { name: 'Lac Caninum', abbr: 'Lac-c' },
  { name: 'Lachesis Mutus', abbr: 'Lach' },
  { name: 'Ledum Palustre', abbr: 'Led' },
  { name: 'Lilium Tigrinum', abbr: 'Lil-t' },
  { name: 'Lycopodium Clavatum', abbr: 'Lyc' },
  { name: 'Magnesia Carbonica', abbr: 'Mag-c' },
  { name: 'Magnesia Muriatica', abbr: 'Mag-m' },
  { name: 'Magnesia Phosphorica', abbr: 'Mag-p' },
  { name: 'Medorrhinum', abbr: 'Med' },
  { name: 'Mercurius Corrosivus', abbr: 'Merc-c' },
  { name: 'Mercurius Solubilis', abbr: 'Merc' },
  { name: 'Mezereum', abbr: 'Mez' },
  { name: 'Moschus', abbr: 'Mosch' },
  { name: 'Muriaticum Acidum', abbr: 'Mur-ac' },
  { name: 'Natrum Carbonicum', abbr: 'Nat-c' },
  { name: 'Natrum Muriaticum', abbr: 'Nat-m' },
  { name: 'Natrum Phosphoricum', abbr: 'Nat-p' },
  { name: 'Natrum Sulphuricum', abbr: 'Nat-s' },
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
  { name: 'Silicea', abbr: 'Sil' },
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

  // ─── Common tinctures / drops (Mother Tincture base) ──────────────────────
  { name: 'Alfalfa', abbr: 'Alf' },
  { name: 'Avena Sativa', abbr: 'Aven' },
  { name: 'Berberis Aquifolium', abbr: 'Berb-aq' },
  { name: 'Cactus Grandiflorus', abbr: 'Cact' },
  { name: 'Ceanothus Americanus', abbr: 'Cean' },
  { name: 'Chelidonium Majus', abbr: 'Chel' },
  { name: 'Cholesterinum', abbr: 'Chol' },
  { name: 'Crataegus Oxyacantha', abbr: 'Crat' },
  { name: 'Echinacea Angustifolia', abbr: 'Echi' },
  { name: 'Helonias Dioica', abbr: 'Helon' },
  { name: 'Hydrocotyle Asiatica', abbr: 'Hydc' },
  { name: 'Justicia Adhatoda', abbr: 'Just' },
  { name: 'Lycopus Virginicus', abbr: 'Lycp' },
  { name: 'Mitchella Repens', abbr: 'Mitch' },
  { name: 'Mullein Oil', abbr: 'Muln' },
  { name: 'Passiflora Incarnata', abbr: 'Pass' },
  { name: 'Phaseolus Nanus', abbr: 'Phas' },
  { name: 'Rauwolfia Serpentina', abbr: 'Rauw' },
  { name: 'Sarsaparilla Officinalis', abbr: 'Sars' },
  { name: 'Solidago Virgaurea', abbr: 'Solid' },
  { name: 'Thlaspi Bursa Pastoris', abbr: 'Thlsp' },
  { name: 'Tribulus Terrestris', abbr: 'Trib' },
  { name: 'Viburnum Opulus', abbr: 'Vib' },
  { name: 'Withania Somnifera', abbr: 'With' },
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
