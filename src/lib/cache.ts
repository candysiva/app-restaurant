import { useCallback, useEffect, useState } from 'react'

const cache = new Map<string, unknown>()

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value)
}

/**
 * Stale-while-revalidate: shows cached data instantly (no loading flash) on
 * repeat visits to the same key, while refetching in the background. Only
 * blocks on `loading` the first time a key has never been fetched.
 *
 * `mutate` updates both this component's state and the shared cache, so an
 * optimistic update made on one page (e.g. adding a menu item) is visible
 * immediately if the user switches to another page reading the same key.
 */
export function useCachedFetch<T>(key: string, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(() => getCached<T>(key) ?? null)
  const [loading, setLoading] = useState(() => getCached<T>(key) === undefined)
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    let cancelled = false
    const cached = getCached<T>(key)
    setData(cached ?? null)
    setLoading(cached === undefined)
    setError(null)

    fetcher()
      .then((result) => {
        if (cancelled) return
        setCached(key, result)
        setData(result)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const mutate = useCallback(
    (updater: T | ((prev: T | null) => T)) => {
      setData((prev) => {
        const next = typeof updater === 'function' ? (updater as (prev: T | null) => T)(prev) : updater
        setCached(key, next)
        return next
      })
    },
    [key],
  )

  return { data, loading, error, mutate }
}
