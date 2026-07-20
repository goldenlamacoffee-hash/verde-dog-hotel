'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { navigation as staticNavigation } from '@/content/site'
import { Logo } from '@/components/brand/logo'
import { CtaLink } from '@/components/common/cta-button'
import { MobileNav } from './mobile-nav'

interface NavItem { label: string; href: string }

interface Props {
  /** CMS-provided nav items; falls back to static navigation when undefined */
  navItems?: NavItem[]
  /** CMS-provided CTA label */
  ctaLabel?: string
}

export function SiteHeader({ navItems, ctaLabel }: Props) {
  const navigation = navItems ?? staticNavigation
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const solid = scrolled

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        solid
          ? 'border-b border-border bg-verde-white/95 backdrop-blur-sm'
          : 'border-b border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo tone={solid ? 'dark' : 'light'} priority />

        <nav aria-label="Hlavní navigace" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {navigation.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      solid
                        ? 'text-verde-moss hover:text-verde-green'
                        : 'text-verde-white/85 hover:text-verde-white',
                      active && (solid ? 'text-verde-green' : 'text-verde-white'),
                    )}
                  >
                    {item.label}
                    {active ? (
                      <span
                        className={cn(
                          'absolute inset-x-3 -bottom-0.5 h-px',
                          solid ? 'bg-verde-green' : 'bg-verde-white',
                        )}
                      />
                    ) : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <CtaLink
            href="/rezervace"
            size="md"
            variant={solid ? 'primary' : 'light'}
            className="hidden sm:inline-flex"
          >
            {ctaLabel ?? 'Rezervovat pobyt'}
          </CtaLink>
          <MobileNav solid={solid} navItems={navigation} />
        </div>
      </div>
    </header>
  )
}
