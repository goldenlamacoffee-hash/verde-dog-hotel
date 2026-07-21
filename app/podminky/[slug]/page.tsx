import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/common/page-header'
import { getPublicPageSection } from '@/lib/public-data'

type Section = { heading: string; body: string }
type LegalDoc = { title: string; intro: string; sections: Section[] }

/** Static fallback — used when no DB row exists for this slug */
const staticLegalPages: Record<string, LegalDoc> = {
  obchodni: {
    title: 'Obchodní podmínky',
    intro: 'Tyto obchodní podmínky upravují vztah mezi psím hotelem VERDE a majitelem psa.',
    sections: [
      { heading: 'Předmět', body: 'Poskytnutí ubytování a péče o psa po sjednanou dobu.' },
      { heading: 'Rezervace', body: 'Rezervace je závazná po vzájemném potvrzení termínu a podmínek pobytu.' },
      { heading: 'Platba', body: 'Cena a způsob úhrady jsou stanoveny při potvrzení rezervace.' },
    ],
  },
  'vseobecne-obchodni-podminky': {
    title: 'Všeobecné obchodní podmínky',
    intro: 'Tyto obchodní podmínky upravují smluvní vztah mezi provozovatelem psího hotelu Verde a klientem.',
    sections: [],
  },
  pobyt: {
    title: 'Podmínky pobytu',
    intro: 'Podmínky pobytu stanovují požadavky na psa i majitele před nástupem a v průběhu pobytu.',
    sections: [
      { heading: 'Zdraví a očkování', body: 'Vyžadujeme platné očkování a dobrý zdravotní stav psa.' },
      { heading: 'Informace o psovi', body: 'Majitel poskytuje pravdivé informace o povaze, zvycích a potřebách psa.' },
      { heading: 'Kontakt', body: 'Po celou dobu pobytu je nutný funkční kontakt na majitele.' },
    ],
  },
  storno: {
    title: 'Storno podmínky',
    intro: 'Storno podmínky určují pravidla pro zrušení nebo změnu rezervace.',
    sections: [
      { heading: 'Zrušení rezervace', body: 'Termíny a případné storno poplatky obdržíte při potvrzení rezervace.' },
      { heading: 'Změna termínu', body: 'Změnu termínu řešíme individuálně podle aktuální obsazenosti.' },
    ],
  },
  'osobni-udaje': {
    title: 'Ochrana osobních údajů',
    intro: 'Zásady zpracování osobních údajů popisují, jak nakládáme s vašimi kontaktními a dalšími údaji.',
    sections: [
      { heading: 'Jaké údaje zpracováváme', body: 'Kontaktní údaje majitele a informace nezbytné pro péči o psa.' },
      { heading: 'Účel zpracování', body: 'Zajištění rezervace, komunikace a bezpečné péče o psa.' },
      { heading: 'Vaše práva', body: 'Máte právo na přístup, opravu a výmaz svých osobních údajů.' },
    ],
  },
  'ochrana-osobnich-udaju': {
    title: 'Ochrana osobních údajů',
    intro: 'Zásady zpracování osobních údajů v souladu s GDPR.',
    sections: [],
  },
  cookies: {
    title: 'Cookies',
    intro: 'Informace o používání souborů cookies na tomto webu.',
    sections: [
      { heading: 'Nezbytné cookies', body: 'Zajišťují základní funkčnost webu.' },
      { heading: 'Analytické cookies', body: 'Pomáhají nám rozumět tomu, jak je web používán.' },
    ],
  },
}

export function generateStaticParams() {
  return Object.keys(staticLegalPages).map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const cms = await getPublicPageSection('podminky', slug)
  const staticPage = staticLegalPages[slug]
  const title = (cms?.title as string) ?? staticPage?.title ?? 'Dokument'
  return { title }
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Try DB first, fall back to static JS object
  const cms = await getPublicPageSection('podminky', slug)
  const staticPage = staticLegalPages[slug]

  if (!cms && !staticPage) notFound()

  const title = (cms?.title as string) ?? staticPage!.title
  const intro = (cms?.effective_date as string)
    ? `Platné od ${cms!.effective_date as string}`
    : staticPage?.intro ?? ''
  const sections: Section[] = (cms?.sections as Section[]) ?? staticPage?.sections ?? []

  return (
    <>
      <PageHeader eyebrow="Dokumenty" title={title} description={intro} />
      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8">
            {sections.map((section) => (
              <div key={section.heading} className="flex flex-col gap-2">
                <h2 className="font-serif text-xl font-semibold text-verde-deep">
                  {section.heading}
                </h2>
                <p className="text-pretty leading-relaxed text-verde-moss">{section.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
