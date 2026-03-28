import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider, useToast } from './contexts/ToastContext'
import { Layout } from './components/Layout'

import { SetupPage } from './pages/SetupPage'
import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { DashboardPage } from './pages/DashboardPage'
import { IncomePage } from './pages/IncomePage'
import { ExpensesPage } from './pages/ExpensesPage'
import { LoansPage } from './pages/LoansPage'
import { SavingsPage } from './pages/SavingsPage'
import { CashflowPage } from './pages/CashflowPage'
import { MonthlyReportPage } from './pages/MonthlyReportPage'
import { YearlyReportPage } from './pages/YearlyReportPage'
import { HouseholdPage } from './pages/HouseholdPage'
import { AdminPage } from './pages/AdminPage'
import { ProfilePage } from './pages/ProfilePage'
import { AboutPage } from './pages/AboutPage'

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-spinner" />
    </div>
  )
}

function AdminRedirect() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  useEffect(() => {
    showToast('Access denied', 'error')
    navigate('/dashboard', { replace: true })
  }, [])
  return null
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isLoading, isAdmin } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <AdminRedirect />

  return <Layout>{children}</Layout>
}

function RootRedirect() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!user.onboarding_done) return <Navigate to="/onboarding" replace />
  return <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  const { setupRequired, isLoading } = useAuth()

  if (isLoading) return <LoadingScreen />

  if (setupRequired) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <OnboardingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/income"
        element={
          <ProtectedRoute>
            <IncomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses"
        element={
          <ProtectedRoute>
            <ExpensesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/loans"
        element={
          <ProtectedRoute>
            <LoansPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/savings"
        element={
          <ProtectedRoute>
            <SavingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cashflow"
        element={
          <ProtectedRoute>
            <CashflowPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/monthly"
        element={
          <ProtectedRoute>
            <MonthlyReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports/yearly"
        element={
          <ProtectedRoute>
            <YearlyReportPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/household"
        element={
          <ProtectedRoute>
            <HouseholdPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute adminOnly>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/about"
        element={
          <ProtectedRoute>
            <AboutPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
