import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { isOwner } from '../lib/types'

export function ProtectedRoute({ children, ownerOnly }: { children: ReactNode; ownerOnly?: boolean }) {
  const { user, ready } = useAuth()

  if (!ready) return null
  if (!user) return <Navigate to="/login" replace />
  if (ownerOnly && !isOwner(user)) return <Navigate to="/" replace />
  return <>{children}</>
}
