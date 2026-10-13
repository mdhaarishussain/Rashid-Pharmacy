import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { MedicineEntry } from '../db/db'
import {
  buildSlip,
  SLIP_LANGS,
  toWhatsAppText,
  whatsAppUrl,
  type Slip,
  type SlipLang,
} from '../services/prescription'
import {
  getClinicSettings,
  saveClinicSettings,
  type ClinicSettings,
  type PaperSize,
} from '../services/clinicSettings'
import './prescriptionSlip.css'

interface Props {
  patientName: string
  medicines: MedicineEntry[]
  date: number // unix ms shown on the slip
  phone?: string // patient's phone (for WhatsApp)
  nextVisit?: number | null // unix ms
  onClose: () => void
}

// ─── Slip preview (this exact element is what prints) ───────────────────────

function SlipView({ slip, paper }: { slip: Slip; paper: PaperSize }) {
  return (
    <div
      id="rx-slip"
      className={`rx-slip ${paper === 'a5' ? 'rx-a5' : 'rx-thermal'}`}
      dir={slip.dir}
      lang={slip.lang}
    >
      <div className="rx-head">
        {slip.clinicName && <div className="rx-clinic">{slip.clinicName}</div>}
        {slip.doctorName && <div className="rx-sub">{slip.doctorName}</div>}
        {slip.address && <div className="rx-sub">{slip.address}</div>}
        {slip.phone && <div className="rx-sub" dir="ltr">{slip.phone}</div>}
      </div>
      <div className="rx-meta">
        <span><b>{slip.labels.patient}:</b> {slip.patientName}</span>
        <span><b>{slip.labels.date}:</b> {slip.dateText}</span>
      </div>
      <div className="rx-rx" dir="ltr" style={{ textAlign: slip.dir === 'rtl' ? 'right' : 'left' }}>℞</div>
      <ol className="rx-list">
        {slip.lines.map((l, i) => (
          <li key={i} className="rx-item">
            <span className="rx-num" dir="ltr">{i + 1}.</span>
            <span>
              <span className="rx-name" dir="ltr" style={{ unicodeBidi: 'isolate' }}>
                {l.name}{l.potency ? ` ${l.potency}` : ''}
              </span>
              {l.instruction && <div className="rx-instr">{l.instruction}</div>}
            </span>
          </li>
        ))}
      </ol>
      {slip.nextVisitText && (
        <div className="rx-next">{slip.labels.nextVisit}: {slip.nextVisitText}</div>
      )}
      <div className="rx-foot">{slip.footer}</div>
    </div>
  )
}

// ─── Dialog ──────────────────────────────────────────────────────────────────

const segBtn = (active: boolean) =>
  'px-4 py-3 text-base font-bold border transition-colors min-w-[64px] ' +
  (active ? 'bg-accent text-panel border-accent' : 'bg-panel text-primary border-border hover:border-accent')

const actionBtn =
  'flex-1 min-w-[110px] py-3.5 rounded-xl text-base font-bold shadow-sm transition-colors'

export default function PrescriptionSlip({ patientName, medicines, date, phone, nextVisit, onClose }: Props) {
  const [settings, setSettings] = useState<ClinicSettings>(() => getClinicSettings())
  const [lang, setLang] = useState<SlipLang>(settings.defaultLanguage)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const slip = useMemo(
    () => buildSlip({ clinic: settings, patientName, date, medicines, nextVisit, lang }),
    [settings, patientName, date, medicines, nextVisit, lang],
  )

  // Mount-only: focus first control, close on Escape, restore focus on close
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.querySelector<HTMLElement>('button')?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current() }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [])

  const update = (patch: Partial<ClinicSettings>) => setSettings(saveClinicSettings(patch))

  const chooseLang = (l: SlipLang) => {
    setLang(l)
    update({ defaultLanguage: l }) // remember the last choice
  }

  const text = () => toWhatsAppText(slip)
  const sendWhatsApp = () => window.open(whatsAppUrl(phone, text()), '_blank', 'noopener')
  const share = () => {
    navigator.share({ title: `${slip.clinicName} – ${slip.labels.title}`, text: text() }).catch(() => {
      /* user cancelled the share sheet */
    })
  }

  const pageCss =
    settings.paper === 'a5'
      ? '@page { size: A5 portrait; margin: 8mm; }'
      : '@page { margin: 3mm; }' // paper size comes from the roll-printer driver (browsers reject "80mm auto")

  const field = (label: string, key: 'clinicName' | 'doctorName' | 'address' | 'phone', type = 'text') => (
    <label className="block">
      <span className="text-sm font-semibold text-muted">{label}</span>
      <input
        type={type}
        value={settings[key]}
        onChange={(e) => update({ [key]: e.target.value })}
        className="mt-1 w-full bg-surface border border-border rounded-lg px-3 py-3 text-base text-primary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
    </label>
  )

  return createPortal(
    <div id="rx-overlay" className="fixed inset-0 z-[90] flex items-center justify-center" onClick={onClose}>
      <style>{`@media print { ${pageCss} }`}</style>
      <div className="rx-no-print absolute inset-0 bg-primary/60 backdrop-blur-sm" />
      <div
        id="rx-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rx-title"
        className="relative z-10 bg-panel rounded-2xl border border-border shadow-2xl w-full max-w-3xl mx-4 max-h-[94vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rx-no-print flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 id="rx-title" className="text-lg font-bold text-primary">Prescription slip</h2>
          <button
            onClick={onClose}
            className="text-base font-semibold text-muted hover:text-primary px-4 py-2.5 rounded-lg border border-border"
          >
            Close
          </button>
        </div>

        <div id="rx-scroll" className="overflow-y-auto flex-1 px-5 py-4 bg-card">
          <div className="rx-no-print flex flex-wrap items-center gap-x-6 gap-y-3 mb-4">
            <div role="group" aria-label="Language" className="inline-flex rounded-xl overflow-hidden">
              {SLIP_LANGS.map((l) => (
                <button key={l.code} aria-pressed={lang === l.code} onClick={() => chooseLang(l.code)} className={segBtn(lang === l.code)}>
                  {l.label}
                </button>
              ))}
            </div>
            <div role="group" aria-label="Paper size" className="inline-flex rounded-xl overflow-hidden">
              <button aria-pressed={settings.paper === 'a5'} onClick={() => update({ paper: 'a5' })} className={segBtn(settings.paper === 'a5')}>
                A5
              </button>
              <button aria-pressed={settings.paper === 'thermal'} onClick={() => update({ paper: 'thermal' })} className={segBtn(settings.paper === 'thermal')}>
                80mm
              </button>
            </div>
          </div>

          <div className="rx-frame-outer overflow-x-auto">
            <div className="rx-frame shadow-md border border-border w-fit max-w-full mx-auto bg-white">
              <SlipView slip={slip} paper={settings.paper} />
            </div>
          </div>

          <div className="rx-no-print mt-4">
            <button
              onClick={() => setDetailsOpen((o) => !o)}
              aria-expanded={detailsOpen}
              aria-controls="rx-details"
              className="text-base font-semibold text-accent hover:underline py-2"
            >
              {detailsOpen ? '▾' : '▸'} Clinic details
            </button>
            {detailsOpen && (
              <div id="rx-details" className="mt-2 grid gap-3 sm:grid-cols-2 bg-panel border border-border rounded-xl p-4">
                {field('Clinic name', 'clinicName')}
                {field('Doctor name', 'doctorName')}
                {field('Address', 'address')}
                {field('Phone', 'phone', 'tel')}
              </div>
            )}
          </div>
        </div>

        <div className="rx-no-print flex flex-wrap gap-3 px-5 py-4 border-t border-border">
          <button onClick={() => window.print()} className={`${actionBtn} bg-accent hover:bg-accent-hover text-panel`}>
            Print
          </button>
          <button onClick={sendWhatsApp} className={`${actionBtn} bg-success hover:opacity-90 text-panel`}>
            WhatsApp{phone ? '' : ' (pick contact)'}
          </button>
          {canShare && (
            <button onClick={share} className={`${actionBtn} bg-panel border-2 border-accent text-accent hover:bg-accent/10`}>
              Share
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
