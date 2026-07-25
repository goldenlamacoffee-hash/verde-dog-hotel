'use client'

/**
 * /admin/nastavit-heslo
 *
 * Shown after an invited user clicks the Supabase invite link.
 * At this point Supabase has already established a session via the
 * /auth/callback?next=/admin/nastavit-heslo redirect.
 *
 * The user must set a new password to complete their account setup.
 * Handles: expired invite, invalid session, already-used invite,
 * and inactive admin_role.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import '../../admin.css'

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
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

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [pending, start] = useTransition()
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Heslo musí mít alespoň 8 znaků.')
      return
    }
    if (password !== confirm) {
      setError('Hesla se neshodují.')
      return
    }

    start(async () => {
      const supabase = createClient()

      // Verify we have a valid session (invite link was used correctly)
      const {
        data: { user },
        error: sessionErr,
      } = await supabase.auth.getUser()

      if (sessionErr || !user) {
        setError(
          'Neplatný nebo vypršelý odkaz. Požádejte správce o nové pozvání.',
        )
        return
      }

      // Update the password
      const { error: updateErr } = await supabase.auth.updateUser({ password })
      if (updateErr) {
        if (
          updateErr.message.toLowerCase().includes('same password') ||
          updateErr.message.toLowerCase().includes('already used')
        ) {
          setError('Tento odkaz byl již použit. Přihlaste se přímo.')
        } else if (updateErr.message.toLowerCase().includes('expired')) {
          setError(
            'Odkaz pro nastavení hesla vypršel. Požádejte správce o nové pozvání.',
          )
        } else {
          setError(`Chyba: ${updateErr.message}`)
        }
        return
      }

      // Verify the admin_roles row is active
      const { data: roleRow } = await supabase
        .from('admin_roles')
        .select('active, role')
        .eq('user_id', user.id)
        .single()

      if (!roleRow || !roleRow.active) {
        setError(
          'Váš účet ještě nebyl aktivován správcem. Kontaktujte administrátora.',
        )
        return
      }

      setDone(true)
      // Short delay so the user sees the success message
      setTimeout(() => router.push('/admin'), 1500)
    })
  }

  return (
    <div
      className="admin-shell min-h-screen flex items-center justify-center"
      style={{ background: 'var(--admin-bg)' }}
    >
      <div className="w-full max-w-sm">
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
            Nastavit heslo
          </h1>
          <p className="text-sm" style={{ color: 'var(--admin-text-muted)' }}>
            Dokončete nastavení vašeho přístupu do administrace.
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
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--admin-text-muted)' }}
                >
                  Nové heslo
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={inputStyle()}
                  placeholder="Minimálně 8 znaků"
                  autoComplete="new-password"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="confirm"
                  className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: 'var(--admin-text-muted)' }}
                >
                  Zopakovat heslo
                </label>
                <input
                  id="confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  style={inputStyle()}
                  placeholder="Opakujte heslo"
                  autoComplete="new-password"
                />
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
                disabled={pending}
                className="w-full rounded-lg px-4 py-2.5 text-sm font-medium transition-opacity disabled:opacity-50"
                style={{
                  background: 'var(--admin-accent)',
                  color: 'var(--admin-accent-foreground, #fff)',
                }}
              >
                {pending ? 'Ukládám...' : 'Nastavit heslo a přihlásit se'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
