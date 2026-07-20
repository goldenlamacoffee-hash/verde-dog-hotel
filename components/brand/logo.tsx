import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { siteSettings } from '@/content/site'

interface LogoProps {
  /** color variant: `dark` = green mark for light backgrounds, `light` = cream mark for dark backgrounds */
  tone?: 'dark' | 'light'
  /** preload the image (use for the above-the-fold header logo) */
  priority?: boolean
  /** classes applied to the <img> — override to resize (defaults to h-11 sm:h-12) */
  imgClassName?: string
  className?: string
}

const LOGO_SRC = {
  dark: '/images/verde-logo-green.png',
  light: '/images/verde-logo-cream.png',
} as const

// Intrinsic size of the trimmed lockup assets
const LOGO_W = 1111
const LOGO_H = 658

/**
 * Primary VERDE logo — engraved wirehaired-pointer head + serif wordmark.
 * Rendered from transparent-background assets so it sits cleanly on any surface.
 */
export function Logo({
  tone = 'dark',
  priority = false,
  imgClassName,
  className,
}: LogoProps) {
  return (
    <Link
      href="/"
      aria-label={`${siteSettings.name} — ${siteSettings.tagline}`}
      className={cn('inline-flex items-center', className)}
    >
      <Image
        src={LOGO_SRC[tone]}
        alt=""
        width={LOGO_W}
        height={LOGO_H}
        priority={priority}
        className={cn('h-11 w-auto sm:h-12', imgClassName)}
      />
    </Link>
  )
}
