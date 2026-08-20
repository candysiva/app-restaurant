import { useEffect, useState, type FormEvent } from 'react'
import { MaterialApi } from '../lib/data'
import type { Material, MaterialUnit } from '../lib/types'
import { formatQtyWithUnit, round2 } from '../lib/format'
import { ApiError } from '../lib/api'
import { AlertTriangleIcon, CloseIcon, TrashIcon } from '../components/icons'

const UNITS: MaterialUnit[] = ['kg', 'g', 'litre', 'ml', 'piece', 'packet', 'dozen', 'bag', 'bundle']

export function MaterialsSheet({ onClose }: { onClose: () => void }) {
  const [materials, setMaterials] = useState<Material[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState<MaterialUnit>('kg')
  const [minStockThreshold, setMinStockThreshold] = useState('0')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<Material | null>(null)

  function load() {
    MaterialApi.list()
      .then((list) => setMaterials(list.sort((a, b) => a.name.localeCompare(b.name))))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load materials'))
  }

  useEffect(load, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setBusy(true)
    try {
      const created = await MaterialApi.create({
        name: name.trim(),
        unit,
        minStockThreshold: round2(Number(minStockThreshold) || 0),
      })
      setMaterials((prev) => [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
      setMinStockThreshold('0')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add material')
    } finally {
      setBusy(false)
    }
  }

  const activeMaterials = (materials ?? []).filter((m) => m.active)
  const inactiveMaterials = (materials ?? []).filter((m) => !m.active)
  const lowStockCount = activeMaterials.filter((m) => m.currentStock <= m.minStockThreshold).length

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full max-w-[480px] md:max-w-[600px] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 p-5 pb-3">
          <div>
            <h2 className="text-base font-bold text-neutral-900">Materials</h2>
            {lowStockCount > 0 && (
              <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-red-600">
                <AlertTriangleIcon className="h-3.5 w-3.5" />
                {lowStockCount} low on stock
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {error && <p className="my-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {materials === null && !error && <p className="py-6 text-center text-sm text-neutral-400">Loading…</p>}
          {materials?.length === 0 && (
            <p className="py-6 text-center text-sm text-neutral-400">No materials yet — add one below.</p>
          )}
          {activeMaterials.map((m) => (
            <MaterialRow key={m.id} material={m} onClick={() => setEditing(m)} />
          ))}
          {inactiveMaterials.length > 0 && (
            <>
              <h3 className="mb-1 mt-3 text-xs font-bold uppercase tracking-wide text-neutral-400">Inactive</h3>
              {inactiveMaterials.map((m) => (
                <MaterialRow key={m.id} material={m} onClick={() => setEditing(m)} />
              ))}
            </>
          )}
        </div>

        <div className="p-5 pt-3">
          <form onSubmit={handleAdd} className="space-y-2">
            <div className="flex gap-2">
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Material name, e.g. Rice"
              />
              <select className="input w-28" value={unit} onChange={(e) => setUnit(e.target.value as MaterialUnit)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <input
                className="input"
                inputMode="decimal"
                value={minStockThreshold}
                onChange={(e) => setMinStockThreshold(e.target.value)}
                placeholder="Low-stock threshold"
              />
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="shrink-0 rounded-xl bg-brand-700 px-5 py-2.5 font-semibold text-white active:bg-brand-800 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </form>
        </div>
      </div>

      {editing && (
        <EditMaterialSheet
          material={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setMaterials((prev) => prev?.map((m) => (m.id === updated.id ? updated : m)).sort((a, b) => a.name.localeCompare(b.name)) ?? null)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function MaterialRow({ material, onClick }: { material: Material; onClick: () => void }) {
  const low = material.currentStock <= material.minStockThreshold
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between border-b border-neutral-50 py-3 text-left ${!material.active ? 'opacity-40' : ''}`}
    >
      <div>
        <p className="text-sm font-medium text-neutral-900">{material.name}</p>
        <p className="text-xs text-neutral-500">
          {formatQtyWithUnit(material.currentStock, material.unit)} in stock
        </p>
      </div>
      {material.active && low && (
        <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">
          <AlertTriangleIcon className="h-3 w-3" />
          Low
        </span>
      )}
    </button>
  )
}

function EditMaterialSheet({
  material,
  onClose,
  onSaved,
}: {
  material: Material
  onClose: () => void
  onSaved: (m: Material) => void
}) {
  const [name, setName] = useState(material.name)
  const [unit, setUnit] = useState<MaterialUnit>(material.unit)
  const [minStockThreshold, setMinStockThreshold] = useState(String(material.minStockThreshold))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setBusy(true)
    try {
      const updated = await MaterialApi.update(material.id, {
        name: name.trim(),
        unit,
        minStockThreshold: round2(Number(minStockThreshold) || 0),
      })
      onSaved({ ...material, ...updated })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save material')
    } finally {
      setBusy(false)
    }
  }

  async function toggleActive() {
    setBusy(true)
    try {
      const updated = await MaterialApi.update(material.id, { active: !material.active })
      onSaved({ ...material, ...updated })
    } finally {
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
          <h2 className="text-base font-bold text-neutral-900">Edit material</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Unit</span>
              <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as MaterialUnit)}>
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Low-stock threshold</span>
              <input
                className="input"
                inputMode="decimal"
                value={minStockThreshold}
                onChange={(e) => setMinStockThreshold(e.target.value)}
              />
            </label>
          </div>
          <p className="rounded-xl bg-neutral-50 px-3 py-2.5 text-sm text-neutral-500">
            Current stock: {formatQtyWithUnit(material.currentStock, material.unit)} — log usage, wastage, or a
            correction from the Stock tab, not here.
          </p>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2 pt-1">
            {material.active && (
              <button
                type="button"
                onClick={toggleActive}
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

          {!material.active && (
            <button
              type="button"
              onClick={toggleActive}
              className="w-full pt-1 text-center text-sm font-medium text-neutral-500 underline"
            >
              Reactivate material
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
