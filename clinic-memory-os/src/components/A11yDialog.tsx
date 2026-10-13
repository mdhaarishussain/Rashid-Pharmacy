import type { ReactNode } from 'react'
import { useDialogA11y } from '../hooks/useDialogA11y'

/**
 * The visible panel of a modal: adds role="dialog", aria-modal, a label, initial
 * focus, Escape-to-close, a Tab focus trap and focus restore on close.
 * Overlay/backdrop markup stays with the caller.
 */
export default function A11yDialog({
  onClose,
  labelledBy,
  className,
  children,
  stopClickPropagation = true,
}: {
  onClose: () => void
  labelledBy: string
  className?: string
  children: ReactNode
  stopClickPropagation?: boolean
}) {
  const ref = useDialogA11y<HTMLDivElement>(onClose)
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className={className}
      onClick={stopClickPropagation ? (e) => e.stopPropagation() : undefined}
    >
      {children}
    </div>
  )
}
