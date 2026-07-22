import { Trees, PawPrint, House, Heart, Leaf, type LucideIcon } from 'lucide-react'
import type { Pillar } from '@/lib/types'
import { cn } from '@/lib/utils'

const map: Record<Pillar['icon'], LucideIcon> = {
  tree: Trees,
  paw: PawPrint,
  house: House,
  heart: Heart,
  leaf: Leaf,
}

interface PillarIconProps {
  name: Pillar['icon']
  className?: string
  strokeWidth?: number
}

export function PillarIcon({ name, className, strokeWidth = 1.5 }: PillarIconProps) {
  const Icon = map[name] ?? PawPrint
  return <Icon className={cn('size-6', className)} strokeWidth={strokeWidth} aria-hidden="true" />
}
