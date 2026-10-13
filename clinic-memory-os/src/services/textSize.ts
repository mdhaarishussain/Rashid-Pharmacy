// Text-size preference (A / A+ / A++). Scales the root font-size so every
// rem-based Tailwind size grows with it. Stored per device in localStorage.

export type TextSize = 'A' | 'A+' | 'A++'

export const TEXT_SIZE_KEY = 'clinic_os_text_size'
export const TEXT_SIZES: readonly TextSize[] = ['A', 'A+', 'A++']

/** Root font-size for each option. Keep in sync with the inline script in index.html. */
export const TEXT_SIZE_PERCENT: Record<TextSize, string> = {
  A: '100%',
  'A+': '112.5%',
  'A++': '125%',
}

export function isTextSize(value: unknown): value is TextSize {
  return typeof value === 'string' && (TEXT_SIZES as readonly string[]).includes(value)
}

/** Read the saved size; falls back to 'A' when missing, invalid or storage is blocked. */
export function loadTextSize(): TextSize {
  try {
    const raw = localStorage.getItem(TEXT_SIZE_KEY)
    return isTextSize(raw) ? raw : 'A'
  } catch {
    return 'A'
  }
}

/** Persist the size. Returns false (without throwing) when storage is unavailable. */
export function saveTextSize(size: TextSize): boolean {
  try {
    localStorage.setItem(TEXT_SIZE_KEY, size)
    return true
  } catch {
    return false
  }
}

/** Apply the size to the document root. */
export function applyTextSize(size: TextSize, root: HTMLElement = document.documentElement): void {
  root.style.fontSize = TEXT_SIZE_PERCENT[size]
}
