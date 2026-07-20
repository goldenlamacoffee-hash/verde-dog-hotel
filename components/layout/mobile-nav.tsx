'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { navigation as staticNavigation, siteSettings } from '@/content/site'
import { Logo } from '@/components/brand/logo'
import { CtaLink } from '@/components/common/cta-button'

interface NavItem { label: string; href: string }
interface Props { solid: boolean; navItems?: NavItem[] }

export function MobileNav({ solid, navItems }: Props) {
  const navigation = navItems ?? staticNavigation
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

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
        aria-label="Otevřít menu"
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
          className="fixed inset-0 z-[60] lg:hidden"
        >
          <button
            type="button"
            aria-label="Zavřít menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-verde-deep/40 backdrop-blur-sm"
          />
          <div
            ref={panelRef}
            className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-verde-white shadow-2xl"
          >
            <div className="flex h-18 items-center justify-between border-b border-border px-4">
              <Logo tone="dark" />
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Zavřít menu"
                className="inline-flex size-11 items-center justify-center rounded-lg text-verde-green hover:bg-verde-ivory"
              >
                <X className="size-6" />
              </button>
            </div>

            <nav
              aria-label="Mobilní navigace"
              className="flex-1 overflow-y-auto px-4 py-6"
            >
              <ul className="flex flex-col gap-1">
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
                          'block rounded-lg px-3 py-3 font-serif text-xl transition-colors',
                          active
                            ? 'bg-verde-ivory text-verde-green'
                            : 'text-verde-deep hover:bg-verde-ivory/60',
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </nav>

            <div className="border-t border-border p-4">
              <CtaLink href="/rezervace" size="lg" className="w-full">
                Rezervovat pobyt
              </CtaLink>
              <a
                href={siteSettings.contact.phoneHref}
                className="mt-3 block text-center text-sm text-verde-moss hover:text-verde-green"
              >
                {siteSettings.contact.phone}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
