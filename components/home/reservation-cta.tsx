import { Phone, Mail } from 'lucide-react'
import { CtaLink } from '@/components/common/cta-button'
import { LeafSprig } from '@/components/brand/leaf-sprig'
import { siteSettings } from '@/content/site'

export function ReservationCta() {
  const { contact } = siteSettings
  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground sm:px-12 md:py-20">
          <div className="mx-auto flex max-w-2xl flex-col items-center">
            <LeafSprig className="h-5 w-6 text-verde-white/80" />
            <h2 className="mt-5 text-balance font-serif text-3xl font-semibold text-verde-white sm:text-4xl md:text-5xl">
              Zajistěte svému psovi místo ve Verde
            </h2>
            <p className="mt-4 text-pretty leading-relaxed text-verde-white/80">
              Kapacita je omezená, abychom udrželi individuální přístup.
              Nezávazně nám napište termín a my se vám ozveme s potvrzením.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <CtaLink href="/rezervace" variant="light" size="lg">
                Rezervovat pobyt
              </CtaLink>
              <CtaLink href={contact.phoneHref} variant="outlineLight" size="lg">
                <Phone className="size-4" aria-hidden="true" />
                {contact.phone}
              </CtaLink>
            </div>
            <a
              href={`mailto:${contact.email}`}
              className="mt-6 inline-flex items-center gap-2 text-sm text-verde-white/70 transition-colors hover:text-verde-white"
            >
              <Mail className="size-4" aria-hidden="true" />
              {contact.email}
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
