import { cn } from '@/lib/utils'

/** Small two-leaf sprig used as a brand divider / accent (matches the VERDE mark). */
export function LeafSprig({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 44 40"
      fill="none"
      aria-hidden="true"
      className={cn('h-5 w-6', className)}
    >
      {/* stem */}
      <path
        d="M22 39C22 30 22 24 22 20"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* left leaf */}
      <path
        d="M22 21C15 21 8 17 5 8c9-2 16 3 17 13Z"
        fill="currentColor"
      />
      {/* right leaf */}
      <path
        d="M22 21c7 0 14-4 17-13-9-2-16 3-17 13Z"
        fill="currentColor"
      />
    </svg>
  )
}
