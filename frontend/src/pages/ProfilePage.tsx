import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { updateProfile, changePassword } from '../api'
import i18n from '../i18n/index'

export function ProfilePage() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { user, refreshUser } = useAuth()
  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [lang, setLang] = useState(user?.language ?? 'de')
  const [currency, setCurrency] = useState(user?.currency ?? 'EUR')
  const [saving, setSaving] = useState(false)
  const [oldPass, setOldPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [changingPw, setChangingPw] = useState(false)

  const saveProfile = async () => {
    try {
      setSaving(true)
      await updateProfile({ username, email, language: lang, currency })
      await refreshUser()
      i18n.changeLanguage(lang)
      localStorage.setItem('helfinance_lang', lang)
      showToast(t('common.success'), 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPass !== confirmPass) { showToast(t('profile.passwordMismatch'), 'error'); return }
    if (newPass.length < 8) { showToast(t('profile.passwordTooShort'), 'error'); return }
    try {
      setChangingPw(true)
      await changePassword(oldPass, newPass)
      showToast(t('common.success'), 'success')
      setOldPass(''); setNewPass(''); setConfirmPass('')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setChangingPw(false)
    }
  }

  return (
    <div className="page-content">
      <h1 className="page-title">{t('profile.title')}</h1>

      <div className="card">
        <div className="card-title">{t('profile.accountInfo')}</div>
        <div className="modal-body">
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('auth.username')}</label>
              <input className="form-control" value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('auth.email')}</label>
              <input className="form-control" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('profile.language')}</label>
              <select className="form-control" value={lang} onChange={e => setLang(e.target.value)}>
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('profile.currency')}</label>
              <select className="form-control" value={currency} onChange={e => setCurrency(e.target.value)}>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={saveProfile} disabled={saving}>{t('common.save')}</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">{t('profile.changePassword')}</div>
        <form onSubmit={savePassword} className="modal-body">
          <div className="form-group">
            <label className="form-label">{t('profile.currentPassword')}</label>
            <input className="form-control" type="password" required value={oldPass} onChange={e => setOldPass(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('profile.newPassword')}</label>
              <input className="form-control" type="password" required minLength={8} value={newPass} onChange={e => setNewPass(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('profile.repeatPassword')}</label>
              <input className="form-control" type="password" required value={confirmPass} onChange={e => setConfirmPass(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={changingPw}>{t('profile.changePassword')}</button>
        </form>
      </div>
    </div>
  )
}
