import Image from 'next/image'
import { SectionHeading } from '@/components/common/section-heading'
import { CtaLink } from '@/components/common/cta-button'

export function Intro() {
  return (
    <section className="bg-background">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div className="relative order-last aspect-[4/5] overflow-hidden rounded-2xl lg:order-first">
          <Image
            src="/images/intro-detail-01.png"
            alt="Detail klidného ohaře v přírodě"
            fill
            sizes="(min-width: 1024px) 40vw, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 ring-1 ring-inset ring-verde-deep/10" aria-hidden="true" />
        </div>

        <div>
          <SectionHeading
            eyebrow="Vítejte ve Verde"
            title="Pobyt, který respektuje povahu vašeho psa"
            withSprig
            description="Věříme, že spokojený pes potřebuje klid, prostor a lidský přístup. Proto ve Verde spojujeme přírodní prostředí s péčí přizpůsobenou každému psovi zvlášť — od krmení a pohybu až po odpočinek."
          />
          <p className="mt-6 max-w-xl text-pretty leading-relaxed text-verde-moss">
            Nacházíme se v klidné lokalitě Brno – venkov, obklopeni zelení
            a dostatkem místa k procházkám. Ať už jedete na dovolenou nebo
            služební cestu, váš pes u nás najde bezpečné zázemí a lidi,
            kterým na něm záleží.
          </p>
          <div className="mt-8">
            <CtaLink href="/o-hotelu" variant="secondary" size="lg">
              Více o hotelu
            </CtaLink>
          </div>
        </div>
      </div>
    </section>
  )
}
