import { cn } from '@/lib/utils'

interface FieldProps {
  label: string
  htmlFor: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}

export function Field({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-verde-deep"
      >
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </label>
      {children}
      {hint && !error ? (
        <p className="text-xs text-verde-moss">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

const baseControl =
  'w-full rounded-lg border bg-card px-3.5 py-2.5 text-sm text-verde-charcoal shadow-sm outline-none transition-colors placeholder:text-verde-stone focus-visible:border-verde-green focus-visible:ring-3 focus-visible:ring-verde-green/15'

export function TextInput({
  invalid,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        baseControl,
        invalid ? 'border-destructive' : 'border-border',
        className,
      )}
      {...props}
    />
  )
}

export function TextArea({
  invalid,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        baseControl,
        'min-h-24 resize-y',
        invalid ? 'border-destructive' : 'border-border',
        className,
      )}
      {...props}
    />
  )
}
