import { LeafSprig } from '@/components/brand/leaf-sprig'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <section className="relative bg-primary text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-32 sm:px-6 md:pb-20 md:pt-40 lg:px-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <LeafSprig className="h-5 w-6 text-verde-white/70" />
          {eyebrow ? (
            <span className="label-caps text-verde-white/60">{eyebrow}</span>
          ) : null}
          <h1 className="max-w-3xl text-balance font-serif text-4xl font-semibold leading-[1.1] text-verde-white sm:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-pretty leading-relaxed text-verde-white/80">
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
