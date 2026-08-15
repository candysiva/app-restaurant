import { useEffect, useState, type FormEvent } from 'react'
import { StaffApi } from '../lib/data'
import type { StaffUser } from '../lib/types'
import { ApiError } from '../lib/api'
import { CloseIcon } from '../components/icons'

export function StaffSheet({ onClose }: { onClose: () => void }) {
  const [staff, setStaff] = useState<StaffUser[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  function load() {
    StaffApi.list()
      .then((list) => setStaff(list.sort((a, b) => a.name.localeCompare(b.name))))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load staff'))
  }

  useEffect(load, [])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full max-w-[480px] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
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
            <div key={s.id} className="flex items-center justify-between border-b border-neutral-50 py-3">
              <div>
                <p className="text-sm font-medium text-neutral-900">{s.name}</p>
                <p className="text-xs text-neutral-500">{s.email || s.phone || s.username}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 pt-3">
          {showAdd ? (
            <AddStaffForm
              onCancel={() => setShowAdd(false)}
              onAdded={(user) => {
                setStaff((prev) => (prev ? [...prev, user].sort((a, b) => a.name.localeCompare(b.name)) : [user]))
                setShowAdd(false)
              }}
            />
          ) : (
            <button
              onClick={() => setShowAdd(true)}
              className="w-full rounded-xl bg-brand-700 py-3 font-semibold text-white active:bg-brand-800"
            >
              + Add staff login
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function AddStaffForm({ onCancel, onAdded }: { onCancel: () => void; onAdded: (user: StaffUser) => void }) {
  const [name, setName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
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
      const body: { name: string; password: string; email?: string; phone?: string } = {
        name: name.trim(),
        password,
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
