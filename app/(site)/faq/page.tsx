import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/common/page-header'
import { FaqAccordion } from '@/components/faq/faq-accordion'
import { ReservationCta } from '@/components/home/reservation-cta'
import { getPublicFaq, getPublicPageSection } from '@/lib/public-data'

export const metadata: Metadata = {
  title: 'Časté dotazy',
  description:
    'Odpovědi na časté dotazy k pobytu ve psím hotelu VERDE — očkování, krmení, léky, příjezd, storno podmínky a další.',
}

export default async function FaqPage() {
  const [items, hero] = await Promise.all([
    getPublicFaq(),
    getPublicPageSection('faq', 'hero'),
  ])

  return (
    <>
      <PageHeader
        eyebrow={(hero?.eyebrow as string) ?? 'Časté dotazy'}
        title={(hero?.headline as string) ?? 'Vše, co potřebujete vědět'}
        description={(hero?.description as string) ?? 'Nenašli jste odpověď na svůj dotaz? Rádi vám poradíme osobně.'}
      />

      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <FaqAccordion items={items} />

          <p className="mt-10 text-center leading-relaxed text-verde-moss">
            Máte další otázky?{' '}
            <Link
              href="/kontakt"
              className="font-medium text-verde-green underline-offset-4 hover:underline"
            >
              Kontaktujte nás
            </Link>
            , rádi vám poradíme.
          </p>
        </div>
      </section>

      <ReservationCta />
    </>
  )
}
