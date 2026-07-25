'use client'

import { useState, useTransition } from 'react'
import {
  inviteAdminUser,
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

// ─── Invite modal ─────────────────────────────────────────────────────────────

function InviteModal({
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
  const [success, setSuccess] = useState(false)

  const availableRoles = callerRole === 'owner' ? ROLES : ROLES.filter((r) => r.value !== 'owner')

  function handleClose() {
    setError('')
    setSuccess(false)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    const fd = new FormData(e.currentTarget)
    const payload = {
      first_name: fd.get('first_name') as string,
      last_name: fd.get('last_name') as string,
      email: fd.get('email') as string,
      role: fd.get('role') as string,
      message: fd.get('message') as string | undefined,
    }
    start(async () => {
      const res = await inviteAdminUser(payload)
      if (res.ok) {
        setSuccess(true)
      } else {
        setError(res.error ?? 'Chyba.')
      }
    })
  }

  return (
    <Modal open={open} onClose={handleClose} title="Přidat uživatele">
      {success ? (
        <div className="text-center py-4 space-y-4">
          <p className="text-sm" style={{ color: 'var(--admin-success, #059669)' }}>
            Pozvánka byla odeslána. Uživatel dostane e-mail s odkazem pro nastavení přístupu.
          </p>
          <AdminBtn onClick={handleClose}>Zavřít</AdminBtn>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <FieldRow label="Jméno">
              <input name="first_name" required style={inputStyle} placeholder="Jana" />
            </FieldRow>
            <FieldRow label="Příjmení">
              <input name="last_name" required style={inputStyle} placeholder="Nováková" />
            </FieldRow>
          </div>
          <FieldRow label="E-mail">
            <input
              name="email"
              type="email"
              required
              style={inputStyle}
              placeholder="jana@example.cz"
            />
          </FieldRow>
          <FieldRow label="Role">
            <select name="role" defaultValue="staff" style={inputStyle}>
              {availableRoles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Osobní zpráva (volitelné)">
            <textarea
              name="message"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
              placeholder="Vítám tě v týmu VERDE..."
            />
          </FieldRow>
          {error && (
            <p className="text-xs rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}>
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-1">
            <GhostBtn onClick={handleClose} disabled={pending}>
              Zrušit
            </GhostBtn>
            <AdminBtn type="submit" disabled={pending}>
              {pending ? 'Odesílání...' : 'Odeslat pozvánku'}
            </AdminBtn>
          </div>
        </form>
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
      <InviteModal
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
