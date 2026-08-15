import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { StaffApi } from '../lib/data'
import { isOwner, type Role, type StaffUser } from '../lib/types'
import { ApiError } from '../lib/api'
import { CloseIcon, TrashIcon } from '../components/icons'
import { useAuth } from '../lib/auth'
import { useConfirm } from '../lib/confirm'

export function StaffSheet({ onClose }: { onClose: () => void }) {
  const { user: currentUser } = useAuth()
  const [staff, setStaff] = useState<StaffUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'list' | 'add'>('list')
  const [editing, setEditing] = useState<StaffUser | null>(null)

  function load() {
    StaffApi.list()
      .then((list) => setStaff(list.sort((a, b) => a.name.localeCompare(b.name))))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load staff'))
  }

  useEffect(load, [])

  const ownerCount = useMemo(() => (staff ?? []).filter(isOwner).length, [staff])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full max-w-[480px] md:max-w-[600px] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 p-5 pb-3">
          <h2 className="text-base font-bold text-neutral-900">Staff logins</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {error && <p className="my-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {staff === null && !error && <p className="py-6 text-center text-sm text-neutral-400">Loading…</p>}
          {staff?.map((s) => (
            <button
              key={s.id}
              onClick={() => setEditing(s)}
              className="flex w-full items-center justify-between border-b border-neutral-50 py-3 text-left"
            >
              <div>
                <p className="text-sm font-medium text-neutral-900">
                  {s.name} {s.id === currentUser?.id && <span className="text-xs text-neutral-400">(you)</span>}
                </p>
                <p className="text-xs text-neutral-500">{s.email || s.phone || s.username}</p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  isOwner(s) ? 'bg-brand-50 text-brand-700' : 'bg-neutral-100 text-neutral-500'
                }`}
              >
                {isOwner(s) ? 'Owner' : 'Staff'}
              </span>
            </button>
          ))}
        </div>

        <div className="p-5 pt-3">
          {mode === 'add' ? (
            <AddStaffForm
              onCancel={() => setMode('list')}
              onAdded={(newUser) => {
                setStaff((prev) => (prev ? [...prev, newUser].sort((a, b) => a.name.localeCompare(b.name)) : [newUser]))
                setMode('list')
              }}
            />
          ) : (
            <button
              onClick={() => setMode('add')}
              className="w-full rounded-xl bg-brand-700 py-3 font-semibold text-white active:bg-brand-800"
            >
              + Add staff login
            </button>
          )}
        </div>
      </div>

      {editing && (
        <EditStaffSheet
          staffMember={editing}
          isSelf={editing.id === currentUser?.id}
          isLastOwner={isOwner(editing) && ownerCount <= 1}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setStaff((prev) => prev?.map((s) => (s.id === updated.id ? updated : s)) ?? null)
            setEditing(null)
          }}
          onDeleted={(id) => {
            setStaff((prev) => prev?.filter((s) => s.id !== id) ?? null)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function AddStaffForm({ onCancel, onAdded }: { onCancel: () => void; onAdded: (user: StaffUser) => void }) {
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('staff')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setBusy(true)
    try {
      const isEmail = identifier.includes('@')
      const body: { name: string; password: string; role: Role; email?: string; phone?: string } = {
        name: name.trim(),
        password,
        role,
      }
      body[isEmail ? 'email' : 'phone'] = identifier.trim()
      const user = await StaffApi.create(body)
      onAdded(user)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add staff login')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-600">Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-600">Email or phone</span>
        <input
          className="input"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          placeholder="staff@example.com"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-neutral-600">Password</span>
        <input
          className="input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder="At least 8 characters"
        />
      </label>
      <RoleToggle value={role} onChange={setRole} />

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-neutral-200 py-3 font-semibold text-neutral-600 active:bg-neutral-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="flex-1 rounded-xl bg-brand-700 py-3 font-semibold text-white active:bg-brand-800 disabled:opacity-60"
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
    </form>
  )
}

function EditStaffSheet({
  staffMember,
  isSelf,
  isLastOwner,
  onClose,
  onSaved,
  onDeleted,
}: {
  staffMember: StaffUser
  isSelf: boolean
  isLastOwner: boolean
  onClose: () => void
  onSaved: (user: StaffUser) => void
  onDeleted: (id: string) => void
}) {
  const [name, setName] = useState(staffMember.name)
  const [role, setRole] = useState<Role>(isOwner(staffMember) ? 'owner' : 'staff')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmDialog = useConfirm()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword && newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }
    if (isLastOwner && role !== 'owner') {
      setError('This is the only owner — promote someone else first')
      return
    }
    setBusy(true)
    try {
      const body: { name?: string; role?: Role; password?: string } = {}
      if (name.trim() !== staffMember.name) body.name = name.trim()
      if (role !== (isOwner(staffMember) ? 'owner' : 'staff')) body.role = role
      if (newPassword) body.password = newPassword
      const updated = await StaffApi.update(staffMember.id, body)
      onSaved({ ...staffMember, ...updated, name: body.name ?? staffMember.name, role })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save changes')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    const ok = await confirmDialog({
      title: `Remove ${staffMember.name}'s login?`,
      message: "They won't be able to sign in anymore.",
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      await StaffApi.remove(staffMember.id)
      onDeleted(staffMember.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove staff login')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] md:max-w-[600px] rounded-t-2xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">{staffMember.name}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Login</span>
            <p className="rounded-xl bg-neutral-50 px-3 py-2.5 text-sm text-neutral-500">
              {staffMember.email || staffMember.phone || staffMember.username}
            </p>
          </label>
          <RoleToggle value={role} onChange={setRole} disabled={isLastOwner} />
          {isLastOwner && <p className="text-xs text-neutral-400">Only owner — role can't be changed here.</p>}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Reset password (optional)</span>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={8}
              placeholder="Leave blank to keep current password"
            />
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2 pt-1">
            {!isSelf && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy || isLastOwner}
                title={isLastOwner ? "Can't remove the only owner" : undefined}
                className="flex items-center justify-center rounded-xl border border-red-200 px-4 py-3 text-red-600 active:bg-red-50 disabled:opacity-40"
              >
                <TrashIcon className="h-5 w-5" />
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-xl bg-brand-700 py-3 font-semibold text-white active:bg-brand-800 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
          {isSelf && <p className="text-center text-xs text-neutral-400">You can't remove your own login.</p>}
        </form>
      </div>
    </div>
  )
}

function RoleToggle({
  value,
  onChange,
  disabled,
}: {
  value: Role
  onChange: (role: Role) => void
  disabled?: boolean
}) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-neutral-600">Role</span>
      <div className="flex gap-2">
        {(['staff', 'owner'] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            disabled={disabled}
            onClick={() => onChange(r)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold capitalize disabled:opacity-50 ${
              value === r ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-600'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      {value === 'owner' && (
        <p className="mt-1 text-xs text-neutral-400">Owners can see the sales dashboard and manage staff.</p>
      )}
    </div>
  )
}
