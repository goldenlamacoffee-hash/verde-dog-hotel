'use client'

import { useState, useTransition, useCallback } from 'react'
import {
  inviteAdminUser,
  createAdminUserImmediately,
  updateAdminUser,
  deactivateAdminUser,
  reactivateAdminUser,
  removeAdminUser,
  resendInvitation,
  cancelInvitation,
} from '@/lib/admin/user-actions'
import type { AdminUserRow } from '@/lib/admin/queries'
import type { AppRole } from '@/lib/auth/roles'

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: { value: AppRole; label: string }[] = [
  { value: 'owner', label: 'Vlastník' },
  { value: 'admin', label: 'Administrátor' },
  { value: 'reception', label: 'Recepce' },
  { value: 'staff', label: 'Personál' },
  { value: 'content_editor', label: 'Editor obsahu' },
]

const ROLE_LABELS: Record<AppRole, string> = Object.fromEntries(
  ROLES.map((r) => [r.value, r.label]),
) as Record<AppRole, string>

function roleBadgeStyle(role: AppRole) {
  switch (role) {
    case 'owner':
      return { background: 'var(--admin-accent-light)', color: 'var(--admin-accent)' }
    case 'admin':
      return { background: 'rgba(99,102,241,0.12)', color: '#6366f1' }
    case 'reception':
      return { background: 'rgba(16,185,129,0.12)', color: '#059669' }
    case 'staff':
      return { background: 'rgba(234,179,8,0.15)', color: '#a16207' }
    case 'content_editor':
      return { background: 'rgba(168,85,247,0.12)', color: '#7c3aed' }
    default:
      return { background: 'rgba(107,114,128,0.12)', color: '#6b7280' }
  }
}

function deriveStatus(row: AdminUserRow): { label: string; style: React.CSSProperties } {
  if (!row.active) {
    return {
      label: 'Pozastaven',
      style: { background: 'rgba(239,68,68,0.12)', color: '#dc2626' },
    }
  }
  if (!row.confirmed_at && row.invited_at) {
    return {
      label: 'Pozván',
      style: { background: 'rgba(234,179,8,0.15)', color: '#a16207' },
    }
  }
  if (!row.confirmed_at && !row.invited_at) {
    return {
      label: 'Neaktivní',
      style: { background: 'rgba(107,114,128,0.12)', color: '#6b7280' },
    }
  }
  // Immediately created account awaiting first-login password change
  if (row.must_change_password) {
    return {
      label: 'Musí změnit heslo',
      style: { background: 'rgba(249,115,22,0.12)', color: '#c2410c' },
    }
  }
  return {
    label: 'Aktivní',
    style: { background: 'rgba(16,185,129,0.12)', color: '#059669' },
  }
}

function isPending(row: AdminUserRow) {
  return !row.confirmed_at
}

// ─── Small shared UI helpers ──────────────────────────────────────────────────

function Badge({
  label,
  style,
}: {
  label: string
  style: React.CSSProperties
}) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={style}
    >
      {label}
    </span>
  )
}

function AdminBtn({
  children,
  onClick,
  danger,
  disabled,
  type = 'button',
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium transition-opacity disabled:opacity-50 ${className}`}
      style={
        danger
          ? {
              background: 'rgba(239,68,68,0.1)',
              color: '#dc2626',
              border: '1px solid rgba(239,68,68,0.25)',
            }
          : {
              background: 'var(--admin-accent)',
              color: 'var(--admin-accent-foreground, #fff)',
            }
      }
    >
      {children}
    </button>
  )
}

function GhostBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center justify-center rounded-lg px-3.5 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
      style={{
        color: 'var(--admin-text-muted)',
        border: '1px solid var(--admin-card-border)',
      }}
    >
      {children}
    </button>
  )
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="relative w-full max-w-md rounded-2xl p-6 shadow-2xl"
        style={{
          background: 'var(--admin-card)',
          border: '1px solid var(--admin-card-border)',
          color: 'var(--admin-text)',
        }}
      >
        <div className="flex items-center justify-between mb-5">
          <h2
            className="text-lg font-semibold"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-xl leading-none opacity-50 hover:opacity-100"
            aria-label="Zavřít"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function FieldRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        className="text-xs font-medium uppercase tracking-wide"
        style={{ color: 'var(--admin-text-muted)' }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--admin-input-bg, var(--admin-bg))',
  border: '1px solid var(--admin-card-border)',
  color: 'var(--admin-text)',
  borderRadius: '0.5rem',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  width: '100%',
}

// ─── Password generator + strength ───────────────────────────────────────────

const PW_CHARS = {
  upper:  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lower:  'abcdefghjkmnpqrstuvwxyz',
  number: '23456789',
  symbol: '!@#$%^&*-+=?',
}

function generateSecurePassword(length = 16): string {
  const pools = [PW_CHARS.upper, PW_CHARS.lower, PW_CHARS.number, PW_CHARS.symbol]
  // Guarantee at least one from each pool
  const chars = pools.map((p) => p[Math.floor(Math.random() * p.length)])
  const all = pools.join('')
  for (let i = chars.length; i < length; i++) {
    chars.push(all[Math.floor(Math.random() * all.length)])
  }
  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[chars[i], chars[j]] = [chars[j], chars[i]]
  }
  return chars.join('')
}

interface PwStrength {
  score: number
  checks: { length: boolean; upper: boolean; lower: boolean; number: boolean; symbol: boolean }
}

function pwStrength(pw: string): PwStrength {
  const checks = {
    length: pw.length >= 12,
    upper:  /[A-Z]/.test(pw),
    lower:  /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  }
  return { score: Object.values(checks).filter(Boolean).length, checks }
}

const PW_STRENGTH_COLORS = ['#ef4444', '#f97316', '#f97316', '#22c55e', '#16a34a']
const PW_STRENGTH_LABELS = ['Slabé', 'Slabé', 'Střední', 'Dobré', 'Silné']

function PasswordField({
  value,
  onChange,
  onGenerate,
}: {
  value: string
  onChange: (v: string) => void
  onGenerate: () => void
}) {
  const [show, setShow] = useState(false)
  const [copied, setCopied] = useState(false)
  const str = pwStrength(value)

  function copy() {
    if (!value) return
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            required
            autoComplete="new-password"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...inputStyle, paddingRight: '4.5rem', fontFamily: show ? 'monospace' : undefined }}
            placeholder="Zadejte nebo vygenerujte heslo"
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs opacity-50 hover:opacity-100 px-1"
            style={{ color: 'var(--admin-text)' }}
            tabIndex={-1}
          >
            {show ? 'Skrýt' : 'Zobrazit'}
          </button>
        </div>
        <button
          type="button"
          onClick={copy}
          title="Kopírovat heslo"
          disabled={!value}
          className="rounded-lg px-2.5 text-xs font-medium transition-opacity disabled:opacity-30 shrink-0"
          style={{ border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)', background: 'transparent' }}
        >
          {copied ? 'Zkopírováno' : 'Kopírovat'}
        </button>
      </div>
      <button
        type="button"
        onClick={onGenerate}
        className="text-xs font-medium transition-opacity hover:opacity-80"
        style={{ color: 'var(--admin-accent)' }}
      >
        Vygenerovat bezpečné heslo
      </button>
      {value.length > 0 && (
        <div className="space-y-1">
          <div className="flex gap-0.5 h-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex-1 rounded-full"
                style={{
                  background: i < str.score ? PW_STRENGTH_COLORS[str.score - 1] : 'var(--admin-card-border)',
                }}
              />
            ))}
          </div>
          <p className="text-xs" style={{ color: PW_STRENGTH_COLORS[str.score - 1] ?? 'var(--admin-text-muted)' }}>
            {PW_STRENGTH_LABELS[str.score] ?? ''}
          </p>
          <ul className="text-xs space-y-0.5">
            {([
              ['length', 'Alespoň 12 znaků'],
              ['upper',  'Velké písmeno'],
              ['lower',  'Malé písmeno'],
              ['number', 'Číslo'],
              ['symbol', 'Speciální znak'],
            ] as [keyof PwStrength['checks'], string][]).map(([key, label]) => (
              <li key={key} style={{ color: str.checks[key] ? '#16a34a' : 'var(--admin-text-muted)' }}>
                {str.checks[key] ? '✓' : '○'} {label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ─── One-time success display (immediate creation) ────────────────────────────

function ImmediateSuccessView({
  email,
  role,
  fullName,
  password,
  onClose,
}: {
  email: string
  role: AppRole
  fullName: string
  password: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  function copyCredentials() {
    const text = `Přihlašovací údaje do administrace VERDE\n\nJméno: ${fullName}\nE-mail: ${email}\nDočasné heslo: ${password}\nURL: ${window.location.origin}/admin/login\n\nHeslo je dočasné — po prvním přihlášení bude vyžadována změna.`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}
      >
        <p className="text-sm font-medium" style={{ color: '#059669' }}>
          Uživatel byl vytvořen.
        </p>
        <div className="text-xs space-y-1" style={{ color: 'var(--admin-text)' }}>
          <div><span style={{ color: 'var(--admin-text-muted)' }}>Jméno:</span> {fullName}</div>
          <div><span style={{ color: 'var(--admin-text-muted)' }}>E-mail:</span> {email}</div>
          <div><span style={{ color: 'var(--admin-text-muted)' }}>Role:</span> {ROLE_LABELS[role] ?? role}</div>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ color: 'var(--admin-text-muted)' }}>Heslo:</span>
            <code
              className="rounded px-1.5 py-0.5 font-mono text-xs tracking-wider select-all"
              style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)' }}
            >
              {password}
            </code>
          </div>
        </div>
      </div>
      <div
        className="rounded-xl p-3 text-xs"
        style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', color: '#a16207' }}
      >
        Dočasné heslo se po zavření tohoto okna již nezobrazí. Předejte jej uživateli bezpečným způsobem.
      </div>
      <div className="flex gap-3 justify-end">
        <GhostBtn onClick={copyCredentials}>
          {copied ? 'Zkopírováno' : 'Kopírovat přihlašovací údaje'}
        </GhostBtn>
        <AdminBtn onClick={onClose}>Zavřít</AdminBtn>
      </div>
    </div>
  )
}

// ─── Add user modal (immediate + invite) ─────────────────────────────────────

type AddMethod = 'immediate' | 'invite'

function AddUserModal({
  open,
  onClose,
  callerRole,
}: {
  open: boolean
  onClose: () => void
  callerRole: AppRole
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [method, setMethod] = useState<AddMethod>('immediate')

  // Shared fields
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [role,      setRole]      = useState<AppRole>('staff')

  // Immediate-creation fields
  const [password, setPassword] = useState('')

  // Success state (immediate only — shows once then gone)
  const [successData, setSuccessData] = useState<{
    email: string; role: AppRole; fullName: string; password: string
  } | null>(null)

  // Invite-only success
  const [inviteSent, setInviteSent] = useState(false)

  // Rate-limit fallback flag
  const [rateLimited, setRateLimited] = useState(false)

  const availableRoles = callerRole === 'owner' ? ROLES : ROLES.filter((r) => r.value !== 'owner')

  const generatePw = useCallback(() => setPassword(generateSecurePassword()), [])

  function handleClose() {
    setError('')
    setSuccessData(null)
    setInviteSent(false)
    setRateLimited(false)
    setFirstName('')
    setLastName('')
    setEmail('')
    setRole('staff')
    setPassword('')
    setMethod('immediate')
    onClose()
  }

  const str = pwStrength(password)
  const pwValid = Object.values(str.checks).every(Boolean)

  async function handleSubmitImmediate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!pwValid) {
      setError('Heslo nesplňuje požadavky na bezpečnost.')
      return
    }
    const capturedPw = password // capture before reset
    start(async () => {
      const res = await createAdminUserImmediately({
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        email,
        role,
        temporary_password: capturedPw,
      })
      if (res.ok) {
        setSuccessData({
          email,
          role,
          fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
          password: capturedPw,
        })
      } else {
        setError(res.error ?? 'Chyba.')
      }
    })
  }

  async function handleSubmitInvite(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setRateLimited(false)
    start(async () => {
      const res = await inviteAdminUser({
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        email,
        role,
      })
      if (res.ok) {
        setInviteSent(true)
      } else {
        // Detect rate-limit to show fallback button
        if (
          res.error?.toLowerCase().includes('rate limit') ||
          res.error?.toLowerCase().includes('limit odesílání')
        ) {
          setRateLimited(true)
        }
        setError(res.error ?? 'Chyba.')
      }
    })
  }

  return (
    <Modal open={open} onClose={handleClose} title="Přidat uživatele">
      {/* Success screens */}
      {successData && (
        <ImmediateSuccessView
          email={successData.email}
          role={successData.role}
          fullName={successData.fullName}
          password={successData.password}
          onClose={handleClose}
        />
      )}
      {!successData && inviteSent && (
        <div className="text-center py-4 space-y-4">
          <p className="text-sm" style={{ color: 'var(--admin-success, #059669)' }}>
            Pozvánka byla odeslána na adresu <strong>{email}</strong>.
          </p>
          <AdminBtn onClick={handleClose}>Zavřít</AdminBtn>
        </div>
      )}
      {!successData && !inviteSent && (
        <>
          {/* Method toggle */}
          <div
            className="flex rounded-xl p-1 mb-5 gap-1"
            style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)' }}
            role="group"
            aria-label="Způsob vytvoření účtu"
          >
            {([
              { value: 'immediate', label: 'Vytvořit účet ihned' },
              { value: 'invite',    label: 'Poslat pozvánku e-mailem' },
            ] as { value: AddMethod; label: string }[]).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setMethod(opt.value); setError(''); setRateLimited(false) }}
                className="flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-all"
                style={
                  method === opt.value
                    ? { background: 'var(--admin-accent)', color: 'var(--admin-accent-foreground, #fff)' }
                    : { background: 'transparent', color: 'var(--admin-text-muted)' }
                }
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* ── Shared name + email + role fields ── */}
          <div className="space-y-4">
            <div className="flex gap-3">
              <FieldRow label="Jméno">
                <input
                  required
                  style={inputStyle}
                  placeholder="Jana"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </FieldRow>
              <FieldRow label="Příjmení">
                <input
                  required
                  style={inputStyle}
                  placeholder="Nováková"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </FieldRow>
            </div>
            <FieldRow label="E-mail">
              <input
                type="email"
                required
                style={inputStyle}
                placeholder="jana@example.cz"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FieldRow>
            <FieldRow label="Role">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as AppRole)}
                style={inputStyle}
              >
                {availableRoles.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </FieldRow>

            {/* ── Immediate: password field ── */}
            {method === 'immediate' && (
              <form onSubmit={handleSubmitImmediate}>
                <FieldRow label="Dočasné heslo">
                  <PasswordField
                    value={password}
                    onChange={setPassword}
                    onGenerate={generatePw}
                  />
                </FieldRow>
                {error && (
                  <p
                    className="mt-3 text-xs rounded-lg px-3 py-2"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}
                  >
                    {error}
                  </p>
                )}
                <div className="flex justify-end gap-3 pt-4">
                  <GhostBtn onClick={handleClose} disabled={pending}>Zrušit</GhostBtn>
                  <AdminBtn type="submit" disabled={pending || !pwValid}>
                    {pending ? 'Vytváření...' : 'Vytvořit účet'}
                  </AdminBtn>
                </div>
              </form>
            )}

            {/* ── Invite: SMTP notice + submit ── */}
            {method === 'invite' && (
              <form onSubmit={handleSubmitInvite}>
                <div
                  className="rounded-xl px-3 py-2.5 text-xs"
                  style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', color: 'var(--admin-text-muted)' }}
                >
                  Pro spolehlivé odesílání pozvánek je nutné vlastní SMTP v nastavení Supabase projektu.
                </div>
                {error && (
                  <div className="mt-3 space-y-2">
                    <p
                      className="text-xs rounded-lg px-3 py-2"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}
                    >
                      {error}
                    </p>
                    {rateLimited && (
                      <button
                        type="button"
                        onClick={() => { setMethod('immediate'); setError(''); setRateLimited(false) }}
                        className="text-xs font-medium transition-opacity hover:opacity-80 underline"
                        style={{ color: 'var(--admin-accent)' }}
                      >
                        Vytvořit účet bez e-mailu →
                      </button>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-3 pt-4">
                  <GhostBtn onClick={handleClose} disabled={pending}>Zrušit</GhostBtn>
                  <AdminBtn type="submit" disabled={pending}>
                    {pending ? 'Odesílání...' : 'Odeslat pozvánku'}
                  </AdminBtn>
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}

// ─── Edit / detail modal ──────────────────────────────────────────────────────

function EditModal({
  user,
  onClose,
  callerRole,
  callerId,
}: {
  user: AdminUserRow | null
  onClose: () => void
  callerRole: AppRole
  callerId: string
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')

  if (!user) return null

  const isOwner = callerRole === 'owner'
  const availableRoles = isOwner ? ROLES : ROLES.filter((r) => r.value !== 'owner')
  const isSelf = user.user_id === callerId

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    const payload = {
      user_id: user!.user_id,
      full_name: `${fd.get('first_name')} ${fd.get('last_name')}`.trim(),
      role: fd.get('role') as AppRole,
      active: fd.get('active') === '1',
    }
    start(async () => {
      const res = await updateAdminUser(payload)
      if (res.ok) {
        onClose()
      } else {
        setError(res.error ?? 'Chyba.')
      }
    })
  }

  const nameParts = (user.full_name ?? '').split(' ')
  const defaultFirst = nameParts.slice(0, -1).join(' ') || nameParts[0] || ''
  const defaultLast = nameParts.length > 1 ? nameParts[nameParts.length - 1] : ''

  return (
    <Modal open onClose={onClose} title="Upravit uživatele">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-3">
          <FieldRow label="Jméno">
            <input
              name="first_name"
              defaultValue={defaultFirst}
              required
              style={inputStyle}
            />
          </FieldRow>
          <FieldRow label="Příjmení">
            <input
              name="last_name"
              defaultValue={defaultLast}
              required
              style={inputStyle}
            />
          </FieldRow>
        </div>
        <FieldRow label="E-mail">
          {/* Email is read-only — changing auth email requires a separate Supabase flow */}
          <input
            value={user.email}
            readOnly
            style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }}
            title="E-mail nelze měnit přímo. Kontaktujte Supabase nebo použijte workflow přezvání."
          />
          <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
            E-mail je pouze ke čtení. Pro změnu použijte workflow nového pozvání.
          </span>
        </FieldRow>
        <FieldRow label="Role">
          <select
            name="role"
            defaultValue={user.role}
            disabled={!isOwner && user.role === 'owner'}
            style={inputStyle}
          >
            {availableRoles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Stav">
          <select
            name="active"
            defaultValue={user.active ? '1' : '0'}
            style={inputStyle}
          >
            <option value="1">Aktivní</option>
            <option value="0">Pozastaven</option>
          </select>
        </FieldRow>
        {error && (
          <p
            className="text-xs rounded-lg px-3 py-2"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <GhostBtn onClick={onClose} disabled={pending}>
            Zrušit
          </GhostBtn>
          <AdminBtn type="submit" disabled={pending}>
            {pending ? 'Ukládám...' : 'Uložit'}
          </AdminBtn>
        </div>
      </form>
    </Modal>
  )
}

// ─── Remove confirmation dialog ───────────────────────────────────────────────

function RemoveConfirmModal({
  user,
  onClose,
}: {
  user: AdminUserRow | null
  onClose: () => void
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const [deleteAuth, setDeleteAuth] = useState(false)

  if (!user) return null

  function handle() {
    setError('')
    start(async () => {
      const res = await removeAdminUser(user!.user_id, deleteAuth)
      if (res.ok) {
        onClose()
      } else {
        setError(res.error ?? 'Chyba.')
      }
    })
  }

  return (
    <Modal open onClose={onClose} title="Odebrat uživatele">
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--admin-text)' }}>
          Chystáte se odebrat přístup uživatele{' '}
          <strong>{user.full_name || user.email}</strong> z administrace.
        </p>
        <div
          className="rounded-xl p-4 text-xs space-y-2"
          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)' }}
        >
          <p>
            <strong>Deaktivovat:</strong> účet zůstane, přístup bude zakázán. Auditní záznamy jsou zachovány.
          </p>
          <p>
            <strong>Odebrat:</strong> admin přístup bude odebrán. Rezervace a záznamy zákazníků zůstanou nedotčeny.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={deleteAuth}
            onChange={(e) => setDeleteAuth(e.target.checked)}
          />
          <span style={{ color: 'var(--admin-text)' }}>
            Také smazat přihlašovací účet (Auth) — doporučeno pouze pro pozvané uživatele, kteří se nikdy nepřihlásili
          </span>
        </label>
        {error && (
          <p
            className="text-xs rounded-lg px-3 py-2"
            style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}
          >
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <GhostBtn onClick={onClose} disabled={pending}>
            Zrušit
          </GhostBtn>
          <AdminBtn danger onClick={handle} disabled={pending}>
            {pending ? 'Odebírám...' : 'Odebrat přístup'}
          </AdminBtn>
        </div>
      </div>
    </Modal>
  )
}

// ─── Row action menu ──────────────────────────────────────────────────────────

function RowActions({
  user,
  callerRole,
  callerId,
  onEdit,
  onRemove,
}: {
  user: AdminUserRow
  callerRole: AppRole
  callerId: string
  onEdit: (u: AdminUserRow) => void
  onRemove: (u: AdminUserRow) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [actionError, setActionError] = useState('')

  const isOwnerCaller = callerRole === 'owner'
  const isOwnerTarget = user.role === 'owner'
  const isSelf = user.user_id === callerId
  const pending_ = isPending(user)

  function runAction(
    fn: () => Promise<{ ok: boolean; error?: string }>,
  ) {
    setActionError('')
    setOpen(false)
    start(async () => {
      const res = await fn()
      if (!res.ok) setActionError(res.error ?? 'Chyba.')
    })
  }

  const canModify = isOwnerCaller || (!isOwnerTarget && callerRole === 'admin')
  const canRemove = isOwnerCaller

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg px-2 py-1 text-xs font-medium transition-opacity opacity-60 hover:opacity-100"
        style={{
          border: '1px solid var(--admin-card-border)',
          color: 'var(--admin-text)',
        }}
        aria-label="Akce"
        disabled={pending}
      >
        ···
      </button>
      {actionError && (
        <p
          className="absolute right-0 top-8 z-10 w-64 text-xs rounded-lg px-3 py-2 shadow-lg"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.25)' }}
        >
          {actionError}
          <button
            className="ml-2 underline"
            onClick={() => setActionError('')}
          >
            ×
          </button>
        </p>
      )}
      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute right-0 top-8 z-20 min-w-[188px] rounded-xl shadow-xl py-1"
            style={{
              background: 'var(--admin-card)',
              border: '1px solid var(--admin-card-border)',
            }}
          >
            {canModify && (
              <MenuItem
                label="Upravit"
                onClick={() => {
                  setOpen(false)
                  onEdit(user)
                }}
              />
            )}
            {canModify && user.active && (
              <MenuItem
                label="Deaktivovat přístup"
                onClick={() =>
                  runAction(() => deactivateAdminUser(user.user_id))
                }
              />
            )}
            {canModify && !user.active && (
              <MenuItem
                label="Reaktivovat přístup"
                onClick={() =>
                  runAction(() => reactivateAdminUser(user.user_id))
                }
              />
            )}
            {isOwnerCaller && pending_ && (
              <>
                <MenuDivider />
                <MenuItem
                  label="Znovu odeslat pozvánku"
                  onClick={() => runAction(() => resendInvitation(user.user_id))}
                />
                <MenuItem
                  label="Zrušit pozvánku"
                  danger
                  onClick={() => runAction(() => cancelInvitation(user.user_id))}
                />
              </>
            )}
            {canRemove && (
              <>
                <MenuDivider />
                <MenuItem
                  label="Odebrat uživatele"
                  danger
                  onClick={() => {
                    setOpen(false)
                    onRemove(user)
                  }}
                />
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function MenuItem({
  label,
  onClick,
  danger,
}: {
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left px-4 py-2 text-sm hover:opacity-80 transition-opacity"
      style={{ color: danger ? '#dc2626' : 'var(--admin-text)' }}
    >
      {label}
    </button>
  )
}

function MenuDivider() {
  return (
    <hr style={{ borderColor: 'var(--admin-card-border)', margin: '4px 0' }} />
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function UsersManager({
  users,
  callerRole,
  callerId,
}: {
  users: AdminUserRow[]
  callerRole: AppRole
  callerId: string
}) {
  const [showInvite, setShowInvite] = useState(false)
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null)
  const [removeUser, setRemoveUser] = useState<AdminUserRow | null>(null)

  const canInvite = callerRole === 'owner'

  return (
    <>
      {/* Add user button — rendered here so RSC PageHeader can pass it as action */}
      {canInvite && (
        <div className="flex justify-end mb-0">
          <AdminBtn onClick={() => setShowInvite(true)}>
            + Přidat uživatele
          </AdminBtn>
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          border: '1px solid var(--admin-card-border)',
          background: 'var(--admin-card)',
        }}
      >
        {!users.length ? (
          <div className="p-10 text-center">
            <p
              className="text-sm mb-2"
              style={{ color: 'var(--admin-text-muted)' }}
            >
              Zatím žádní administrátoři.
            </p>
            {canInvite && (
              <button
                type="button"
                onClick={() => setShowInvite(true)}
                className="text-sm font-medium"
                style={{ color: 'var(--admin-accent)' }}
              >
                Přidat prvního uživatele →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  style={{ borderBottom: '1px solid var(--admin-card-border)' }}
                >
                  {[
                    'Uživatel',
                    'E-mail',
                    'Role',
                    'Stav',
                    'Poslední přihlášení',
                    'Přidán',
                    '',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider whitespace-nowrap"
                      style={{ color: 'var(--admin-text-muted)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const status = deriveStatus(u)
                  return (
                    <tr
                      key={u.user_id}
                      style={{
                        borderBottom: '1px solid var(--admin-card-border)',
                      }}
                      className="hover:bg-black/5 transition-colors"
                    >
                      {/* Name */}
                      <td
                        className="px-4 py-3 font-medium whitespace-nowrap"
                        style={{ color: 'var(--admin-text)' }}
                      >
                        {u.full_name || '—'}
                      </td>
                      {/* Email */}
                      <td
                        className="px-4 py-3 tabular-nums"
                        style={{ color: 'var(--admin-text-muted)' }}
                      >
                        {u.email || '—'}
                      </td>
                      {/* Role */}
                      <td className="px-4 py-3">
                        <Badge
                          label={ROLE_LABELS[u.role] ?? u.role}
                          style={roleBadgeStyle(u.role)}
                        />
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge label={status.label} style={status.style} />
                      </td>
                      {/* Last sign-in */}
                      <td
                        className="px-4 py-3 tabular-nums text-xs whitespace-nowrap"
                        style={{ color: 'var(--admin-text-muted)' }}
                      >
                        {u.last_sign_in_at
                          ? new Date(u.last_sign_in_at).toLocaleString('cs-CZ', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      {/* Created */}
                      <td
                        className="px-4 py-3 tabular-nums text-xs whitespace-nowrap"
                        style={{ color: 'var(--admin-text-muted)' }}
                      >
                        {new Date(u.created_at).toLocaleDateString('cs-CZ')}
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <RowActions
                          user={u}
                          callerRole={callerRole}
                          callerId={callerId}
                          onEdit={setEditUser}
                          onRemove={setRemoveUser}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddUserModal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        callerRole={callerRole}
      />
      <EditModal
        user={editUser}
        onClose={() => setEditUser(null)}
        callerRole={callerRole}
        callerId={callerId}
      />
      <RemoveConfirmModal
        user={removeUser}
        onClose={() => setRemoveUser(null)}
      />
    </>
  )
}
