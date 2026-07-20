import type { Metadata } from 'next'
import { Mail, MapPin, Phone, Clock, Globe } from 'lucide-react'
import { PageHeader } from '@/components/common/page-header'
import { SectionHeading } from '@/components/common/section-heading'
import { ContactForm } from '@/components/contact/contact-form'
import { LeafSprig } from '@/components/brand/leaf-sprig'
import { siteSettings } from '@/content/site'
import { getPublicPageSection } from '@/lib/public-data'

const { contact, slogan } = siteSettings

export const metadata: Metadata = {
  title: 'Kontakt',
  description:
    'Kontaktujte psí hotel VERDE — telefon, e-mail a lokalita Brno-venkov. Napište nám a rádi vám poradíme s pobytem vašeho psa.',
}

export default async function ContactPage() {
  const hero = await getPublicPageSection('kontakt', 'hero')

  return (
    <>
      <PageHeader
        eyebrow={(hero?.eyebrow as string) ?? 'Kontakt'}
        title={(hero?.headline as string) ?? 'Ozvěte se nám'}
        description={(hero?.description as string) ?? 'Rádi zodpovíme vaše dotazy a domluvíme prohlídku i termín pobytu.'}
      />

      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16 lg:px-8">
          <div className="flex flex-col gap-8">
            <SectionHeading eyebrow="Spojení" title="Kontaktní údaje" withSprig />

            <ul className="flex flex-col gap-5">
              <ContactRow icon={<Phone className="size-5" />} label="Telefon">
                <a href={contact.phoneHref} className="hover:text-verde-green">
                  {contact.phone}
                </a>
              </ContactRow>
              <ContactRow icon={<Mail className="size-5" />} label="E-mail">
                <a href={`mailto:${contact.email}`} className="hover:text-verde-green">
                  {contact.email}
                </a>
              </ContactRow>
              <ContactRow icon={<Globe className="size-5" />} label="Web">
                <span>{contact.web}</span>
              </ContactRow>
              <ContactRow icon={<MapPin className="size-5" />} label="Lokalita">
                <span>{contact.region}</span>
              </ContactRow>
              <ContactRow icon={<Clock className="size-5" />} label="Kdy nás zastihnete">
                <div className="flex flex-col gap-0.5">
                  {contact.openingHours.map((slot) => (
                    <span key={slot.days}>
                      {slot.days}: {slot.hours}
                    </span>
                  ))}
                </div>
              </ContactRow>
            </ul>

            <div className="flex items-center gap-4 rounded-2xl bg-verde-deep p-6 text-verde-white">
              <LeafSprig className="h-6 w-7 shrink-0 text-verde-white/70" />
              <p className="font-serif text-xl font-medium tracking-wide">{slogan}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-6 sm:p-9">
            <h2 className="font-serif text-2xl font-semibold text-verde-deep">Napište nám</h2>
            <p className="mt-2 text-sm leading-relaxed text-verde-moss">
              Vyplňte formulář a my se vám co nejdříve ozveme.
            </p>
            <div className="mt-7">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function ContactRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <li className="flex items-start gap-4">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary text-verde-green">
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="label-caps text-verde-wood">{label}</span>
        <div className="mt-0.5 text-verde-deep">{children}</div>
      </div>
    </li>
  )
}
