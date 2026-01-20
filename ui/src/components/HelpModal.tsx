/**
 * Help Modal
 *
 * Lightweight, reusable modal for detailed "what is this?" explanations.
 */

import { X } from 'lucide-react'
import type { ReactNode } from 'react'

interface HelpModalProps {
  isOpen: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

export function HelpModal({ isOpen, title, onClose, children }: HelpModalProps) {
  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} aria-hidden="true" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="
            relative bg-white
            border-4 border-[var(--color-neo-border)]
            shadow-[8px_8px_0px_rgba(0,0,0,1)]
            max-w-3xl w-full
          "
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="flex items-start justify-between gap-4 p-5 border-b-2 border-[var(--color-neo-border)]">
            <div>
              <div className="font-display font-bold text-xl">{title}</div>
              <div className="text-sm text-[var(--color-neo-text-secondary)]">Quick context, no mystery toggles.</div>
            </div>
            <button onClick={onClose} className="neo-btn neo-btn-ghost p-2" aria-label="Close">
              <X size={22} />
            </button>
          </div>

          <div className="p-5 overflow-y-auto max-h-[70vh]">{children}</div>
        </div>
      </div>
    </>
  )
}

