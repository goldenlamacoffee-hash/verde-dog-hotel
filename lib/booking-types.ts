/**
 * Future backend contract for the VERDE reservation system.
 *
 * TODO(backend): These entities describe the anticipated database schema and
 * booking lifecycle. No persistence, authentication or payments are implemented
 * in this sprint. The reservation UI currently uses local mock data only.
 */

export type BookingStatus =
  | 'draft'
  | 'request_submitted'
  | 'under_review'
  | 'awaiting_deposit'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'rejected'

export type DogSex = 'male' | 'female'

export interface Customer {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  note?: string
  createdAt: string
}

export interface Dog {
  id: string
  customerId: string
  name: string
  breed?: string
  birthDateOrAge?: string
  sex: DogSex
  neutered: boolean
  weightKg?: number
  chipNumber?: string
  vetContact?: string
  feedingRegime?: string
  medications?: string
  allergies?: string
  healthRestrictions?: string
  compatibilityWithDogs?: string
  compatibilityWithPeople?: string
  separationAnxiety?: boolean
  escapeBehaviour?: boolean
  otherInfo?: string
}

export interface Booking {
  id: string
  customerId: string
  status: BookingStatus
  arrivalDate: string
  departureDate: string
  nights: number
  estimatedTotal: number
  estimatedDeposit: number
  createdAt: string
}

export interface BookingDog {
  bookingId: string
  dogId: string
}

export interface BookingService {
  bookingId: string
  serviceId: string
  quantity: number
  unitPrice: number
}

export interface PricingRule {
  id: string
  key: string
  value: number
}

export interface CapacityRule {
  id: string
  maxDogs: number
}

export interface BlockedDate {
  date: string
  reason?: string
}

export interface BookingDocument {
  id: string
  bookingId: string
  type: 'vaccination' | 'other'
  fileName: string
}

export interface Consent {
  bookingId: string
  truthfulness: boolean
  stayConditions: boolean
  cancellationConditions: boolean
  personalData: boolean
  marketing: boolean
}

export interface Payment {
  id: string
  bookingId: string
  amount: number
  status: 'pending' | 'paid' | 'refunded'
}

export interface EmailLog {
  id: string
  bookingId: string
  template: string
  sentAt: string
}

/** Business rules — later sourced from PricingRule / CapacityRule. */
export const BOOKING_RULES = {
  minNights: 1,
  maxNights: 30,
  maxDogs: 4,
  depositRate: 0.3,
} as const
