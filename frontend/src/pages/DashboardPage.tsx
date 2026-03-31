import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { getDashboard, getWidgetPrefs, updateWidgetPref } from '../api'
import type { DashboardData } from '../types'
import { Modal } from '../components/Modal'

const WIDGET_KEYS = ['healthScore', 'budget', 'freeMoney', 'upcomingBookings'] as const
type WidgetKey = typeof WIDGET_KEYS[number]

function HealthGauge({ score }: { score: number }) {
  const clamp = Math.min(100, Math.max(0, score))
  const angle = (clamp / 100) * 180
  const rad = (angle - 90) * (Math.PI / 180)
  const cx = 100
  const cy = 100
  const r = 70
  const nx = cx + r * Math.cos(rad)
  const ny = cy + r * Math.sin(rad)

  const color = clamp >= 70 ? '#10b981' : clamp >= 40 ? '#f59e0b' : '#ef4444'

  return (
    <svg viewBox="0 0 200 120" className="health-gauge">
      <path d="M 30 100 A 70 70 0 0 1 170 100" fill="none" stroke="var(--color-surface-active)" strokeWidth="12" strokeLinecap="round" />
      <path
        d={`M 30 100 A 70 70 0 ${angle > 90 ? 1 : 0} 1 ${nx} ${ny}`}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
      />
      <text x="100" y="88" textAnchor="middle" fontSize="28" fontWeight="bold" fill={color}>{clamp}</text>
      <text x="100" y="108" textAnchor="middle" fontSize="11" fill="var(--color-text-muted)">/ 100</text>
    </svg>
  )
}

function TrafficLight({ status }: { status: 'green' | 'yellow' | 'red' }) {
  const { t } = useTranslation()
  return (
    <div className="traffic-light">
      <div className={`traffic-dot tl-red ${status === 'red' ? 'active' : ''}`} />
      <div className={`traffic-dot tl-yellow ${status === 'yellow' ? 'active' : ''}`} />
      <div className={`traffic-dot tl-green ${status === 'green' ? 'active' : ''}`} />
      <span className="tl-label">{t(`dashboard.budget.${status}`)}</span>
    </div>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [liquidityDismissed, setLiquidityDismissed] = useState(false)
  const [showCustomize, setShowCustomize] = useState(false)
  const [widgets, setWidgets] = useState<Record<WidgetKey, boolean>>({
    healthScore: true, budget: true, freeMoney: true, upcomingBookings: true
  })

  const loadDashboard = () => {
    setLoading(true)
    Promise.all([getDashboard(), getWidgetPrefs()])
      .then(([d, prefs]) => {
        setData(d)
        setWidgets(prev => ({ ...prev, ...prefs }) as Record<WidgetKey, boolean>)
      })
      .catch(() => showToast(t('common.error'), 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadDashboard() }, [])

  const toggleWidget = async (key: WidgetKey) => {
    const next = !widgets[key]
    setWidgets(prev => ({ ...prev, [key]: next }))
    try { await updateWidgetPref(key, next) } catch { /* non-critical */ }
  }

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  if (loading) {
    return (
      <div className="page">
        <div className="page-loading">{t('common.loading')}</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page">
        <p className="text-muted">{t('common.noData')}</p>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('dashboard.title')}</h1>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowCustomize(true)}>
          ⊞ {t('dashboard.customize')}
        </button>
      </div>

      {data.liquidity_warning && !liquidityDismissed && (
        <div className="alert alert-warning">
          <span>⚠ {t('dashboard.liquidityWarning')}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setLiquidityDismissed(true)}>✕</button>
        </div>
      )}

      {data.reserve_warning && (
        <div className="alert alert-warning">
          <span>⚠ {t('dashboard.reserveWarning', { required: fmt(data.required_reserve_monthly * 3), balance: fmt(data.savings_balance) })}</span>
        </div>
      )}

      <div className="dashboard-grid">
        {widgets.healthScore && (
          <div className="card dashboard-card card-health">
            <h3 className="card-title">{t('dashboard.healthScore')}</h3>
            <HealthGauge score={data.health_score} />
          </div>
        )}

        {widgets.budget && (
          <div className="card dashboard-card">
            <h3 className="card-title">{t('dashboard.budgetTitle')}</h3>
            <TrafficLight status={data.budget_status} />
            <div className="budget-numbers">
              <div className="budget-row">
                <span className="text-muted">{t('dashboard.income')}</span>
                <span className="text-success">{fmt(data.total_income)}</span>
              </div>
              <div className="budget-row">
                <span className="text-muted">{t('dashboard.expenses')}</span>
                <span className="text-danger">{fmt(data.total_expenses)}</span>
              </div>
            </div>
          </div>
        )}

        {widgets.freeMoney && (
          <div className="card dashboard-card card-free-money">
            <h3 className="card-title">{t('dashboard.freeMoney')}</h3>
            <div className={`free-money-amount ${data.free_money < 0 ? 'negative' : 'positive'}`}>
              {fmt(data.free_money)}
            </div>
            <p className="text-muted text-sm">{t('common.thisMonth')}</p>
          </div>
        )}

        {widgets.upcomingBookings && (
          <div className="card dashboard-card">
            <h3 className="card-title">{t('dashboard.upcomingBookings')}</h3>
            {data.upcoming_bookings.length === 0 ? (
              <p className="text-muted">{t('common.noData')}</p>
            ) : (
              <div>
                {data.upcoming_bookings.slice(0, 5).map((b, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.5rem 0',
                    borderBottom: i < Math.min(data.upcoming_bookings.length, 5) - 1 ? '1px solid var(--color-border)' : 'none',
                  }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                      background: b.type === 'income' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700,
                      color: b.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                      {b.booking_day}.
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {b.name}
                      </div>
                    </div>
                    <span style={{
                      fontWeight: 700, fontSize: '0.875rem',
                      color: b.type === 'income' ? 'var(--color-success)' : 'var(--color-danger)',
                    }}>
                      {b.type === 'income' ? '+' : '−'}{fmt(b.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showCustomize && (
        <Modal title={t('dashboard.customize')} onClose={() => setShowCustomize(false)} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {WIDGET_KEYS.map(key => (
              <label key={key} className="form-check" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={widgets[key]}
                  onChange={() => toggleWidget(key)}
                />
                {t(`dashboard.${key === 'healthScore' ? 'healthScore' : key === 'freeMoney' ? 'freeMoney' : key === 'upcomingBookings' ? 'upcomingBookings' : 'budgetTitle'}`)}
              </label>
            ))}
          </div>
          <div className="modal-actions" style={{ marginTop: '1rem' }}>
            <button className="btn btn-primary" onClick={() => setShowCustomize(false)}>{t('dashboard.widgetsDone')}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
