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
    /** Combined required checkbox — maps to truthfulness + stayConditions + cancellationConditions + personalData */
    requiredCombined: boolean
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
      requiredCombined: false,
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

/** Base overnight-stay price — mirrors services.price WHERE slug='overnight-stay' */
const BASE_PER_NIGHT = 490
/**
 * Multi-dog modifier — mirrors pricing_rules WHERE rule_type='multi_dog'.
 * DB value: percent -20  →  additional dog = BASE × 0.80
 */
const MULTI_DOG_FACTOR = 0.8
/**
 * Long-stay modifier — mirrors pricing_rules WHERE rule_type='length_of_stay'.
 * DB value: percent -10, min_nights 7  →  ≥7 nights: all per-night × 0.90
 */
const LONG_STAY_MIN_NIGHTS = 7
const LONG_STAY_FACTOR = 0.9

/**
 * Pure, deterministic estimate that mirrors the server-side pricing in
 * create_reservation(). Keep in sync with DB pricing_rules when those change.
 */
export function calculateEstimate(draft: ReservationDraft): Estimate {
  const nights = nightsBetween(draft.arrival, draft.departure)
  const dogCount = Math.max(1, draft.dogCount)
  const lines: EstimateLine[] = []

  if (nights > 0) {
    // Apply length-of-stay discount to the per-night base price
    const lengthFactor = nights >= LONG_STAY_MIN_NIGHTS ? LONG_STAY_FACTOR : 1
    const firstDogRate = Math.round(BASE_PER_NIGHT * lengthFactor)
    const additionalDogRate = Math.round(BASE_PER_NIGHT * MULTI_DOG_FACTOR * lengthFactor)

    lines.push({
      id: 'base',
      label: 'Noční pobyt — 1. pes',
      detail: nights >= LONG_STAY_MIN_NIGHTS
        ? `${nights} × ${firstDogRate} Kč (sleva za délku pobytu)`
        : `${nights} × ${BASE_PER_NIGHT} Kč`,
      amount: nights * firstDogRate,
    })
    if (dogCount > 1) {
      const extra = dogCount - 1
      lines.push({
        id: 'additional-dogs',
        label: `Další ${extra === 1 ? 'pes' : 'psi'} (${extra}×)`,
        detail: `${extra} × ${nights} × ${additionalDogRate} Kč`,
        amount: extra * nights * additionalDogRate,
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
