'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navigation as staticNavigation, siteSettings } from '@/content/site'
import { Logo } from '@/components/brand/logo'
import { CtaLink } from '@/components/common/cta-button'

interface NavItem { label: string; href: string }
interface Props {
  solid: boolean
  navItems?: NavItem[]
  /** Current pathname — passed from SiteHeader to avoid duplicate usePathname calls */
  pathname?: string
}

export function MobileNav({ solid, navItems, pathname: pathnameProp }: Props) {
  const navigation = navItems ?? staticNavigation
  const [open, setOpen] = useState(false)
  const routerPathname = usePathname()
  const router = useRouter()
  const pathname = pathnameProp ?? routerPathname
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Same-URL guard: push ?new= token imperatively on click, never during render.
  function handleCtaClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (pathname.startsWith('/rezervace')) {
      e.preventDefault()
      setOpen(false)
      router.push(`/rezervace?new=${Date.now()}`)
    } else {
      setOpen(false)
    }
  }

  // Close on route change
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Escape + scroll lock + initial focus
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Otevřít navigaci"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'inline-flex size-11 items-center justify-center rounded-lg transition-colors lg:hidden',
          solid
            ? 'text-verde-green hover:bg-verde-ivory'
            : 'text-verde-white hover:bg-verde-white/10',
        )}
      >
        <Menu className="size-6" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigační menu"
          className="fixed inset-0 z-[100] lg:hidden"
        >
          {/* Solid full-screen panel — no overlay button, no transparency */}
          <div
            ref={panelRef}
            className="absolute inset-0 flex flex-col bg-verde-white"
            style={{ backgroundColor: '#faf8f2' }}
          >
            {/* Header row */}
            <div className="flex h-18 shrink-0 items-center justify-between border-b border-border px-4">
              <Logo tone="dark" />
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Zavřít navigaci"
                className="inline-flex size-12 items-center justify-center rounded-lg text-verde-green hover:bg-verde-ivory active:bg-verde-ivory"
              >
                <X className="size-6" />
              </button>
            </div>

            {/* Navigation links */}
            <nav
              aria-label="Mobilní navigace"
              className="flex-1 overflow-y-auto px-5 py-4"
            >
              <ul className="flex flex-col" role="list">
                {navigation.map((item) => {
                  const active =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href)
                  return (
                    <li key={item.href} role="listitem">
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex min-h-[52px] items-center rounded-xl px-3 font-serif text-2xl transition-colors',
                          active
                            ? 'bg-verde-ivory text-verde-green'
                            : 'text-verde-deep hover:bg-verde-ivory/70 active:bg-verde-ivory',
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            {/* Footer: CTA + contact */}
            <div className="shrink-0 border-t border-border px-5 py-5">
              <CtaLink
                href="/rezervace"
                size="lg"
                className="w-full justify-center"
                onClick={handleCtaClick}
              >
                Rezervovat pobyt
              </CtaLink>
              <div className="mt-4 flex flex-col gap-1 text-center">
                <a
                  href={siteSettings.contact.phoneHref}
                  className="text-sm text-verde-moss hover:text-verde-green"
                >
                  {siteSettings.contact.phone}
                </a>
                <a
                  href={`mailto:${siteSettings.contact.email}`}
                  className="text-sm text-verde-moss hover:text-verde-green"
                >
                  {siteSettings.contact.email}
                </a>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
