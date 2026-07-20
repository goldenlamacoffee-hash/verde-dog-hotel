import { BOOKING_RULES } from './booking-types'
import { services } from '@/content/services'
import { nightsBetween } from './format'

export interface DogDraft {
  name: string
  breed: string
  ageOrBirth: string
  sex: 'male' | 'female' | ''
  neutered: boolean
  weightKg: string
  feedingRegime: string
  medications: string
  compatibility: string
  note: string
}

export interface ReservationDraft {
  arrival: string
  departure: string
  dogCount: number
  dogs: DogDraft[]
  selectedServices: string[]
  owner: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address: string
    emergencyName: string
    emergencyPhone: string
    message: string
  }
  consents: {
    truthfulness: boolean
    stayConditions: boolean
    cancellationConditions: boolean
    personalData: boolean
    marketing: boolean
  }
}

export function emptyDog(): DogDraft {
  return {
    name: '',
    breed: '',
    ageOrBirth: '',
    sex: '',
    neutered: false,
    weightKg: '',
    feedingRegime: '',
    medications: '',
    compatibility: '',
    note: '',
  }
}

export function createEmptyDraft(): ReservationDraft {
  return {
    arrival: '',
    departure: '',
    dogCount: 1,
    dogs: [emptyDog()],
    selectedServices: [],
    owner: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      address: '',
      emergencyName: '',
      emergencyPhone: '',
      message: '',
    },
    consents: {
      truthfulness: false,
      stayConditions: false,
      cancellationConditions: false,
      personalData: false,
      marketing: false,
    },
  }
}

export interface EstimateLine {
  id: string
  label: string
  detail: string
  amount: number
}

export interface Estimate {
  nights: number
  dogCount: number
  lines: EstimateLine[]
  total: number
  deposit: number
}

const BASE_PER_NIGHT = 490
const ADDITIONAL_DOG_PER_NIGHT = 390

/**
 * Pure, deterministic estimate. Mirrors the anticipated server-side pricing so
 * it can later be replaced by an API call returning the same shape.
 */
export function calculateEstimate(draft: ReservationDraft): Estimate {
  const nights = nightsBetween(draft.arrival, draft.departure)
  const dogCount = Math.max(1, draft.dogCount)
  const lines: EstimateLine[] = []

  if (nights > 0) {
    lines.push({
      id: 'base',
      label: 'Standardní pobyt — 1. pes',
      detail: `${nights} × ${BASE_PER_NIGHT} Kč`,
      amount: nights * BASE_PER_NIGHT,
    })
    if (dogCount > 1) {
      const extra = dogCount - 1
      lines.push({
        id: 'additional-dogs',
        label: `Další psi (${extra})`,
        detail: `${extra} × ${nights} × ${ADDITIONAL_DOG_PER_NIGHT} Kč`,
        amount: extra * nights * ADDITIONAL_DOG_PER_NIGHT,
      })
    }
  }

  for (const serviceId of draft.selectedServices) {
    const service = services.find((s) => s.id === serviceId)
    if (!service || service.standard || service.price === 0) continue

    let quantity = 1
    let detail = ''
    switch (service.unit) {
      case 'per-night':
      case 'per-day':
        quantity = Math.max(nights, 1)
        detail = `${quantity} × ${service.price} Kč`
        break
      case 'per-walk':
      case 'per-stay':
      case 'one-off':
      default:
        quantity = 1
        detail = `${service.price} Kč`
        break
    }
    lines.push({
      id: service.id,
      label: service.title,
      detail,
      amount: quantity * service.price,
    })
  }

  const total = lines.reduce((sum, line) => sum + line.amount, 0)
  const deposit = Math.round((total * BOOKING_RULES.depositRate) / 10) * 10

  return { nights, dogCount, lines, total, deposit }
}

export const RESERVATION_STEPS = [
  { id: 'term', label: 'Termín' },
  { id: 'dogs', label: 'Psi' },
  { id: 'services', label: 'Služby' },
  { id: 'owner', label: 'Kontakt' },
  { id: 'summary', label: 'Souhrn' },
  { id: 'done', label: 'Odesláno' },
] as const

export type StepId = (typeof RESERVATION_STEPS)[number]['id']
