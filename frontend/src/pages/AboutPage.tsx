import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

const VERSION = '1.0.0'

const FEATURES = [
  { icon: '📊', labelKey: 'nav.dashboard', descKey: 'about.featureDashboard' },
  { icon: '💰', labelKey: 'nav.income', descKey: 'about.featureIncome' },
  { icon: '💸', labelKey: 'nav.expenses', descKey: 'about.featureExpenses' },
  { icon: '🏦', labelKey: 'nav.loans', descKey: 'about.featureLoans' },
  { icon: '🐷', labelKey: 'nav.savings', descKey: 'about.featureSavings' },
  { icon: '📈', labelKey: 'nav.reports', descKey: 'about.featureReports' },
  { icon: '🔔', labelKey: 'common.notifications', descKey: 'about.featureNotifications' },
  { icon: '🌐', labelKey: 'admin.oidc', descKey: 'about.featureOidc' },
  { icon: '📱', labelKey: 'PWA', descKey: 'about.featurePwa' },
  { icon: '🌍', labelKey: 'i18n', descKey: 'about.featureI18n' },
]

const TECH = ['Node.js', 'Express', 'React', 'Vite', 'TypeScript', 'SQLite', 'better-sqlite3', 'i18next', 'pdfkit', 'nodemailer', 'openid-client', 'vite-plugin-pwa', 'Chart.js']

const MIT_TEXT = `MIT License

Copyright (c) 2025 Kreuzbube88

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`

export function AboutPage() {
  const { t } = useTranslation()
  const [licenseOpen, setLicenseOpen] = useState(false)

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="card about-page">
        <div className="about-logo">
          <img src="/logo.png" alt="HELFINANCE" />
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>HELFINANCE</h1>
            <span className="badge badge-info">v{VERSION}</span>
          </div>
        </div>

        <p style={{ color: 'var(--color-text-muted)' }}>
          {t('about.subtitle')}
        </p>

        <div>
          <div className="card-title">{t('about.features')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {FEATURES.map(f => (
              <div key={f.labelKey} style={{ display: 'flex', gap: '0.625rem', padding: '0.75rem', background: 'var(--color-surface-2)', borderRadius: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{f.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{t(f.labelKey, { defaultValue: f.labelKey })}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t(f.descKey)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="card-title">{t('about.techStack')}</div>
          <div className="tech-grid">
            {TECH.map(t => <span key={t} className="tech-badge">{t}</span>)}
          </div>
        </div>

        <div>
          <div className="card-title">{t('about.privacy')}</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{t('about.privacyText')}</p>
        </div>

        <div>
          <div className="card-title">{t('about.changelog')}</div>
          <div style={{ fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <span className="badge badge-success">v1.0.0</span>
              <span className="text-muted">{t('about.initialRelease')}</span>
            </div>
          </div>
        </div>

        <div style={{ background: 'var(--color-surface-2)', borderRadius: '0.5rem', padding: '1rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>
            {t('about.credits')}
          </p>
          <a href="https://github.com/Kreuzbube88/helfinance" target="_blank" rel="noreferrer"
            className="btn btn-secondary btn-sm" style={{ marginTop: '0.75rem', display: 'inline-flex' }}>
            GitHub ↗
          </a>
        </div>

        <div>
          <button className="collapsible-btn" onClick={() => setLicenseOpen(o => !o)}>
            <span>📄 {t('about.license')} (MIT)</span>
            <span>{licenseOpen ? '▲' : '▼'}</span>
          </button>
          {licenseOpen && <pre className="license-text">{MIT_TEXT}</pre>}
        </div>

      </div>
    </div>
  )
}
