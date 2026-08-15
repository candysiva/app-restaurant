import { useEffect, useState, type FormEvent } from 'react'
import { CategoryApi, MenuApi, sortCategories } from '../lib/data'
import type { CategoryItem } from '../lib/types'
import { ApiError } from '../lib/api'
import { ChevronDownIcon, ChevronUpIcon, CloseIcon, TrashIcon } from '../components/icons'
import { useConfirm } from '../lib/confirm'

const STARTER_CATEGORIES = ['Tiffin', 'Batter', 'Beverages', 'Others']

export function CategoriesSheet({ onClose }: { onClose: () => void }) {
  const [categories, setCategories] = useState<CategoryItem[] | null>(null)
  const [itemCounts, setItemCounts] = useState<Map<string, number>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<CategoryItem | null>(null)
  const [seeding, setSeeding] = useState(false)
  const [reordering, setReordering] = useState(false)

  function load() {
    Promise.all([CategoryApi.list(), MenuApi.list()])
      .then(([cats, items]) => {
        setCategories(sortCategories(cats))
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
      const nextOrder = (categories ?? []).reduce((max, c) => Math.max(max, c.sortOrder ?? 0), -1) + 1
      const created = await CategoryApi.create(name.trim(), nextOrder)
      setCategories((prev) => [...(prev ?? []), created])
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
      const created = await Promise.all(STARTER_CATEGORIES.map((n, i) => CategoryApi.create(n, i)))
      setCategories((prev) => sortCategories([...(prev ?? []), ...created]))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add starter categories')
    } finally {
      setSeeding(false)
    }
  }

  async function reorder(newList: CategoryItem[]) {
    const prev = categories ?? []
    const renumbered = newList.map((c, i) => ({ ...c, sortOrder: i }))
    setCategories(renumbered)
    setReordering(true)
    setError(null)
    const changed = renumbered.filter((c) => prev.find((p) => p.id === c.id)?.sortOrder !== c.sortOrder)
    try {
      await Promise.all(changed.map((c) => CategoryApi.update(c.id, { sortOrder: c.sortOrder })))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the new order')
      setCategories(prev)
    } finally {
      setReordering(false)
    }
  }

  function moveUp(id: string) {
    const list = categories ?? []
    const idx = list.findIndex((c) => c.id === id)
    if (idx <= 0) return
    const next = list.slice()
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    reorder(next)
  }

  function moveDown(id: string) {
    const list = categories ?? []
    const idx = list.findIndex((c) => c.id === id)
    if (idx === -1 || idx >= list.length - 1) return
    const next = list.slice()
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    reorder(next)
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
          {categories && categories.length > 1 && (
            <p className="mb-1 mt-3 text-xs text-neutral-400">
              Use the arrows to reorder — items you sell most go at the top.
            </p>
          )}
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
          {categories?.map((cat, idx) => (
            <div key={cat.id} className="flex items-center gap-1 border-b border-neutral-50 py-1.5">
              <div className="flex flex-col">
                <button
                  onClick={() => moveUp(cat.id)}
                  disabled={reordering || idx === 0}
                  aria-label={`Move ${cat.name} up`}
                  className="rounded p-1 text-neutral-400 active:bg-neutral-100 disabled:opacity-25"
                >
                  <ChevronUpIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={() => moveDown(cat.id)}
                  disabled={reordering || idx === categories.length - 1}
                  aria-label={`Move ${cat.name} down`}
                  className="rounded p-1 text-neutral-400 active:bg-neutral-100 disabled:opacity-25"
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
              </div>
              <button
                onClick={() => setEditing(cat)}
                className="flex flex-1 items-center justify-between py-1.5 text-left"
              >
                <span className="text-sm font-medium text-neutral-900">{cat.name}</span>
                <span className="text-xs text-neutral-400">
                  {itemCounts.get(cat.id) ?? 0} item{(itemCounts.get(cat.id) ?? 0) === 1 ? '' : 's'}
                </span>
              </button>
            </div>
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
            setCategories((prev) => sortCategories(prev?.map((c) => (c.id === updated.id ? updated : c)) ?? []))
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
  const confirmDialog = useConfirm()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError(null)
    setBusy(true)
    try {
      const updated = await CategoryApi.update(category.id, { name: name.trim() })
      onSaved({ ...category, ...updated })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not rename category')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (itemCount > 0) return
    const ok = await confirmDialog({
      title: `Delete category "${category.name}"?`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
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
