import { beforeEach, describe, expect, it } from 'vitest'
import {
  TEXT_SIZE_KEY,
  TEXT_SIZE_PERCENT,
  applyTextSize,
  isTextSize,
  loadTextSize,
  saveTextSize,
} from './textSize'

describe('textSize', () => {
  beforeEach(() => localStorage.clear())

  it('defaults to A when nothing is stored', () => {
    expect(loadTextSize()).toBe('A')
  })

  it('round-trips every option', () => {
    for (const size of ['A', 'A+', 'A++'] as const) {
      expect(saveTextSize(size)).toBe(true)
      expect(loadTextSize()).toBe(size)
    }
  })

  it('ignores invalid stored values', () => {
    localStorage.setItem(TEXT_SIZE_KEY, '300%')
    expect(loadTextSize()).toBe('A')
    expect(isTextSize('A+')).toBe(true)
    expect(isTextSize('big')).toBe(false)
  })

  it('does not throw when storage is blocked', () => {
    const original = globalThis.localStorage
    globalThis.localStorage = {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    } as unknown as Storage
    try {
      expect(loadTextSize()).toBe('A')
      expect(saveTextSize('A++')).toBe(false)
    } finally {
      globalThis.localStorage = original
    }
  })

  it('maps sizes to 100% / 112.5% / 125% on the root element', () => {
    const root = { style: { fontSize: '' } } as unknown as HTMLElement
    applyTextSize('A+', root)
    expect(root.style.fontSize).toBe('112.5%')
    applyTextSize('A++', root)
    expect(root.style.fontSize).toBe(TEXT_SIZE_PERCENT['A++'])
    applyTextSize('A', root)
    expect(root.style.fontSize).toBe('100%')
  })
})
