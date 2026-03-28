import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { getMonthlyReport, getToken } from '../api'
import type { MonthlyReport } from '../types'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js'
import { Doughnut } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend)

const CATEGORY_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#64748b'
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

export function MonthlyReportPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [loading, setLoading] = useState(true)

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  const load = useCallback(() => {
    setLoading(true)
    getMonthlyReport(year, month)
      .then(setReport)
      .catch(() => showToast(t('common.error'), 'error'))
      .finally(() => setLoading(false))
  }, [year, month])

  useEffect(() => { load() }, [load])

  const triggerDownload = (url: string) => {
    const token = getToken()
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.blob()
      })
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = url.includes('pdf') ? `report-${year}-${month}.pdf` : `report-${year}-${month}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .catch(() => showToast(t('common.error'), 'error'))
  }

  const donutData = report
    ? {
        labels: report.expense_breakdown.map(c => c.category),
        datasets: [
          {
            data: report.expense_breakdown.map(c => c.total),
            backgroundColor: CATEGORY_COLORS.slice(0, report.expense_breakdown.length),
            borderWidth: 0
          }
        ]
      }
    : null

  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#94a3b8', padding: 16, font: { size: 12 } }
      },
      tooltip: {
        callbacks: {
          label: (ctx: { parsed: number }) => fmt(ctx.parsed)
        }
      }
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('reports.title')} — {t('reports.monthly')}</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            style={{ width: 'auto' }}
          >
            {MONTH_NAMES.map((name, i) => (
              <option key={i} value={i + 1}>{name}</option>
            ))}
          </select>
          <select
            className="form-select"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ width: 'auto' }}
          >
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => triggerDownload(`/api/v1/export/pdf?year=${year}&month=${month}`)}
          >
            {t('reports.exportPdf')}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => triggerDownload(`/api/v1/export/csv?year=${year}&month=${month}`)}
          >
            {t('reports.exportCsv')}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : !report ? (
        <div className="empty-state"><p>{t('common.noData')}</p></div>
      ) : (
        <>
          {/* Summary */}
          <div className="summary-numbers">
            <div className="card">
              <div className="big-number-label">Total Income</div>
              <div className="big-number text-success">{fmt(report.total_income)}</div>
            </div>
            <div className="card">
              <div className="big-number-label">Total Expenses</div>
              <div className="big-number text-danger">{fmt(report.total_expenses)}</div>
            </div>
            <div className="card">
              <div className="big-number-label">Net</div>
              <div className={`big-number ${report.net >= 0 ? 'text-success' : 'text-danger'}`}>
                {fmt(report.net)}
              </div>
            </div>
          </div>

          <div className="grid-2">
            {/* Income breakdown */}
            <div className="card">
              <h3 className="card-title">Income Breakdown</h3>
              {report.income_breakdown.length === 0 ? (
                <p className="text-muted">{t('common.noData')}</p>
              ) : (
                <div className="table-scroll"><table>
                  <thead>
                    <tr>
                      <th>{t('income.name')}</th>
                      <th>{t('income.amount')}</th>
                      <th>{t('income.interval')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.income_breakdown.map((item, i) => (
                      <tr key={i}>
                        <td>{item.name}</td>
                        <td className="text-success">{fmt(item.amount)}</td>
                        <td><span className="badge badge-info">{item.interval}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
              )}
            </div>

            {/* Donut chart */}
            <div className="card">
              <h3 className="card-title">Expenses by Category</h3>
              {donutData && report.expense_breakdown.length > 0 ? (
                <div style={{ height: '280px' }}>
                  <Doughnut data={donutData} options={donutOptions} />
                </div>
              ) : (
                <p className="text-muted">{t('common.noData')}</p>
              )}
            </div>
          </div>

          {/* Expense breakdown */}
          <div className="card">
            <h3 className="card-title">Expense Breakdown</h3>
            {report.expense_breakdown.length === 0 ? (
              <p className="text-muted">{t('common.noData')}</p>
            ) : (
              <div className="table-scroll"><table>
                <thead>
                  <tr>
                    <th>{t('expenses.name')}</th>
                    <th style={{ textAlign: 'right' }}>{t('expenses.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.expense_breakdown.map(cat => (
                    <React.Fragment key={cat.category}>
                      <tr style={{ background: 'var(--color-surface-2)' }}>
                        <td style={{ fontWeight: 600 }}>{cat.category}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(cat.total)}</td>
                      </tr>
                      {cat.items.map((item, i) => (
                        <tr key={i}>
                          <td style={{ paddingLeft: '2rem', color: 'var(--color-text-muted)' }}>{item.name}</td>
                          <td style={{ textAlign: 'right' }} className="text-danger">{fmt(item.amount)}</td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table></div>
            )}
          </div>

          {/* Snapshot archive */}
          {report.snapshots && report.snapshots.length > 0 && (
            <div className="card">
              <h3 className="card-title">Snapshot Archive</h3>
              <div className="table-scroll"><table>
                <thead>
                  <tr>
                    <th>{t('common.year')}</th>
                    <th>{t('common.month')}</th>
                    <th>Income</th>
                    <th>Expenses</th>
                    <th>Net</th>
                  </tr>
                </thead>
                <tbody>
                  {report.snapshots.map(snap => (
                    <tr key={snap.id}>
                      <td>{snap.year}</td>
                      <td>{MONTH_NAMES[snap.month - 1]}</td>
                      <td className="text-success">{fmt(snap.total_income)}</td>
                      <td className="text-danger">{fmt(snap.total_expenses)}</td>
                      <td className={snap.net >= 0 ? 'text-success' : 'text-danger'}>{fmt(snap.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
