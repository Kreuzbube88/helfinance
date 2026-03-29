import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { getAdminSettings, updateAdminSettings, sendTestEmail, getAdminUsers, deleteAdminUser, updateAdminUser } from '../api'
import type { User } from '../types'
import { ConfirmModal } from '../components/ConfirmModal'

export function AdminPage() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { user: me } = useAuth()
  const [tab, setTab] = useState<'smtp' | 'oidc' | 'general' | 'users'>('smtp')
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [users, setUsers] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [testEmail, setTestEmail] = useState('')
  const [resetPassUserId, setResetPassUserId] = useState<number | null>(null)
  const [deleteUserId, setDeleteUserId] = useState<number | null>(null)
  const [resetPassValue, setResetPassValue] = useState('')

  const load = async () => {
    try {
      const [s, u] = await Promise.all([getAdminSettings(), getAdminUsers()])
      setSettings(s)
      setUsers(u)
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  useEffect(() => { load() }, [])

  const set = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }))

  const save = async () => {
    try {
      setSaving(true)
      await updateAdminSettings(settings)
      showToast(t('common.success'), 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleTestEmail = async () => {
    if (!testEmail) { showToast(t('admin.enterEmail'), 'error'); return }
    try {
      await sendTestEmail(testEmail)
      showToast(t('admin.testEmailSent'), 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const handleDeleteUser = async (id: number) => {
    try {
      await deleteAdminUser(id)
      showToast(t('common.success'), 'success')
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const handleToggleAdmin = async (id: number) => {
    try {
      await updateAdminUser(id, { toggle_admin: true })
      showToast(t('common.success'), 'success')
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const handleResetPassword = async (id: number) => {
    if (!resetPassValue) { showToast(t('admin.enterPassword'), 'error'); return }
    if (resetPassValue.length < 8) { showToast(t('admin.passwordMinLength'), 'error'); return }
    try {
      await updateAdminUser(id, { reset_password: resetPassValue })
      showToast(t('common.success'), 'success')
      setResetPassUserId(null)
      setResetPassValue('')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">{t('admin.title')}</h1>

      <div className="tabs">
        {(['smtp', 'oidc', 'general', 'users'] as const).map(tb => (
          <button key={tb} className={`tab-btn ${tab === tb ? 'active' : ''}`} onClick={() => setTab(tb)}>
            {tb === 'smtp' && t('admin.smtp')}
            {tb === 'oidc' && t('admin.oidc')}
            {tb === 'general' && t('admin.generalSettings')}
            {tb === 'users' && t('admin.users')}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {tab === 'smtp' && (
          <div className="card">
            <div className="card-title">{t('admin.smtp')}</div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('admin.smtpHost')}</label>
                  <input className="form-control" value={settings.smtp_host ?? ''} onChange={e => set('smtp_host', e.target.value)} placeholder="smtp.example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('admin.smtpPort')}</label>
                  <input className="form-control" type="number" value={settings.smtp_port ?? '587'} onChange={e => set('smtp_port', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('admin.smtpUser')}</label>
                  <input className="form-control" value={settings.smtp_user ?? ''} onChange={e => set('smtp_user', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('admin.smtpPass')}</label>
                  <input className="form-control" type="password" value={settings.smtp_pass ?? ''} onChange={e => set('smtp_pass', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('admin.smtpFrom')}</label>
                <input className="form-control" type="email" value={settings.smtp_from ?? ''} onChange={e => set('smtp_from', e.target.value)} placeholder="noreply@example.com" />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">{t('admin.smtpTestTo')}</label>
                  <input className="form-control" type="email" value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="test@example.com" />
                </div>
                <button className="btn btn-secondary" onClick={handleTestEmail}>{t('admin.testEmail')}</button>
              </div>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{t('common.save')}</button>
            </div>
          </div>
        )}

        {tab === 'oidc' && (
          <div className="card">
            <div className="card-title">{t('admin.oidc')}</div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{t('admin.discoveryUrl')}</label>
                <input className="form-control" value={settings.oidc_discovery_url ?? ''} onChange={e => set('oidc_discovery_url', e.target.value)} placeholder="https://auth.example.com/.well-known/openid-configuration" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('admin.clientId')}</label>
                  <input className="form-control" value={settings.oidc_client_id ?? ''} onChange={e => set('oidc_client_id', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('admin.clientSecret')}</label>
                  <input className="form-control" type="password" value={settings.oidc_client_secret ?? ''} onChange={e => set('oidc_client_secret', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('admin.oidcDisplayName')}</label>
                <input className="form-control" value={settings.oidc_display_name ?? 'SSO'} onChange={e => set('oidc_display_name', e.target.value)} />
              </div>
              <label className="form-check">
                <input type="checkbox" checked={settings.oidc_enabled === 'true'} onChange={e => set('oidc_enabled', e.target.checked ? 'true' : 'false')} />
                {t('admin.oidcEnable')}
              </label>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{t('common.save')}</button>
            </div>
          </div>
        )}

        {tab === 'general' && (
          <div className="card">
            <div className="card-title">{t('admin.generalSettings')}</div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">{t('admin.defaultLanguage')}</label>
                <select className="form-control" value={settings.default_language ?? 'de'} onChange={e => set('default_language', e.target.value)}>
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('admin.defaultCurrency')}</label>
                <select className="form-control" value={settings.default_currency ?? 'EUR'} onChange={e => set('default_currency', e.target.value)}>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                  <option value="CHF">CHF</option>
                </select>
              </div>
              <label className="form-check">
                <input type="checkbox" checked={settings.allow_registration !== 'false'} onChange={e => set('allow_registration', e.target.checked ? 'true' : 'false')} />
                {t('admin.allowRegistration')}
              </label>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{t('common.save')}</button>
            </div>
          </div>
        )}

        {tab === 'users' && (
          <div className="card">
            <div className="card-title">{t('admin.users')}</div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('admin.tableUsername')}</th>
                    <th>{t('admin.tableEmail')}</th>
                    <th>{t('admin.tableRole')}</th>
                    <th>{t('admin.tableCreated')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.username}</strong></td>
                      <td className="text-muted">{u.email}</td>
                      <td>{u.is_admin ? <span className="badge badge-warning">{t('admin.rolAdmin')}</span> : <span className="badge badge-neutral">{t('admin.rolUser')}</span>}</td>
                      <td className="text-muted">{new Date(u.created_at).toLocaleDateString('de-DE')}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                          {u.id !== me?.id && (
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => handleToggleAdmin(u.id)}
                              title={u.is_admin ? t('admin.demoteUser') : t('admin.promoteAdmin')}
                            >
                              {u.is_admin ? `↓ ${t('admin.rolUser')}` : `↑ ${t('admin.rolAdmin')}`}
                            </button>
                          )}
                          {resetPassUserId === u.id ? (
                            <>
                              <input
                                className="form-control"
                                type="password"
                                placeholder={t('admin.newPasswordPlaceholder')}
                                value={resetPassValue}
                                onChange={e => setResetPassValue(e.target.value)}
                                style={{ width: '10rem' }}
                              />
                              <button className="btn btn-sm btn-primary" onClick={() => handleResetPassword(u.id)}>✓</button>
                              <button className="btn btn-sm btn-ghost" onClick={() => { setResetPassUserId(null); setResetPassValue('') }}>✕</button>
                            </>
                          ) : (
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => { setResetPassUserId(u.id); setResetPassValue('') }}
                            >
                              {t('admin.pwReset')}
                            </button>
                          )}
                          {u.id !== me?.id && (
                            <button className="btn btn-sm btn-danger" onClick={() => setDeleteUserId(u.id)}>{t('common.delete')}</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {deleteUserId !== null && (
        <ConfirmModal
          onConfirm={() => handleDeleteUser(deleteUserId)}
          onClose={() => setDeleteUserId(null)}
        />
      )}
    </div>
  )
}
