import { useEffect, useState, type FormEvent } from 'react'
import { PurchaseApi, VendorApi } from '../lib/data'
import type { Vendor } from '../lib/types'
import { formatInr } from '../lib/format'
import { ApiError } from '../lib/api'
import { CloseIcon, TrashIcon } from '../components/icons'
import { useConfirm } from '../lib/confirm'

export function VendorsSheet({ onClose }: { onClose: () => void }) {
  const [vendors, setVendors] = useState<Vendor[] | null>(null)
  const [balances, setBalances] = useState<Map<string, number>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Vendor | null>(null)

  function load() {
    Promise.all([VendorApi.list(), PurchaseApi.listAll()])
      .then(([vs, purchases]) => {
        setVendors(vs.sort((a, b) => a.name.localeCompare(b.name)))
        const map = new Map<string, number>()
        for (const p of purchases) {
          map.set(p.vendor.id, (map.get(p.vendor.id) ?? 0) + p.balanceDue)
        }
        setBalances(map)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load vendors'))
  }

  useEffect(load, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setBusy(true)
    try {
      const created = await VendorApi.create({ name: name.trim(), phone: phone.trim() || undefined })
      setVendors((prev) => [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
      setPhone('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add vendor')
    } finally {
      setBusy(false)
    }
  }

  const activeVendors = (vendors ?? []).filter((v) => v.active)
  const inactiveVendors = (vendors ?? []).filter((v) => !v.active)

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full max-w-[480px] md:max-w-[600px] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 p-5 pb-3">
          <h2 className="text-base font-bold text-neutral-900">Vendors</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {error && <p className="my-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {vendors === null && !error && <p className="py-6 text-center text-sm text-neutral-400">Loading…</p>}
          {vendors?.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-400">No vendors yet — add one below.</p>
          )}
          {activeVendors.map((v) => (
            <VendorRow key={v.id} vendor={v} balanceDue={balances.get(v.id) ?? 0} onClick={() => setEditing(v)} />
          ))}
          {inactiveVendors.length > 0 && (
            <>
              <h3 className="mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-neutral-400">Inactive</h3>
              {inactiveVendors.map((v) => (
                <VendorRow key={v.id} vendor={v} balanceDue={balances.get(v.id) ?? 0} onClick={() => setEditing(v)} />
              ))}
            </>
          )}
        </div>

        <div className="p-5 pt-3">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Vendor name"
            />
            <input
              className="input w-28"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
            />
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="shrink-0 rounded-xl bg-brand-700 px-5 py-2.5 font-semibold text-white active:bg-brand-800 disabled:opacity-40"
            >
              Add
            </button>
          </form>
        </div>
      </div>

      {editing && (
        <EditVendorSheet
          vendor={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setVendors((prev) => prev?.map((v) => (v.id === updated.id ? updated : v)).sort((a, b) => a.name.localeCompare(b.name)) ?? null)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function VendorRow({ vendor, balanceDue, onClick }: { vendor: Vendor; balanceDue: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between border-b border-neutral-50 py-3 text-left ${!vendor.active ? 'opacity-40' : ''}`}
    >
      <div>
        <p className="text-sm font-medium text-neutral-900">{vendor.name}</p>
        {vendor.phone && <p className="text-xs text-neutral-500">{vendor.phone}</p>}
      </div>
      {balanceDue > 0 && (
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
          {formatInr(balanceDue)} due
        </span>
      )}
    </button>
  )
}

function EditVendorSheet({
  vendor,
  onClose,
  onSaved,
}: {
  vendor: Vendor
  onClose: () => void
  onSaved: (v: Vendor) => void
}) {
  const [name, setName] = useState(vendor.name)
  const [phone, setPhone] = useState(vendor.phone ?? '')
  const [address, setAddress] = useState(vendor.address ?? '')
  const [notes, setNotes] = useState(vendor.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const confirmDialog = useConfirm()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setBusy(true)
    try {
      const updated = await VendorApi.update(vendor.id, {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        notes: notes.trim(),
      })
      onSaved({ ...vendor, ...updated })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save vendor')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    const ok = await confirmDialog({
      title: `Remove "${vendor.name}"?`,
      message: 'This hides them from future purchases but keeps past purchase history intact.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    setBusy(true)
    try {
      const updated = await VendorApi.update(vendor.id, { active: false })
      onSaved({ ...vendor, ...updated })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove vendor')
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
          <h2 className="text-base font-bold text-neutral-900">Edit vendor</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Phone</span>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Address</span>
            <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Notes</span>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2 pt-1">
            {vendor.active && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={busy}
                className="flex items-center justify-center rounded-xl border border-red-200 px-4 py-3 text-red-600 active:bg-red-50 disabled:opacity-60"
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

          {!vendor.active && (
            <button
              type="button"
              onClick={async () => {
                setBusy(true)
                try {
                  const updated = await VendorApi.update(vendor.id, { active: true })
                  onSaved({ ...vendor, ...updated })
                } finally {
                  setBusy(false)
                }
              }}
              className="w-full pt-1 text-center text-sm font-medium text-neutral-500 underline"
            >
              Reactivate vendor
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
