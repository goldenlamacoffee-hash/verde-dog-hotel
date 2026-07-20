import { cn } from '@/lib/utils'
import { LeafSprig } from '@/components/brand/leaf-sprig'

interface SectionHeadingProps {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
  tone?: 'dark' | 'light'
  withSprig?: boolean
  as?: 'h1' | 'h2'
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  tone = 'dark',
  withSprig = false,
  as = 'h2',
  className,
}: SectionHeadingProps) {
  const Title = as
  const isLight = tone === 'light'
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        align === 'center' ? 'items-center text-center' : 'items-start',
        className,
      )}
    >
      {eyebrow ? (
        <span
          className={cn(
            'label-caps',
            isLight ? 'text-verde-white/70' : 'text-verde-moss',
          )}
        >
          {eyebrow}
        </span>
      ) : null}
      {withSprig ? (
        <LeafSprig
          className={cn(isLight ? 'text-verde-white/80' : 'text-verde-green/70')}
        />
      ) : null}
      <Title
        className={cn(
          'text-balance font-serif text-3xl leading-[1.1] font-semibold sm:text-4xl md:text-[2.75rem]',
          isLight ? 'text-verde-white' : 'text-verde-deep',
        )}
      >
        {title}
      </Title>
      {description ? (
        <p
          className={cn(
            'max-w-2xl text-pretty text-base leading-relaxed md:text-lg',
            isLight ? 'text-verde-white/80' : 'text-verde-moss',
            align === 'center' ? 'mx-auto' : '',
          )}
        >
          {description}
        </p>
      ) : null}
    </div>
  )
}
