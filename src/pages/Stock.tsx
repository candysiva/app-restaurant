import { useMemo, useState } from 'react'
import { MaterialApi, logStockTransaction } from '../lib/data'
import type { Material, StockTxnType } from '../lib/types'
import { formatQtyWithUnit, todayIso } from '../lib/format'
import { ApiError } from '../lib/api'
import { AlertTriangleIcon, CloseIcon } from '../components/icons'
import { useCachedFetch } from '../lib/cache'

const EMPTY_MATERIALS: Material[] = []

export function Stock() {
  const {
    data: rawMaterials,
    loading,
    error: fetchError,
    mutate,
  } = useCachedFetch('materials', MaterialApi.list)
  const [logging, setLogging] = useState<Material | null>(null)

  const materials = useMemo(() => (rawMaterials ?? EMPTY_MATERIALS).filter((m) => m.active), [rawMaterials])
  const error = fetchError ? (fetchError instanceof ApiError ? fetchError.message : 'Could not load stock') : null

  const needsReorder = useMemo(
    () => materials.filter((m) => m.currentStock <= m.minStockThreshold).sort((a, b) => a.name.localeCompare(b.name)),
    [materials],
  )
  const ok = useMemo(
    () => materials.filter((m) => m.currentStock > m.minStockThreshold).sort((a, b) => a.name.localeCompare(b.name)),
    [materials],
  )

  return (
    <div className="flex min-h-full flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <h1 className="text-lg font-bold text-neutral-900">Stock</h1>
      </header>

      <div className="flex-1 space-y-5 p-4">
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {loading && materials.length === 0 && !error && (
          <p className="p-6 text-center text-sm text-neutral-400">Loading…</p>
        )}
        {!loading && materials.length === 0 && !error && (
          <p className="p-8 text-center text-sm text-neutral-400">
            No materials yet — add one from More → Materials.
          </p>
        )}

        {materials.length > 0 && (
          <p className="text-xs text-neutral-400">Tap a material to log usage, wastage, or a correction.</p>
        )}

        {needsReorder.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-red-600">
              <AlertTriangleIcon className="h-3.5 w-3.5" /> Needs reorder
            </h2>
            <div className="divide-y divide-neutral-100 rounded-xl border border-red-200 bg-white">
              {needsReorder.map((m) => (
                <StockRow key={m.id} material={m} onClick={() => setLogging(m)} />
              ))}
            </div>
          </section>
        )}

        {ok.length > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">In stock</h2>
            <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
              {ok.map((m) => (
                <StockRow key={m.id} material={m} onClick={() => setLogging(m)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {logging && (
        <LogStockSheet
          material={logging}
          onClose={() => setLogging(null)}
          onSaved={(updated) => {
            mutate((prev) => (prev ?? []).map((m) => (m.id === updated.id ? updated : m)))
            setLogging(null)
          }}
        />
      )}
    </div>
  )
}

function StockRow({ material, onClick }: { material: Material; onClick: () => void }) {
  const low = material.currentStock <= material.minStockThreshold
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between px-4 py-3 text-left">
      <div>
        <p className="text-sm font-medium text-neutral-900">{material.name}</p>
        <p className="text-xs text-neutral-500">
          Threshold: {formatQtyWithUnit(material.minStockThreshold, material.unit)}
        </p>
      </div>
      <span className={`text-sm font-bold ${low ? 'text-red-600' : 'text-neutral-900'}`}>
        {formatQtyWithUnit(material.currentStock, material.unit)}
      </span>
    </button>
  )
}

type LoggableType = Exclude<StockTxnType, 'purchase'>

const TYPE_LABEL: Record<LoggableType, string> = {
  usage: 'Used in cooking',
  wastage: 'Wastage / spoilage',
  adjustment_in: 'Correction (add stock)',
  adjustment_out: 'Correction (remove stock)',
}

const TYPES = Object.keys(TYPE_LABEL) as LoggableType[]

function LogStockSheet({
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
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
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
