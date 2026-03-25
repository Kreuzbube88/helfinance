import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { User } from '../types'
import { setToken, clearToken, getToken, getProfile } from '../api'

interface AuthContextValue {
  user: User | null
  token: string | null
  isAdmin: boolean
  isLoading: boolean
  login: (token: string, user: User) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setTokenState] = useState<string | null>(getToken())
  const [isLoading, setIsLoading] = useState(true)

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
        .finally(() => setIsLoading(false))
    } else {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback((t: string, u: User) => {
    setToken(t)
    setTokenState(t)
    setUser(u)
  }, [])

  const logout = useCallback(() => {
    clearToken()
    setTokenState(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAdmin: user?.is_admin ?? false,
        isLoading,
        login,
        logout,
        refreshUser
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
