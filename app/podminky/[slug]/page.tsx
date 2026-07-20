import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/common/page-header'
import { siteSettings } from '@/content/site'

const legalPages: Record<string, { title: string; intro: string; sections: { heading: string; body: string }[] }> = {
  obchodni: {
    title: 'Obchodní podmínky',
    intro:
      'Tyto obchodní podmínky upravují vztah mezi psím hotelem VERDE a majitelem psa. Konkrétní znění bude doplněno provozovatelem.',
    sections: [
      { heading: 'Předmět', body: 'Poskytnutí ubytování a péče o psa po sjednanou dobu.' },
      { heading: 'Rezervace', body: 'Rezervace je závazná po vzájemném potvrzení termínu a podmínek pobytu.' },
      { heading: 'Platba', body: 'Cena a způsob úhrady jsou stanoveny při potvrzení rezervace.' },
    ],
  },
  pobyt: {
    title: 'Podmínky pobytu',
    intro:
      'Podmínky pobytu stanovují požadavky na psa i majitele před nástupem a v průběhu pobytu.',
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
    intro:
      'Zásady zpracování osobních údajů popisují, jak nakládáme s vašimi kontaktními a dalšími údaji.',
    sections: [
      { heading: 'Jaké údaje zpracováváme', body: 'Kontaktní údaje majitele a informace nezbytné pro péči o psa.' },
      { heading: 'Účel zpracování', body: 'Zajištění rezervace, komunikace a bezpečné péče o psa.' },
      { heading: 'Vaše práva', body: 'Máte právo na přístup, opravu a výmaz svých osobních údajů.' },
    ],
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
  return Object.keys(legalPages).map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const page = legalPages[slug]
  return { title: page ? page.title : 'Dokument' }
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const page = legalPages[slug]
  if (!page) notFound()

  return (
    <>
      <PageHeader eyebrow="Dokumenty" title={page.title} description={page.intro} />
      <section className="bg-background py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8">
            {page.sections.map((section) => (
              <div key={section.heading} className="flex flex-col gap-2">
                <h2 className="font-serif text-xl font-semibold text-verde-deep">
                  {section.heading}
                </h2>
                <p className="text-pretty leading-relaxed text-verde-moss">{section.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-12 rounded-xl border border-border bg-secondary/40 p-5 text-sm leading-relaxed text-verde-moss">
            Toto je ukázkový obsah prototypu. Konečné znění dokumentů doplní provozovatel psího
            hotelu {siteSettings.name}.
          </p>
        </div>
      </section>
    </>
  )
}
