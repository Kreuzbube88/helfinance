import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { getDashboard } from '../api'
import type { DashboardData } from '../types'
import { Modal } from '../components/Modal'

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
      <path d="M 30 100 A 70 70 0 0 1 170 100" fill="none" stroke="var(--color-surface-2)" strokeWidth="12" strokeLinecap="round" />
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

interface QuickCalcProps {
  freeMoney: number
  onClose: () => void
}

function QuickCalcModal({ freeMoney, onClose }: QuickCalcProps) {
  const { t } = useTranslation()
  const [item, setItem] = useState('')
  const [price, setPrice] = useState('')
  const [result, setResult] = useState<{ months: number; impact: number } | null>(null)

  const calculate = () => {
    const p = parseFloat(price)
    if (!p || freeMoney <= 0) return
    const months = Math.ceil(p / freeMoney)
    setResult({ months, impact: freeMoney })
  }

  return (
    <Modal title={t('calculator.title')} onClose={onClose} size="sm">
      <div className="form-group">
        <label className="form-label">{t('calculator.want')}</label>
        <input className="form-input" value={item} onChange={e => setItem(e.target.value)} placeholder="MacBook Pro" />
      </div>
      <div className="form-group">
        <label className="form-label">{t('calculator.price')}</label>
        <input className="form-input" type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="2000" />
      </div>
      <button className="btn btn-primary" onClick={calculate}>{t('calculator.calculate')}</button>
      {result && (
        <div className="calc-result">
          <div className="calc-result-item">
            <span>{t('calculator.monthsToSave')}</span>
            <strong>{result.months}</strong>
          </div>
          <div className="calc-result-item">
            <span>{t('calculator.monthlyImpact')}</span>
            <strong>{result.impact.toFixed(2)} €</strong>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function DashboardPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [liquidityDismissed, setLiquidityDismissed] = useState(false)
  const [showCalc, setShowCalc] = useState(false)

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => showToast(t('common.error'), 'error'))
      .finally(() => setLoading(false))
  }, [])

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
      <h1 className="page-title">{t('dashboard.title')}</h1>

      {data.liquidity_warning && !liquidityDismissed && (
        <div className="alert alert-warning">
          <span>⚠ {t('dashboard.liquidityWarning')}</span>
          <button className="btn btn-ghost btn-sm" onClick={() => setLiquidityDismissed(true)}>✕</button>
        </div>
      )}

      <div className="dashboard-grid">
        {/* Health Score */}
        <div className="card dashboard-card card-health">
          <h3 className="card-title">{t('dashboard.healthScore')}</h3>
          <HealthGauge score={data.health_score} />
        </div>

        {/* Budget Traffic Light */}
        <div className="card dashboard-card">
          <h3 className="card-title">Budget</h3>
          <TrafficLight status={data.budget_status} />
          <div className="budget-numbers">
            <div className="budget-row">
              <span className="text-muted">Einnahmen</span>
              <span className="text-success">{fmt(data.total_income)}</span>
            </div>
            <div className="budget-row">
              <span className="text-muted">Ausgaben</span>
              <span className="text-danger">{fmt(data.total_expenses)}</span>
            </div>
          </div>
        </div>

        {/* Free Money */}
        <div className="card dashboard-card card-free-money">
          <h3 className="card-title">{t('dashboard.freeMoney')}</h3>
          <div className={`free-money-amount ${data.free_money < 0 ? 'negative' : 'positive'}`}>
            {fmt(data.free_money)}
          </div>
          <p className="text-muted text-sm">Diesen Monat</p>
        </div>

        {/* Upcoming Bookings */}
        <div className="card dashboard-card">
          <h3 className="card-title">{t('dashboard.upcomingBookings')}</h3>
          {data.upcoming_bookings.length === 0 ? (
            <p className="text-muted">{t('common.noData')}</p>
          ) : (
            <div className="booking-list">
              {data.upcoming_bookings.slice(0, 3).map((b, i) => (
                <div key={i} className="booking-item">
                  <div className="booking-info">
                    <span className="booking-name">{b.name}</span>
                    <span className="text-muted text-sm">Tag {b.booking_day}</span>
                  </div>
                  <span className={`booking-amount ${b.type === 'income' ? 'text-success' : 'text-danger'}`}>
                    {b.type === 'income' ? '+' : '-'}{fmt(b.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Savings Progress */}
        <div className="card dashboard-card card-savings">
          <h3 className="card-title">{t('dashboard.savingsProgress')}</h3>
          {data.savings_goals.length === 0 ? (
            <p className="text-muted">{t('common.noData')}</p>
          ) : (
            <div className="savings-list">
              {data.savings_goals.map(goal => {
                const pct = goal.target_amount > 0
                  ? Math.min(100, (goal.current_amount / goal.target_amount) * 100)
                  : 0
                return (
                  <div key={goal.id} className="savings-item">
                    <div className="savings-header">
                      <span className="savings-name">{goal.name}</span>
                      <span className="savings-pct">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="savings-amounts">
                      <span className="text-muted text-sm">{fmt(goal.current_amount)}</span>
                      <span className="text-muted text-sm">{fmt(goal.target_amount)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Calculator FAB */}
      <button
        className="fab"
        onClick={() => setShowCalc(true)}
        title={t('calculator.title')}
      >
        ⊕
      </button>

      {showCalc && (
        <QuickCalcModal
          freeMoney={data.free_money}
          onClose={() => setShowCalc(false)}
        />
      )}
    </div>
  )
}
