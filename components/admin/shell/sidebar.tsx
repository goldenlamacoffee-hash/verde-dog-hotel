'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  {
    group: 'Přehled',
    items: [
      { href: '/admin', label: 'Dashboard', icon: GridIcon, exact: true },
    ],
  },
  {
    group: 'Provoz',
    items: [
      { href: '/admin/rezervace', label: 'Rezervace', icon: CalendarIcon },
      { href: '/admin/zakaznici', label: 'Zákazníci', icon: UsersIcon },
      { href: '/admin/psi', label: 'Psi', icon: DogIcon },
      { href: '/admin/kapacita', label: 'Kapacita', icon: BoxIcon },
    ],
  },
  {
    group: 'Obsah webu',
    items: [
      { href: '/admin/sluzby', label: 'Služby & Ceník', icon: TagIcon },
      { href: '/admin/faq', label: 'FAQ', icon: HelpIcon },
      { href: '/admin/recenze', label: 'Recenze', icon: StarIcon },
      { href: '/admin/galerie', label: 'Galerie', icon: ImageIcon },
      { href: '/admin/obsah', label: 'Nastavení webu', icon: SettingsIcon },
    ],
  },
  {
    group: 'Systém',
    items: [
      { href: '/admin/uzivatele', label: 'Uživatelé', icon: ShieldIcon },
      { href: '/admin/audit', label: 'Audit log', icon: AuditIcon },
    ],
  },
]

interface SidebarProps { userRole: string }

export function AdminSidebar({ userRole }: SidebarProps) {
  const pathname = usePathname()

  function isActive(href: string, exact?: boolean) {
    return exact ? pathname === href : pathname.startsWith(href)
  }

  return (
    <aside
      className="hidden lg:flex flex-col w-60 shrink-0 min-h-screen"
      style={{ background: 'var(--admin-sidebar)', borderRight: '1px solid var(--admin-sidebar-border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid var(--admin-sidebar-border)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/verde-logo-cream.png" alt="VERDE" className="h-8 w-auto" />
        <span className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--admin-sidebar-text-muted)' }}>
          Admin
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {NAV.map(section => (
          <div key={section.group}>
            <p className="px-2 mb-1 text-[10px] font-semibold uppercase tracking-widest"
               style={{ color: 'var(--admin-sidebar-text-muted)' }}>
              {section.group}
            </p>
            <ul className="space-y-0.5">
              {section.items.map(item => {
                const active = isActive(item.href, item.exact)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
                      style={{
                        background: active ? 'var(--admin-sidebar-active)' : 'transparent',
                        color: active ? '#fff' : 'var(--admin-sidebar-text)',
                      }}
                    >
                      <item.icon className="w-4 h-4 shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--admin-sidebar-border)' }}>
        <Link
          href="/"
          className="flex items-center gap-2 text-xs transition-colors"
          style={{ color: 'var(--admin-sidebar-text-muted)' }}
          target="_blank"
        >
          <ExternalLinkIcon className="w-3.5 h-3.5" />
          Zobrazit web
        </Link>
      </div>
    </aside>
  )
}

// ─── Inline icons (lucide-compatible SVGs) ────────────────────────────────────
function GridIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
}
function CalendarIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function UsersIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/><path d="M16 3.13a4 4 0 010 7.75"/><path d="M21 21v-2a4 4 0 00-3-3.87"/></svg>
}
function DogIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path d="M10 5.172C10 3.37 8.84 2 7.5 2H5C3.9 2 3 2.9 3 4v2c0 .55.45 1 1 1h1l1.5 2"/><path d="M14 5.172C14 3.37 15.16 2 16.5 2H19c1.1 0 2 .9 2 2v2c0 .55-.45 1-1 1h-1l-1.5 2"/><path d="M8 9h8l1 6H7z"/><path d="M9 15v5"/><path d="M15 15v5"/></svg>
}
function BoxIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
}
function TagIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
}
function HelpIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}
function StarIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
}
function ImageIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
}
function SettingsIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
}
function ShieldIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
}
function AuditIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
}
function ExternalLinkIcon(p: React.SVGProps<SVGSVGElement>) {
  return <svg {...p} fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
}
