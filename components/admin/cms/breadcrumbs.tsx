import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Drobečková navigace" className="mb-3">
      <ol className="flex flex-wrap items-center gap-1 text-sm" style={{ color: 'var(--admin-text-muted)' }}>
        {items.map((item, i) => {
          const last = i === items.length - 1
          return (
            <li key={item.label} className="flex items-center gap-1">
              {item.href && !last ? (
                <Link href={item.href} className="rounded px-1 py-0.5 hover:underline" style={{ color: 'var(--admin-accent)' }}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className="px-1 py-0.5" style={{ color: last ? 'var(--admin-text)' : undefined }}>
                  {item.label}
                </span>
              )}
              {!last && <ChevronRight className="size-3.5" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
