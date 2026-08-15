import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { ProtectedRoute } from './components/ProtectedRoute'
import { BottomNav } from './components/BottomNav'
import { Login } from './pages/Login'
import { Billing } from './pages/Billing'
import { Menu } from './pages/Menu'
import { Orders } from './pages/Orders'
import { Dashboard } from './pages/Dashboard'

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
          <Route
            path="/menu"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Menu />
                </AppShell>
              </ProtectedRoute>
            }
          />
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
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppShell>
                  <Dashboard />
                </AppShell>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
