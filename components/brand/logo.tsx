import Link from 'next/link'
import { cn } from '@/lib/utils'
import { siteSettings } from '@/content/site'
import { LeafSprig } from './leaf-sprig'

interface LogoProps {
  /** color variant: dark for light backgrounds, light for dark backgrounds */
  tone?: 'dark' | 'light'
  /** show the "Psí hotel v srdci přírody" tagline under the wordmark */
  withTagline?: boolean
  className?: string
}

/**
 * Refined text-only VERDE wordmark with a small leaf sprig.
 * TODO(brand): replace with the supplied /brand/verde-logo-primary.svg when available.
 */
export function Logo({ tone = 'dark', withTagline = false, className }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label={`${siteSettings.name} — ${siteSettings.tagline}`}
      className={cn(
        'group inline-flex flex-col items-center leading-none',
        tone === 'light' ? 'text-verde-white' : 'text-verde-green',
        className,
      )}
    >
      <span className="font-serif text-2xl font-semibold uppercase tracking-[0.22em] sm:text-3xl">
        Verde
      </span>
      {withTagline ? (
        <span className="mt-1.5 flex items-center gap-2">
          <span
            className={cn(
              'h-px w-6',
              tone === 'light' ? 'bg-verde-white/50' : 'bg-verde-green/40',
            )}
          />
          <LeafSprig className="h-3.5 w-4" />
          <span
            className={cn(
              'h-px w-6',
              tone === 'light' ? 'bg-verde-white/50' : 'bg-verde-green/40',
            )}
          />
        </span>
      ) : null}
      {withTagline ? (
        <span className="mt-1 text-[0.6rem] font-medium uppercase tracking-[0.28em] opacity-80">
          {siteSettings.tagline}
        </span>
      ) : null}
    </Link>
  )
}
