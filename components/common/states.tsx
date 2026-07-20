import { cn } from '@/lib/utils'
import { AlertCircle, Inbox, Loader2 } from 'lucide-react'

export function EmptyState({
  title,
  description,
  className,
}: {
  title: string
  description?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/40 px-6 py-12 text-center',
        className,
      )}
    >
      <Inbox className="size-6 text-verde-moss" aria-hidden="true" />
      <p className="font-serif text-xl text-verde-deep">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm leading-relaxed text-verde-moss">
          {description}
        </p>
      ) : null}
    </div>
  )
}

export function LoadingState({ label = 'Načítání…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 py-10 text-sm text-verde-moss"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {label}
    </div>
  )
}

export function FieldError({ id, message }: { id?: string; message?: string }) {
  if (!message) return null
  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 flex items-center gap-1.5 text-xs text-destructive"
    >
      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  )
}
