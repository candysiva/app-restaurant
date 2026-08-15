import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { CategoryApi, MenuApi } from '../lib/data'
import type { CategoryItem, MenuItem, PriceType } from '../lib/types'
import { formatInr } from '../lib/format'
import { PlusIcon, CloseIcon, TrashIcon } from '../components/icons'
import { ApiError } from '../lib/api'

const UNCATEGORIZED = '__uncategorized__'

export function Menu() {
  const [items, setItems] = useState<MenuItem[] | null>(null)
  const [categories, setCategories] = useState<CategoryItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null)

  async function load() {
    try {
      const [data, cats] = await Promise.all([MenuApi.list(), CategoryApi.list()])
      data.sort((a, b) => a.name.localeCompare(b.name))
      cats.sort((a, b) => a.name.localeCompare(b.name))
      setItems(data)
      setCategories(cats)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load menu')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItem[]>()
    for (const cat of categories ?? []) map.set(cat.id, [])
    map.set(UNCATEGORIZED, [])
    for (const item of items ?? []) map.get(item.category?.id ?? UNCATEGORIZED)?.push(item)
    return map
  }, [items, categories])

  async function toggleActive(item: MenuItem) {
    setItems((prev) => prev?.map((i) => (i.id === item.id ? { ...i, active: !i.active } : i)) ?? null)
    try {
      await MenuApi.update(item.id, { active: !item.active })
    } catch {
      load()
    }
  }

  const noCategories = categories !== null && categories.length === 0

  return (
    <div className="flex min-h-full flex-col bg-neutral-50">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-neutral-900">Menu</h1>
        <button
          onClick={() => setEditing('new')}
          disabled={noCategories}
          className="flex items-center gap-1 rounded-full bg-brand-700 px-3 py-1.5 text-sm font-semibold text-white active:bg-brand-800 disabled:opacity-40"
        >
          <PlusIcon className="h-4 w-4" /> Add item
        </button>
      </header>

      {error && <p className="m-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {noCategories && (
        <p className="m-4 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Add a category first — Settings → Categories — before adding menu items.
        </p>
      )}

      {items === null && !error && <p className="p-6 text-center text-sm text-neutral-400">Loading menu…</p>}

      {items !== null && items.length === 0 && !noCategories && (
        <div className="p-8 text-center text-sm text-neutral-400">
          No items yet. Tap "Add item" to build your menu.
        </div>
      )}

      <div className="flex-1 space-y-5 p-4">
        {(categories ?? []).map((cat) => {
          const catItems = grouped.get(cat.id) ?? []
          if (catItems.length === 0) return null
          return (
            <section key={cat.id}>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">{cat.name}</h2>
              <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
                {catItems.map((item) => (
                  <MenuRow key={item.id} item={item} onClick={() => setEditing(item)} />
                ))}
              </div>
            </section>
          )
        })}

        {(grouped.get(UNCATEGORIZED)?.length ?? 0) > 0 && (
          <section>
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">Uncategorized</h2>
            <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
              {grouped.get(UNCATEGORIZED)!.map((item) => (
                <MenuRow key={item.id} item={item} onClick={() => setEditing(item)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {editing && (
        <MenuItemSheet
          item={editing === 'new' ? null : editing}
          categories={categories ?? []}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setItems((prev) => {
              if (!prev) return [saved]
              const exists = prev.some((i) => i.id === saved.id)
              return exists ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved]
            })
            setEditing(null)
          }}
          onDeleted={(id) => {
            setItems((prev) => prev?.filter((i) => i.id !== id) ?? null)
            setEditing(null)
          }}
          onToggleActive={toggleActive}
        />
      )}
    </div>
  )
}

function MenuRow({ item, onClick }: { item: MenuItem; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center justify-between px-4 py-3 text-left ${!item.active ? 'opacity-40' : ''}`}>
      <div>
        <p className="font-medium text-neutral-900">{item.name}</p>
        <p className="text-sm text-neutral-500">
          {formatInr(item.price)}
          {item.priceType === 'per_kg' ? ' / kg' : ''}
        </p>
      </div>
      {!item.active && (
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">Hidden</span>
      )}
    </button>
  )
}

function MenuItemSheet({
  item,
  categories,
  onClose,
  onSaved,
  onDeleted,
}: {
  item: MenuItem | null
  categories: CategoryItem[]
  onClose: () => void
  onSaved: (item: MenuItem) => void
  onDeleted: (id: string) => void
  onToggleActive: (item: MenuItem) => void
}) {
  const [name, setName] = useState(item?.name ?? '')
  const [categoryId, setCategoryId] = useState(item?.category?.id ?? categories[0]?.id ?? '')
  const [priceType, setPriceType] = useState<PriceType>(item?.priceType ?? 'fixed')
  const [price, setPrice] = useState(item ? String(item.price) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsedPrice = Number(price)
    const category = categories.find((c) => c.id === categoryId)
    if (!name.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0 || !category) {
      setError('Enter a name, category, and a valid price')
      return
    }
    setBusy(true)
    try {
      if (item) {
        const updated = await MenuApi.update(item.id, {
          name: name.trim(),
          category,
          priceType,
          price: parsedPrice,
        })
        onSaved(updated)
      } else {
        const created = await MenuApi.create({
          name: name.trim(),
          category,
          priceType,
          price: parsedPrice,
          active: true,
        })
        onSaved(created)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save item')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!item) return
    if (!confirm(`Remove "${item.name}" from the menu?`)) return
    setBusy(true)
    try {
      await MenuApi.remove(item.id)
      onDeleted(item.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete item')
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
          <h2 className="text-base font-bold text-neutral-900">{item ? 'Edit item' : 'New menu item'}</h2>
          <button onClick={onClose} className="rounded-full p-1 text-neutral-400 active:bg-neutral-100">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Name</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Plain Dosa"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-neutral-600">Category</span>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.length === 0 && <option value="">No categories yet</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-neutral-600">Priced by</span>
              <select
                className="input"
                value={priceType}
                onChange={(e) => setPriceType(e.target.value as PriceType)}
              >
                <option value="fixed">Plate / piece</option>
                <option value="per_kg">Per kg</option>
              </select>
            </label>
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-medium text-neutral-600">
                Price (INR{priceType === 'per_kg' ? '/kg' : ''})
              </span>
              <input
                className="input"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
              />
            </label>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2 pt-2">
            {item && (
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
              {busy ? 'Saving…' : item ? 'Save changes' : 'Add to menu'}
            </button>
          </div>

          {item && (
            <button
              type="button"
              onClick={async () => {
                setBusy(true)
                try {
                  const updated = await MenuApi.update(item.id, { active: !item.active })
                  onSaved(updated)
                } finally {
                  setBusy(false)
                }
              }}
              className="w-full pt-1 text-center text-sm font-medium text-neutral-500 underline"
            >
              {item.active ? 'Hide from billing' : 'Show in billing again'}
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
