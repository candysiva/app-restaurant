import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ConfirmProvider } from './lib/confirm'
import { ProtectedRoute } from './components/ProtectedRoute'
import { BottomNav } from './components/BottomNav'
import { Login } from './pages/Login'
import { Billing } from './pages/Billing'
import { Orders } from './pages/Orders'
import { Stock } from './pages/Stock'
import { Purchases } from './pages/Purchases'
import { Dashboard } from './pages/Dashboard'
import { Settings } from './pages/Settings'

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex-1 overflow-y-auto">{children}</div>
      <BottomNav />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Billing />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            {/* Menu management moved into More — keep old bookmarks/links working. */}
            <Route path="/menu" element={<Navigate to="/settings" replace />} />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Orders />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/stock"
              element={
                <ProtectedRoute ownerOnly>
                  <AppShell>
                    <Stock />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/purchases"
              element={
                <ProtectedRoute ownerOnly>
                  <AppShell>
                    <Purchases />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            {/* Expenses tab was split into Stock (its own nav tab) and Purchases (moved into More). */}
            <Route path="/expenses" element={<Navigate to="/stock" replace />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute ownerOnly>
                  <AppShell>
                    <Dashboard />
                  </AppShell>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <AppShell>
                    <Settings />
                  </AppShell>
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </ConfirmProvider>
    </AuthProvider>
  )
}
