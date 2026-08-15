import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ConfirmOptions = {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((value: boolean) => void) | null>(null)

  const confirmDialog = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve
      setState(options)
    })
  }, [])

  function close(result: boolean) {
    resolver.current?.(result)
    resolver.current = null
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirmDialog}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => close(false)}
        >
          <div
            className="w-full max-w-[360px] rounded-2xl bg-white p-5 shadow-xl"
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-bold text-neutral-900">{state.title}</h2>
            {state.message && <p className="mt-1.5 text-sm text-neutral-500">{state.message}</p>}
            <div className="mt-5 flex gap-2">
              <button
                onClick={() => close(false)}
                className="flex-1 rounded-xl border border-neutral-200 py-2.5 text-sm font-semibold text-neutral-600 active:bg-neutral-50"
                autoFocus
              >
                {state.cancelLabel ?? 'Cancel'}
              </button>
              <button
                onClick={() => close(true)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white ${
                  state.danger ? 'bg-red-600 active:bg-red-700' : 'bg-brand-700 active:bg-brand-800'
                }`}
              >
                {state.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider')
  return ctx
}
