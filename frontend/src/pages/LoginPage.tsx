import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { login, register, getOidcConfig } from '../api'

export function LoginPage() {
  const { t } = useTranslation()
  const { login: authLogin, user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oidcConfig, setOidcConfig] = useState<{ enabled: boolean; display_name: string; url: string } | null>(null)

  useEffect(() => {
    if (user) {
      navigate(user.onboarding_done ? '/dashboard' : '/onboarding', { replace: true })
    }
  }, [user, navigate])

  useEffect(() => {
    getOidcConfig()
      .then(cfg => {
        if (cfg.enabled) setOidcConfig(cfg)
      })
      .catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const res = await login(username, password)
        authLogin(res.token, res.user)
        navigate(res.user.onboarding_done ? '/dashboard' : '/onboarding', { replace: true })
      } else {
        const res = await register(username, email, password)
        authLogin(res.token, res.user)
        navigate('/onboarding', { replace: true })
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleOidc = () => {
    if (oidcConfig?.url) {
      window.location.href = oidcConfig.url
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-icon-large">₿</span>
          <h1 className="auth-title">HELFINANCE</h1>
          <p className="auth-subtitle">Personal Finance Dashboard</p>
        </div>

        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            {t('auth.login')}
          </button>
          <button
            className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            {t('auth.register')}
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('auth.username')}</label>
            <input
              className="form-input"
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">{t('auth.email')}</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">{t('auth.password')}</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? t('common.loading') : (mode === 'login' ? t('auth.login') : t('auth.register'))}
          </button>
        </form>

        {oidcConfig && (
          <div className="auth-oidc">
            <div className="divider"><span>oder</span></div>
            <button className="btn btn-secondary btn-full" onClick={handleOidc}>
              {t('auth.loginWith')} {oidcConfig.display_name}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
