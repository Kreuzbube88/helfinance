import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User } from '../types'
import { setToken, clearToken, getToken, getProfile } from '../api'

interface AuthContextValue {
  user: User | null
  token: string | null
  isAdmin: boolean
  isLoading: boolean
  setupRequired: boolean
  login: (token: string, user: User, persistent?: boolean) => void
  logout: () => void
  refreshUser: () => Promise<void>
  completeSetup: (token: string, user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setTokenState] = useState<string | null>(getToken())
  const [authLoading, setAuthLoading] = useState(true)
  const [setupRequired, setSetupRequired] = useState(false)
  const [setupLoading, setSetupLoading] = useState(true)

  useEffect(() => {
    fetch('/api/v1/setup/status')
      .then(r => r.json())
      .then((d: { setupRequired: boolean }) => setSetupRequired(d.setupRequired))
      .catch(() => {})
      .finally(() => setSetupLoading(false))
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const u = await getProfile()
      setUser(u)
    } catch {
      setUser(null)
      clearToken()
      setTokenState(null)
    }
  }, [])

  useEffect(() => {
    const stored = getToken()
    if (stored) {
      setTokenState(stored)
      getProfile()
        .then(u => setUser(u))
        .catch(() => {
          clearToken()
          setTokenState(null)
        })
        .finally(() => setAuthLoading(false))
    } else {
      setAuthLoading(false)
    }
  }, [])

  const login = useCallback((t: string, u: User, persistent: boolean = true) => {
    setToken(t, persistent)
    setTokenState(t)
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
    setUser(null)
  }, [])

  const completeSetup = useCallback((t: string, u: User) => {
    setSetupRequired(false)
    setToken(t)
    setTokenState(t)
    setUser(u)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAdmin: !!user?.is_admin,
        isLoading: authLoading || setupLoading,
        setupRequired,
        login,
        logout,
        refreshUser,
        completeSetup
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
