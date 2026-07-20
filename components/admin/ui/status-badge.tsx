const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  inquiry:     { bg: '#fef9c3', color: '#854d0e', label: 'Poptávka' },
  confirmed:   { bg: '#dcfce7', color: '#166534', label: 'Potvrzeno' },
  checked_in:  { bg: '#dbeafe', color: '#1e40af', label: 'Ubytován' },
  checked_out: { bg: '#f3f4f6', color: '#374151', label: 'Odjel' },
  cancelled:   { bg: '#fee2e2', color: '#991b1b', label: 'Zrušeno' },
  no_show:     { bg: '#fce7f3', color: '#9d174d', label: 'Nedorazil' },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const s = STATUS_STYLES[status] ?? { bg: '#f3f4f6', color: '#374151', label: status }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className ?? ''}`}
      style={{ background: s.bg, color: s.color }}
    >
      {s.label}
    </span>
  )
}
