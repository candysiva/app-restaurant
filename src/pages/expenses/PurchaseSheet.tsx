import { useMemo, useState } from 'react'
import { MaterialApi, submitPurchase, type PurchaseLine } from '../../lib/data'
import type { Purchase, Vendor } from '../../lib/types'
import { formatInr, formatQtyWithUnit, todayIso } from '../../lib/format'
import { ApiError } from '../../lib/api'
import { CloseIcon } from '../../components/icons'
import { useCachedFetch } from '../../lib/cache'

function Blocked({ onClose, message }: { onClose: () => void; message: string }) {
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] md:max-w-[600px] rounded-t-2xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">New purchase</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">{message}</p>
      </div>
    </div>
  )
}

export function PurchaseSheet({
  vendors,
  onClose,
  onSaved,
}: {
  vendors: Vendor[]
  onClose: () => void
  onSaved: (purchase: Purchase) => void
}) {
  const { data: materials } = useCachedFetch('materials', MaterialApi.list)
  const activeMaterials = useMemo(() => (materials ?? []).filter((m) => m.active), [materials])

  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? '')
  const [purchaseDate, setPurchaseDate] = useState(todayIso())
  const [dueDate, setDueDate] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<PurchaseLine[]>([])

  const [materialId, setMaterialId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [unitPrice, setUnitPrice] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const total = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)

  function addLine() {
    const material = activeMaterials.find((m) => m.id === materialId)
    const qty = Number(quantity)
    const price = Number(unitPrice)
    if (!material || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) return
    setLines((prev) => [...prev, { material, quantity: qty, unitPrice: price }])
    setMaterialId('')
    setQuantity('')
    setUnitPrice('')
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSubmit() {
    setError(null)
    const vendor = vendors.find((v) => v.id === vendorId)
    if (!vendor || lines.length === 0) {
      setError('Pick a vendor and add at least one material line')
      return
    }
    setBusy(true)
    try {
      const purchase = await submitPurchase(vendor, lines, {
        purchaseDate,
        dueDate: dueDate || undefined,
        notes: notes.trim() || undefined,
      })
      onSaved(purchase)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the purchase')
      setBusy(false)
    }
  }

  if (vendors.length === 0) {
    return <Blocked onClose={onClose} message="Add a vendor first — Settings → Vendors — before recording a purchase." />
  }
  if (materials !== null && activeMaterials.length === 0) {
    return <Blocked onClose={onClose} message="Add a material first — Settings → Materials & stock — before recording a purchase." />
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full max-w-[480px] md:max-w-[600px] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 p-5 pb-3">
          <h2 className="text-base font-bold text-neutral-900">New purchase</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-3">
          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Vendor</span>
              <select className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Date</span>
              <input
                type="date"
                className="input"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </label>
          </div>

          {lines.length > 0 && (
            <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{line.material.name}</p>
                    <p className="text-xs text-neutral-500">
                      {formatQtyWithUnit(line.quantity, line.material.unit)} × {formatInr(line.unitPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-neutral-900">
                      {formatInr(line.quantity * line.unitPrice)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="text-xs font-medium text-neutral-400 underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-dashed border-neutral-300 p-3">
            <p className="text-xs font-medium text-neutral-600">Add a material line</p>
            <select className="input" value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
              <option value="">Select material</option>
              {activeMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.unit})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                className="input"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Quantity"
              />
              <input
                className="input"
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="Price / unit"
              />
            </div>
            <button
              type="button"
              onClick={addLine}
              disabled={!materialId || !quantity || !unitPrice}
              className="w-full rounded-lg bg-neutral-100 py-2 text-sm font-semibold text-neutral-600 active:bg-neutral-200 disabled:opacity-40"
            >
              + Add line
            </button>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Due date (optional)</span>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Notes (optional)</span>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        <div className="p-5 pt-3">
          <div className="mb-3 flex justify-between text-base font-bold text-neutral-900">
            <span>Total</span>
            <span>{formatInr(total)}</span>
          </div>
          {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={busy || lines.length === 0}
            className="w-full rounded-xl bg-brand-700 py-3.5 font-semibold text-white active:bg-brand-800 disabled:opacity-60"
          >
            {busy ? 'Saving…' : `Save purchase · ${formatInr(total)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
