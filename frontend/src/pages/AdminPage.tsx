import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { getAdminSettings, updateAdminSettings, sendTestEmail, getAdminUsers, deleteAdminUser } from '../api'
import type { User } from '../types'

export function AdminPage() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { user: me } = useAuth()
  const [tab, setTab] = useState<'smtp' | 'oidc' | 'general' | 'users'>('smtp')
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [users, setUsers] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [testEmail, setTestEmail] = useState('')

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
    if (!testEmail) { showToast('E-Mail-Adresse eingeben', 'error'); return }
    try {
      await sendTestEmail()
      showToast('Test-E-Mail gesendet', 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  const handleDeleteUser = async (id: number) => {
    if (!confirm(t('common.confirm') + '?')) return
    try {
      await deleteAdminUser(id)
      showToast(t('common.success'), 'success')
      load()
    } catch (e) {
      showToast((e as Error).message, 'error')
    }
  }

  return (
    <div className="page-content">
      <h1 className="page-title">{t('admin.title')}</h1>

      <div className="tabs">
        {(['smtp', 'oidc', 'general', 'users'] as const).map(tb => (
          <button key={tb} className={`tab-btn ${tab === tb ? 'active' : ''}`} onClick={() => setTab(tb)}>
            {t(`admin.${tb === 'general' ? 'defaultLanguage' : tb === 'users' ? 'users' : tb.toUpperCase()}`).split(' ')[0]}
            {tb === 'smtp' && ' SMTP'}{tb === 'oidc' && ' OIDC'}{tb === 'general' && ' Allgemein'}{tb === 'users' && ' Benutzer'}
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
                  <label className="form-label">Host</label>
                  <input className="form-control" value={settings.smtp_host ?? ''} onChange={e => set('smtp_host', e.target.value)} placeholder="smtp.example.com" />
                </div>
                <div className="form-group">
                  <label className="form-label">Port</label>
                  <input className="form-control" type="number" value={settings.smtp_port ?? '587'} onChange={e => set('smtp_port', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Benutzer</label>
                  <input className="form-control" value={settings.smtp_user ?? ''} onChange={e => set('smtp_user', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Passwort</label>
                  <input className="form-control" type="password" value={settings.smtp_pass ?? ''} onChange={e => set('smtp_pass', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Von (Absender)</label>
                <input className="form-control" type="email" value={settings.smtp_from ?? ''} onChange={e => set('smtp_from', e.target.value)} placeholder="noreply@example.com" />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Test-E-Mail an</label>
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
                <label className="form-label">Discovery URL</label>
                <input className="form-control" value={settings.oidc_discovery_url ?? ''} onChange={e => set('oidc_discovery_url', e.target.value)} placeholder="https://auth.example.com/.well-known/openid-configuration" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Client ID</label>
                  <input className="form-control" value={settings.oidc_client_id ?? ''} onChange={e => set('oidc_client_id', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Client Secret</label>
                  <input className="form-control" type="password" value={settings.oidc_client_secret ?? ''} onChange={e => set('oidc_client_secret', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Anzeigename</label>
                <input className="form-control" value={settings.oidc_display_name ?? 'SSO'} onChange={e => set('oidc_display_name', e.target.value)} />
              </div>
              <label className="form-check">
                <input type="checkbox" checked={settings.oidc_enabled === 'true'} onChange={e => set('oidc_enabled', e.target.checked ? 'true' : 'false')} />
                OIDC aktivieren
              </label>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{t('common.save')}</button>
            </div>
          </div>
        )}

        {tab === 'general' && (
          <div className="card">
            <div className="card-title">Allgemeine Einstellungen</div>
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
                    <th>Benutzername</th>
                    <th>E-Mail</th>
                    <th>Rolle</th>
                    <th>Erstellt</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td><strong>{u.username}</strong></td>
                      <td className="text-muted">{u.email}</td>
                      <td>{u.is_admin ? <span className="badge badge-warning">Admin</span> : <span className="badge badge-neutral">User</span>}</td>
                      <td className="text-muted">{new Date(u.created_at).toLocaleDateString('de-DE')}</td>
                      <td>
                        {u.id !== me?.id && (
                          <button className="btn btn-sm btn-danger" onClick={() => handleDeleteUser(u.id)}>{t('common.delete')}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
