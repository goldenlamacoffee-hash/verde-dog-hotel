import { ArrowLeft, ArrowRight } from 'lucide-react'
import { CtaButton } from '@/components/common/cta-button'

interface StepNavProps {
  onNext: () => void
  onBack?: () => void
  nextLabel?: string
  disabledNext?: boolean
}

export function StepNav({ onNext, onBack, nextLabel = 'Pokračovat', disabledNext = false }: StepNavProps) {
  return (
    <div className="mt-10 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-verde-moss transition-colors hover:text-verde-green"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Zpět
        </button>
      ) : (
        <span className="hidden sm:block" />
      )}
      <CtaButton type="button" onClick={onNext} size="md" disabled={disabledNext}>
        {nextLabel}
        <ArrowRight className="size-4" aria-hidden="true" />
      </CtaButton>
    </div>
  )
}

export function StepIntro({
  step,
  title,
  description,
}: {
  step: string
  title: string
  description?: string
}) {
  return (
    <div className="mb-8">
      <span className="label-caps text-verde-wood">{step}</span>
      <h2 className="mt-1.5 font-serif text-2xl font-semibold text-verde-deep sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-verde-moss">
          {description}
        </p>
      ) : null}
    </div>
  )
}
