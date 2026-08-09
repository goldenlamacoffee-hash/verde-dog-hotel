'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

/**
 * Secondary action on the Contact page location block.
 * Copies the full plain-text address to the clipboard. Purely enhancement —
 * the primary "Zobrazit v Google Maps" button is the main call to action.
 */
export function CopyAddressButton({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API unavailable (unsupported browser / permissions) — no-op
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-verde-deep transition-colors hover:bg-secondary"
    >
      {copied ? (
        <>
          <Check className="size-4" aria-hidden="true" />
          Zkopírováno
        </>
      ) : (
        <>
          <Copy className="size-4" aria-hidden="true" />
          Zkopírovat adresu
        </>
      )}
    </button>
  )
}
