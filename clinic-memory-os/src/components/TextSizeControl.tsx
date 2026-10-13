import { useState } from 'react'
import {
  TEXT_SIZES,
  applyTextSize,
  loadTextSize,
  saveTextSize,
  type TextSize,
} from '../services/textSize'

const LABELS: Record<TextSize, string> = {
  A: 'A, normal text size',
  'A+': 'A+, large text size',
  'A++': 'A++, extra large text size',
}

const GLYPH_CLS: Record<TextSize, string> = {
  A: 'text-sm',
  'A+': 'text-base',
  'A++': 'text-lg',
}

/** Compact A / A+ / A++ segmented control for the header. */
export default function TextSizeControl() {
  const [size, setSize] = useState<TextSize>(() => loadTextSize())

  const choose = (next: TextSize) => {
    setSize(next)
    applyTextSize(next)
    saveTextSize(next)
  }

  return (
    <div
      role="group"
      aria-label="Text size"
      className="flex shrink-0 rounded-lg border border-border overflow-hidden bg-card"
    >
      {TEXT_SIZES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => choose(s)}
          aria-pressed={size === s}
          aria-label={LABELS[s]}
          title={LABELS[s]}
          className={`min-w-[2.5rem] px-2 py-2 font-bold leading-none transition-colors ${GLYPH_CLS[s]} ${
            size === s ? 'bg-accent text-panel' : 'text-muted hover:text-accent'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  )
}
