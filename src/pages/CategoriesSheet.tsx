import { useEffect, useState, type FormEvent } from 'react'
import { CategoryApi, MenuApi } from '../lib/data'
import type { CategoryItem } from '../lib/types'
import { ApiError } from '../lib/api'
import { CloseIcon, TrashIcon } from '../components/icons'

const STARTER_CATEGORIES = ['Tiffin', 'Batter', 'Beverages', 'Others']

export function CategoriesSheet({ onClose }: { onClose: () => void }) {
  const [categories, setCategories] = useState<CategoryItem[] | null>(null)
  const [itemCounts, setItemCounts] = useState<Map<string, number>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<CategoryItem | null>(null)
  const [seeding, setSeeding] = useState(false)

  function load() {
    Promise.all([CategoryApi.list(), MenuApi.list()])
      .then(([cats, items]) => {
        setCategories(cats.sort((a, b) => a.name.localeCompare(b.name)))
        const counts = new Map<string, number>()
        for (const item of items) {
          if (item.category) counts.set(item.category.id, (counts.get(item.category.id) ?? 0) + 1)
        }
        setItemCounts(counts)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load categories'))
  }

  useEffect(load, [])

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setBusy(true)
    try {
      const created = await CategoryApi.create(name.trim())
      setCategories((prev) => [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add category')
    } finally {
      setBusy(false)
    }
  }

  async function seedStarters() {
    setSeeding(true)
    setError(null)
    try {
      const created = await Promise.all(STARTER_CATEGORIES.map((n) => CategoryApi.create(n)))
      setCategories((prev) => [...(prev ?? []), ...created].sort((a, b) => a.name.localeCompare(b.name)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add starter categories')
    } finally {
      setSeeding(false)
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div
        className="flex max-h-[85dvh] w-full max-w-[480px] md:max-w-[600px] flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 p-5 pb-3">
          <h2 className="text-base font-bold text-neutral-900">Categories</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {error && <p className="my-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {categories === null && !error && <p className="py-6 text-center text-sm text-neutral-400">Loading…</p>}
          {categories?.length === 0 && (
            <div className="py-6 text-center">
              <p className="mb-3 text-sm text-neutral-400">No categories yet.</p>
              <button
                onClick={seedStarters}
                disabled={seeding}
                className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-600 active:bg-neutral-50 disabled:opacity-60"
              >
                {seeding ? 'Adding…' : `+ Add starter categories (${STARTER_CATEGORIES.join(', ')})`}
              </button>
            </div>
          )}
          {categories?.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setEditing(cat)}
              className="flex w-full items-center justify-between border-b border-neutral-50 py-3 text-left"
            >
              <span className="text-sm font-medium text-neutral-900">{cat.name}</span>
              <span className="text-xs text-neutral-400">
                {itemCounts.get(cat.id) ?? 0} item{(itemCounts.get(cat.id) ?? 0) === 1 ? '' : 's'}
              </span>
            </button>
          ))}
        </div>

        <div className="p-5 pt-3">
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New category name"
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
        <EditCategorySheet
          category={editing}
          itemCount={itemCounts.get(editing.id) ?? 0}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setCategories((prev) => prev?.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => a.name.localeCompare(b.name)) ?? null)
            setEditing(null)
          }}
          onDeleted={(id) => {
            setCategories((prev) => prev?.filter((c) => c.id !== id) ?? null)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

function EditCategorySheet({
  category,
  itemCount,
  onClose,
  onSaved,
  onDeleted,
}: {
  category: CategoryItem
  itemCount: number
  onClose: () => void
  onSaved: (cat: CategoryItem) => void
  onDeleted: (id: string) => void
}) {
  const [name, setName] = useState(category.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setBusy(true)
    try {
      const updated = await CategoryApi.update(category.id, name.trim())
      onSaved(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not rename category')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (itemCount > 0) return
    if (!confirm(`Delete category "${category.name}"?`)) return
    setBusy(true)
    try {
      await CategoryApi.remove(category.id)
      onDeleted(category.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete category')
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
          <h2 className="text-base font-bold text-neutral-900">Edit category</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Name</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy || itemCount > 0}
              title={itemCount > 0 ? `${itemCount} menu item(s) still use this category` : undefined}
              className="flex items-center justify-center rounded-xl border border-red-200 px-4 py-3 text-red-600 active:bg-red-50 disabled:opacity-40"
            >
              <TrashIcon className="h-5 w-5" />
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-xl bg-brand-700 py-3 font-semibold text-white active:bg-brand-800 disabled:opacity-60"
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
          {itemCount > 0 && (
            <p className="text-center text-xs text-neutral-400">
              {itemCount} menu item{itemCount === 1 ? '' : 's'} use this category — move or remove them first to
              delete it.
            </p>
          )}
        </form>
      </div>
    </div>
  )
}
