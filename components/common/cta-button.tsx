import Link from 'next/link'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const ctaVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium uppercase tracking-[0.12em] transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-60 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-verde-deep',
        secondary:
          'border border-primary/25 bg-transparent text-primary hover:bg-primary/5',
        light:
          'bg-verde-white text-verde-green hover:bg-verde-ivory',
        outlineLight:
          'border border-verde-white/40 bg-transparent text-verde-white hover:bg-verde-white/10',
      },
      size: {
        md: 'h-11 px-5 text-xs',
        lg: 'h-13 px-7 text-[0.8rem]',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'lg',
    },
  },
)

type CtaVariantProps = VariantProps<typeof ctaVariants>

interface CtaLinkProps extends CtaVariantProps {
  href: string
  children: React.ReactNode
  className?: string
}

export function CtaLink({ href, children, variant, size, className }: CtaLinkProps) {
  const external = href.startsWith('http')
  const classes = cn(ctaVariants({ variant, size, className }))
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
      </a>
    )
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  )
}

interface CtaButtonProps
  extends CtaVariantProps,
    React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export function CtaButton({
  children,
  variant,
  size,
  className,
  ...props
}: CtaButtonProps) {
  return (
    <button className={cn(ctaVariants({ variant, size, className }))} {...props}>
      {children}
    </button>
  )
}

export { ctaVariants }
