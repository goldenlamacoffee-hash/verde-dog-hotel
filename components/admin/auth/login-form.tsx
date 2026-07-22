'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function AdminLoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError('Nesprávný e-mail nebo heslo.')
        return
      }
      // Hard navigation so the browser sends a fresh HTTP request carrying
      // the new Supabase auth cookies. router.push() uses the RSC cache and
      // can deliver the page before middleware processes the new session,
      // causing a silent redirect back to /admin/login.
      window.location.href = '/admin'
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl shadow-lg p-8 space-y-5"
      style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-card-border)' }}
    >
      <h1 className="text-xl font-semibold" style={{ color: 'var(--admin-text)', fontFamily: 'var(--font-serif)' }}>
        Přihlásit se
      </h1>
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: '#fef2f2', color: 'var(--admin-danger)', border: '1px solid #fecaca' }}>
          {error}
        </div>
      )}
      <div className="space-y-1">
        <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>
          E-mail
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
          autoComplete="email"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium" style={{ color: 'var(--admin-text-muted)' }}>
          Heslo
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2"
          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-card-border)', color: 'var(--admin-text)' }}
          autoComplete="current-password"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg py-2.5 text-sm font-semibold transition-opacity disabled:opacity-60"
        style={{ background: 'var(--admin-accent)', color: '#fff' }}
      >
        {loading ? 'Přihlašuji…' : 'Přihlásit se'}
      </button>
    </form>
  )
}
