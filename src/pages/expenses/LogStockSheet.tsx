import { useState } from 'react'
import { logStockTransaction } from '../../lib/data'
import type { Material, StockTxnType } from '../../lib/types'
import { formatQtyWithUnit, todayIso } from '../../lib/format'
import { ApiError } from '../../lib/api'
import { CloseIcon } from '../../components/icons'

type LoggableType = Exclude<StockTxnType, 'purchase'>

const TYPE_LABEL: Record<LoggableType, string> = {
  usage: 'Used in cooking',
  wastage: 'Wastage / spoilage',
  adjustment_in: 'Correction (add stock)',
  adjustment_out: 'Correction (remove stock)',
}

const TYPES = Object.keys(TYPE_LABEL) as LoggableType[]

export function LogStockSheet({
  material,
  onClose,
  onSaved,
}: {
  material: Material
  onClose: () => void
  onSaved: (material: Material) => void
}) {
  const [type, setType] = useState<LoggableType>('usage')
  const [quantity, setQuantity] = useState('')
  const [date, setDate] = useState(todayIso())
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsedQty = Number(quantity)
  const valid = quantity.trim() !== '' && Number.isFinite(parsedQty) && parsedQty > 0

  const direction = type === 'adjustment_in' ? 1 : -1
  const resultingStock = valid ? material.currentStock + direction * parsedQty : material.currentStock

  async function handleSubmit() {
    if (!valid) return
    setError(null)
    setBusy(true)
    try {
      await logStockTransaction(material, type, parsedQty, {
        transactionDate: date,
        notes: notes.trim() || undefined,
      })
      onSaved({ ...material, currentStock: resultingStock })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log this')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-[480px] md:max-w-[600px] rounded-t-2xl bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-neutral-900">{material.name}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-neutral-500">
          Currently {formatQtyWithUnit(material.currentStock, material.unit)}
        </p>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Reason</span>
            <select className="input" value={type} onChange={(e) => setType(e.target.value as LoggableType)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Quantity ({material.unit})</span>
            <input
              className="input"
              inputMode="decimal"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              autoFocus
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Date</span>
            <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Notes (optional)</span>
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          {valid && (
            <p className="text-sm font-medium text-neutral-600">
              New stock: {formatQtyWithUnit(resultingStock, material.unit)}
              {resultingStock < 0 && (
                <span className="ml-1 text-red-600">(negative — check for a missing purchase)</span>
              )}
            </p>
          )}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={busy || !valid}
            className="w-full rounded-xl bg-brand-700 py-3 font-semibold text-white active:bg-brand-800 disabled:opacity-40"
          >
            {busy ? 'Saving…' : 'Log this'}
          </button>
        </div>
      </div>
    </div>
  )
}
