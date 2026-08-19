import { useMemo } from 'react'
import { MaterialApi } from '../../lib/data'
import type { Material } from '../../lib/types'
import { formatQtyWithUnit } from '../../lib/format'
import { ApiError } from '../../lib/api'
import { AlertTriangleIcon } from '../../components/icons'
import { useCachedFetch } from '../../lib/cache'

const EMPTY_MATERIALS: Material[] = []

export function StockTab() {
  const { data: rawMaterials, loading, error: fetchError } = useCachedFetch('materials', MaterialApi.list)

  const materials = useMemo(() => (rawMaterials ?? EMPTY_MATERIALS).filter((m) => m.active), [rawMaterials])
  const error = fetchError ? (fetchError instanceof ApiError ? fetchError.message : 'Could not load materials') : null

  const needsReorder = useMemo(
    () => materials.filter((m) => m.currentStock <= m.minStockThreshold).sort((a, b) => a.name.localeCompare(b.name)),
    [materials],
  )
  const ok = useMemo(
    () => materials.filter((m) => m.currentStock > m.minStockThreshold).sort((a, b) => a.name.localeCompare(b.name)),
    [materials],
  )

  return (
    <div className="flex-1 space-y-5 p-4">
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && materials.length === 0 && !error && (
        <p className="p-6 text-center text-sm text-neutral-400">Loading…</p>
      )}
      {!loading && materials.length === 0 && !error && (
        <p className="p-8 text-center text-sm text-neutral-400">
          No materials yet — add one from Settings → Materials &amp; stock.
        </p>
      )}

      {materials.length > 0 && (
        <p className="text-xs text-neutral-400">
          To log usage, wastage, or a correction, open the material from Settings → Materials &amp; stock.
        </p>
      )}

      {needsReorder.length > 0 && (
        <section>
          <h2 className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-red-600">
            <AlertTriangleIcon className="h-3.5 w-3.5" /> Needs reorder
          </h2>
          <div className="divide-y divide-neutral-100 rounded-xl border border-red-200 bg-white">
            {needsReorder.map((m) => (
              <StockRow key={m.id} material={m} />
            ))}
          </div>
        </section>
      )}

      {ok.length > 0 && (
        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-400">In stock</h2>
          <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
            {ok.map((m) => (
              <StockRow key={m.id} material={m} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function StockRow({ material }: { material: Material }) {
  const low = material.currentStock <= material.minStockThreshold
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <p className="text-sm font-medium text-neutral-900">{material.name}</p>
        <p className="text-xs text-neutral-500">
          Threshold: {formatQtyWithUnit(material.minStockThreshold, material.unit)}
        </p>
      </div>
      <span className={`text-sm font-bold ${low ? 'text-red-600' : 'text-neutral-900'}`}>
        {formatQtyWithUnit(material.currentStock, material.unit)}
      </span>
    </div>
  )
}
