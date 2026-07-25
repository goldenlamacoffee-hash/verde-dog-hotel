'use client'

/**
 * /admin/zmenit-heslo
 *
 * Shown automatically on first login when app_metadata.must_change_password === true.
 * The protected layout redirects here before rendering any CMS page.
 *
 * Flow:
 *  1. User logs in with their temporary password.
 *  2. Protected layout detects must_change_password flag and redirects here.
 *  3. User sets a new password satisfying strength requirements.
 *  4. A single server action (initializeAdminPassword) is called — it:
 *       a. verifies the session server-side
 *       b. verifies the admin_roles row is active
 *       c. verifies must_change_password === true (cannot be bypassed)
 *       d. validates password strength server-side
 *       e. calls auth.admin.updateUserById (service-role, never client-side)
 *       f. only on success: clears the flag
 *       g. writes audit event
 *  5. Client refreshes the session to get the updated JWT metadata.
 *  6. User is redirected to /admin.
 *
 * The password is typed in the browser, sent once over HTTPS to the server action,
 * used immediately for the Supabase Admin API call, and then discarded. It is never
 * returned from the server, never stored in DB, never written to audit_log, and
 * cleared from React state when the component transitions to the success state.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { initializeAdminPassword } from '@/lib/admin/user-actions'
import '../../admin.css'

// ─── Password strength checker ────────────────────────────────────────────────

interface StrengthResult {
  score: number   // 0–4
  checks: {
    length: boolean
    upper: boolean
    lower: boolean
    number: boolean
    symbol: boolean
  }
}

function checkStrength(pw: string): StrengthResult {
  const checks = {
    length: pw.length >= 12,
    upper:  /[A-Z]/.test(pw),
    lower:  /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    symbol: /[^A-Za-z0-9]/.test(pw),
  }
  const score = Object.values(checks).filter(Boolean).length
  return { score, checks }
}

const STRENGTH_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#16a34a']
const STRENGTH_LABELS = ['Slabé', 'Slabé', 'Střední', 'Dobré', 'Silné']

// ─── Shared input style ───────────────────────────────────────────────────────

function inputCss(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: 'var(--admin-input-bg, var(--admin-bg))',
    border: '1px solid var(--admin-card-border)',
    color: 'var(--admin-text)',
    borderRadius: '0.5rem',
    padding: '0.6rem 0.85rem',
    fontSize: '0.875rem',
    width: '100%',
    ...extra,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChangePasswordPage() {
  const router = useRouter()
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPw, setShowPw]       = useState(false)
  const [showCo, setShowCo]       = useState(false)
  const [error, setError]         = useState('')
  const [pending, start]          = useTransition()
  const [done, setDone]           = useState(false)

  const strength = checkStrength(password)
  const allChecks = Object.values(strength.checks).every(Boolean)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!allChecks) {
      setError('Heslo nesplňuje požadavky na bezpečnost.')
      return
    }
    if (password !== confirm) {
      setError('Hesla se neshodují.')
      return
    }

    // Capture password into a local variable so we can clear React state before
    // the async call resolves — the value lives in this closure only.
    const captured = password

    start(async () => {
      // Single atomic server action:
      //  - verifies session + active role + must_change_password flag server-side
      //  - validates strength server-side (cannot be bypassed by skipping client checks)
      //  - calls auth.admin.updateUserById (service-role, never client-side key)
      //  - clears the flag only after password update succeeds
      //  - writes audit event
      //  - does NOT return the password
      const res = await initializeAdminPassword(captured)

      if (!res.ok) {
        setError(res.error ?? 'Nastavení hesla se nezdařilo.')
        return
      }

      // Clear passwords from React state immediately — they are no longer needed.
      // After this point the values are unreachable from any component.
      setPassword('')
      setConfirm('')

      // Refresh the session so the client JWT reflects must_change_password = false.
      // Without this the protected layout would redirect back here on the next
      // navigation because the stale token still contains the old app_metadata.
      const supabase = createClient()
      await supabase.auth.refreshSession()

      setDone(true)
      setTimeout(() => router.push('/admin'), 1200)
    })
  }

  return (
    <div
      className="admin-shell min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--admin-bg)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/verde-logo-green.png"
            alt="VERDE"
            className="mx-auto h-14 w-auto mb-4"
          />
          <h1
            className="text-xl font-semibold mb-1"
            style={{ fontFamily: 'var(--font-serif)', color: 'var(--admin-text)' }}
          >
            Nastavit nové heslo
          </h1>
          <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
            Pro pokračování do administrace nastavte trvalé heslo.
          </p>
        </div>

        <div
          className="rounded-2xl p-6 shadow-lg"
          style={{
            background: 'var(--admin-card)',
            border: '1px solid var(--admin-card-border)',
          }}
        >
          {done ? (
            <div className="text-center py-4 space-y-2">
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--admin-success, #059669)' }}
              >
                Heslo bylo nastaveno. Přihlašuji vás...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* New password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="zmheslo-pw"
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--admin-text-muted)' }}
                >
                  Nové heslo
                </label>
                <div className="relative">
                  <input
                    id="zmheslo-pw"
                    type={showPw ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={inputCss({ paddingRight: '2.5rem' })}
                    placeholder="Minimálně 12 znaků"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-50 hover:opacity-100"
                    style={{ color: 'var(--admin-text)' }}
                    tabIndex={-1}
                    aria-label={showPw ? 'Skrýt heslo' : 'Zobrazit heslo'}
                  >
                    {showPw ? 'Skrýt' : 'Zobrazit'}
                  </button>
                </div>

                {/* Strength bar */}
                {password.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex gap-1 h-1">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-full transition-colors"
                          style={{
                            background:
                              i < strength.score
                                ? STRENGTH_COLORS[strength.score - 1]
                                : 'var(--admin-card-border)',
                          }}
                        />
                      ))}
                    </div>
                    <p
                      className="text-xs"
                      style={{ color: STRENGTH_COLORS[strength.score - 1] ?? 'var(--admin-text-muted)' }}
                    >
                      {STRENGTH_LABELS[strength.score] ?? ''}
                    </p>
                    {/* Requirement checklist */}
                    <ul className="text-xs space-y-0.5" style={{ color: 'var(--admin-text-muted)' }}>
                      {[
                        { key: 'length', label: 'Alespoň 12 znaků' },
                        { key: 'upper',  label: 'Velké písmeno' },
                        { key: 'lower',  label: 'Malé písmeno' },
                        { key: 'number', label: 'Číslo' },
                        { key: 'symbol', label: 'Speciální znak (!@#...)' },
                      ].map(({ key, label }) => (
                        <li
                          key={key}
                          style={{
                            color: strength.checks[key as keyof typeof strength.checks]
                              ? '#16a34a'
                              : 'var(--admin-text-muted)',
                          }}
                        >
                          {strength.checks[key as keyof typeof strength.checks] ? '✓' : '○'} {label}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="zmheslo-co"
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--admin-text-muted)' }}
                >
                  Zopakovat heslo
                </label>
                <div className="relative">
                  <input
                    id="zmheslo-co"
                    type={showCo ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    style={inputCss({ paddingRight: '2.5rem' })}
                    placeholder="Opakujte heslo"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCo((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-50 hover:opacity-100"
                    style={{ color: 'var(--admin-text)' }}
                    tabIndex={-1}
                    aria-label={showCo ? 'Skrýt heslo' : 'Zobrazit heslo'}
                  >
                    {showCo ? 'Skrýt' : 'Zobrazit'}
                  </button>
                </div>
                {confirm.length > 0 && password !== confirm && (
                  <p className="text-xs" style={{ color: '#dc2626' }}>
                    Hesla se neshodují.
                  </p>
                )}
              </div>

              {error && (
                <p
                  className="text-xs rounded-lg px-3 py-2"
                  style={{
                    background: 'rgba(239,68,68,0.1)',
                    color: '#dc2626',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={pending || !allChecks || password !== confirm}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-40"
                style={{
                  background: 'var(--admin-accent)',
                  color: 'var(--admin-accent-foreground, #fff)',
                }}
              >
                {pending ? 'Ukládám...' : 'Uložit nové heslo'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
