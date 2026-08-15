import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'

export function Login() {
  const { user, ready, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [shopName, setShopName] = useState('')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (ready && user) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (mode === 'signin') {
        await signIn(identifier.trim(), password)
      } else {
        await signUp(name.trim(), identifier.trim(), password, shopName.trim() || name.trim())
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-brand-50 px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-brand-700 text-2xl font-extrabold text-brand-50">
            SB
          </div>
          <h1 className="text-xl font-bold text-neutral-900">SB Billing</h1>
          <p className="mt-1 text-sm text-neutral-500">Menu &amp; batter counter billing</p>
        </div>

        <div className="mb-5 flex rounded-xl bg-neutral-100 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setMode('signin')}
            className={`flex-1 rounded-lg py-2 ${mode === 'signin' ? 'bg-white text-brand-700 shadow' : 'text-neutral-500'}`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 rounded-lg py-2 ${mode === 'signup' ? 'bg-white text-brand-700 shadow' : 'text-neutral-500'}`}
          >
            First-time setup
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <>
              <Field label="Shop name">
                <input
                  className="input"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="e.g. Sri Saravana Bhavan"
                />
              </Field>
              <Field label="Your name" required>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Owner / staff name"
                />
              </Field>
            </>
          )}
          <Field label="Email or phone" required>
            <input
              className="input"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              inputMode={mode === 'signup' ? 'text' : 'email'}
              placeholder="you@example.com"
            />
          </Field>
          <Field label="Password" required>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              placeholder="••••••••"
            />
          </Field>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-xl bg-brand-700 py-3 font-semibold text-white shadow active:bg-brand-800 disabled:opacity-60"
          >
            {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create shop account'}
          </button>
        </form>

        {mode === 'signup' && (
          <p className="mt-4 text-center text-xs text-neutral-400">
            Use this once to set up your shop. After that, sign in normally.
          </p>
        )}
      </div>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-left">
      <span className="mb-1 block text-xs font-medium text-neutral-600">
        {label}
        {required && <span className="text-brand-700"> *</span>}
      </span>
      {children}
    </label>
  )
}
