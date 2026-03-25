import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { setupInit } from '../api'
import i18n from '../i18n/index'

export function SetupPage() {
  const { t } = useTranslation()
  const { completeSetup } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [language, setLanguage] = useState(localStorage.getItem('helfinance_lang') || 'de')
  const [currency, setCurrency] = useState('EUR')
  const [loading, setLoading] = useState(false)

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value
    setLanguage(lang)
    i18n.changeLanguage(lang)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (username.length < 3) {
      showToast(t('setup.usernameTooShort'), 'error')
      return
    }
    if (password.length < 8) {
      showToast(t('setup.passwordTooShort'), 'error')
      return
    }
    if (password !== confirmPassword) {
      showToast(t('setup.passwordMismatch'), 'error')
      return
    }
    setLoading(true)
    try {
      const res = await setupInit({ username, email, password, language, currency })
      completeSetup(res.token, res.user)
      navigate('/onboarding', { replace: true })
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <span className="logo-icon-large">₿</span>
          <h1 className="auth-title">HELFINANCE</h1>
          <p className="auth-subtitle">{t('setup.subtitle')}</p>
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
              minLength={3}
              autoComplete="username"
            />
          </div>

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

          <div className="form-group">
            <label className="form-label">{t('auth.password')}</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('setup.confirmPassword')}</label>
            <input
              className="form-input"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('setup.defaultLanguage')}</label>
              <select className="form-input" value={language} onChange={handleLanguageChange}>
                <option value="de">🇩🇪 Deutsch</option>
                <option value="en">🇬🇧 English</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('setup.defaultCurrency')}</label>
              <select className="form-input" value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="EUR">EUR €</option>
                <option value="USD">USD $</option>
                <option value="GBP">GBP £</option>
                <option value="CHF">CHF Fr.</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading}
          >
            {loading ? t('common.loading') : t('setup.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
