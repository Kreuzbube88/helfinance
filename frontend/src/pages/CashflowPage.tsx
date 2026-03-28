import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { getCashflow } from '../api'
import type { CashflowDay } from '../types'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

function getMonthName(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1))
}

function getDowLabels(locale: string): string[] {
  const base = new Date(2024, 0, 1) // Monday Jan 1 2024
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(new Date(base.getTime() + i * 86400000))
  )
}

export function CashflowPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [days, setDays] = useState<CashflowDay[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const locale = i18n.language === 'de' ? 'de-DE' : 'en-GB'
  const monthLabel = getMonthName(year, month, locale)
  const dowLabels = getDowLabels(locale)

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    getCashflow(year, month)
      .then(data => { setDays(data); setLoadError(false) })
      .catch(() => { showToast(t('common.error'), 'error'); setLoadError(true) })
      .finally(() => setLoading(false))
  }, [year, month])

  useEffect(() => { load() }, [load])

  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else { setMonth(m => m - 1) }
  }

  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else { setMonth(m => m + 1) }
  }

  const goToday = () => {
    const n = new Date()
    setYear(n.getFullYear())
    setMonth(n.getMonth() + 1)
  }

  // Build calendar cells with offset for weekday alignment (Mon=0)
  const firstDay = new Date(year, month - 1, 1)
  // getDay(): 0=Sun,1=Mon... convert to Mon=0
  const startOffset = (firstDay.getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const today = new Date()

  const calendarCells: Array<CashflowDay | null> = [
    ...Array(startOffset).fill(null),
    ...days
  ]

  // Pad to full weeks
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push(null)
  }

  const anyNegative = days.some(d => d.projected_balance < 0)
  const lineColor = anyNegative ? '#f59e0b' : '#10b981'

  const chartData = {
    labels: days.map(d => String(d.day)),
    datasets: [
      {
        label: t('cashflow.projectedBalance'),
        data: days.map(d => d.projected_balance),
        borderColor: lineColor,
        backgroundColor: anyNegative
          ? 'rgba(245,158,11,0.1)'
          : 'rgba(16,185,129,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 2,
        borderWidth: 2
      }
    ]
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: { y: number } }) => fmt(ctx.parsed.y)
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(148,163,184,0.1)' },
        ticks: { color: '#94a3b8', font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(148,163,184,0.1)' },
        ticks: {
          color: '#94a3b8',
          font: { size: 11 },
          callback: (value: number | string) => fmt(Number(value))
        }
      }
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('cashflow.title')}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-secondary btn-sm" onClick={prevMonth}>‹</button>
          <span style={{ fontWeight: 600, minWidth: '160px', textAlign: 'center', textTransform: 'capitalize' }}>
            {monthLabel}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={nextMonth}>›</button>
          <button className="btn btn-ghost btn-sm" onClick={goToday}>{t('cashflow.today')}</button>
        </div>
      </div>

      {loading ? (
        <div className="empty-state"><p className="text-muted">{t('common.loading')}</p></div>
      ) : loadError ? (
        <div className="empty-state"><p className="text-danger">{t('common.error')}</p></div>
      ) : days.length === 0 ? (
        <div className="empty-state"><p className="text-muted">{t('cashflow.noData')}</p></div>
      ) : (
        <>
          <div className="card">
            <div className="calendar-grid">
              {dowLabels.map(d => (
                <div key={d} className="calendar-header-cell">{d}</div>
              ))}
              {calendarCells.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="calendar-day empty" />
                }
                const dayDate = new Date(day.date)
                const isToday =
                  dayDate.getDate() === today.getDate() &&
                  dayDate.getMonth() === today.getMonth() &&
                  dayDate.getFullYear() === today.getFullYear()

                return (
                  <div key={day.date} className={`calendar-day ${isToday ? 'today' : ''}`}>
                    <div className="calendar-day-num">{day.day}</div>
                    {day.income_bookings.map((b, i) => (
                      <span key={i} className="booking-pill income-pill" title={`${b.name}: ${fmt(b.amount)}`}>
                        {b.name}
                      </span>
                    ))}
                    {day.expense_bookings.map((b, i) => (
                      <span key={i} className="booking-pill expense-pill" title={`${b.name}: ${fmt(b.amount)}`}>
                        {b.name}
                      </span>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">{t('cashflow.projectedBalance')}</h3>
            <div className="chart-container">
              <Line data={chartData} options={chartOptions as Parameters<typeof Line>[0]['options']} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
