import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'
import { navigation, siteSettings } from '@/content/site'
import { Logo } from '@/components/brand/logo'
import { LeafSprig } from '@/components/brand/leaf-sprig'

export function SiteFooter() {
  const { contact, legalLinks, slogan } = siteSettings
  const year = new Date().getFullYear()

  return (
    <footer className="bg-verde-deep text-verde-white/80">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 border-b border-verde-white/10 pb-12 text-center">
          <LeafSprig className="h-6 w-8 text-verde-white/70" />
          <p className="max-w-xl text-balance font-serif text-2xl text-verde-white sm:text-3xl">
            {slogan}
          </p>
        </div>

        <div className="grid gap-10 py-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-4">
            <Logo tone="light" imgClassName="h-14 w-auto" />
            <p className="text-sm leading-relaxed text-verde-white/70">
              {siteSettings.tagline}. Klidné venkovské zázemí pro vašeho psa
              v okolí {contact.region}.
            </p>
          </div>

          <nav aria-label="Navigace v patičce" className="flex flex-col gap-3">
            <h2 className="label-caps text-verde-white/60">Navigace</h2>
            <ul className="flex flex-col gap-2 text-sm">
              {navigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-verde-white/75 transition-colors hover:text-verde-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-col gap-3">
            <h2 className="label-caps text-verde-white/60">Kontakt</h2>
            <ul className="flex flex-col gap-3 text-sm">
              <li>
                <a
                  href={contact.phoneHref}
                  className="flex items-center gap-2.5 text-verde-white/75 transition-colors hover:text-verde-white"
                >
                  <Phone className="size-4 shrink-0" aria-hidden="true" />
                  {contact.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${contact.email}`}
                  className="flex items-center gap-2.5 text-verde-white/75 transition-colors hover:text-verde-white"
                >
                  <Mail className="size-4 shrink-0" aria-hidden="true" />
                  {contact.email}
                </a>
              </li>
              <li className="flex items-center gap-2.5 text-verde-white/75">
                <MapPin className="size-4 shrink-0" aria-hidden="true" />
                {contact.region}
              </li>
            </ul>
            <div className="mt-2 flex items-center gap-3">
              {contact.instagram ? (
                <a
                  href={contact.instagram}
                  aria-label="Instagram"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-verde-white/20 text-verde-white/75 transition-colors hover:bg-verde-white/10 hover:text-verde-white"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
                  </svg>
                </a>
              ) : null}
              {contact.facebook ? (
                <a
                  href={contact.facebook}
                  aria-label="Facebook"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-verde-white/20 text-verde-white/75 transition-colors hover:bg-verde-white/10 hover:text-verde-white"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
                    <path d="M22 12.06C22 6.48 17.52 2 11.94 2 6.36 2 1.88 6.48 1.88 12.06c0 5.02 3.68 9.19 8.49 9.94v-7.03H7.83v-2.91h2.54V9.85c0-2.51 1.5-3.9 3.79-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.91h-2.34V22c4.81-.75 8.49-4.92 8.49-9.94Z" />
                  </svg>
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h2 className="label-caps text-verde-white/60">Otevírací doba</h2>
            <ul className="flex flex-col gap-2 text-sm text-verde-white/75">
              {contact.openingHours.map((slot) => (
                <li key={slot.days} className="flex justify-between gap-4">
                  <span>{slot.days}</span>
                  <span className="text-verde-white/60">{slot.hours}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-verde-white/10 pt-8 text-xs text-verde-white/55 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {contact.company.name}. Všechna práva vyhrazena.
          </p>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {legalLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="transition-colors hover:text-verde-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  )
}
