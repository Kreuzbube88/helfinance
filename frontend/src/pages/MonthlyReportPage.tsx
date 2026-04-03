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
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'

ChartJS.register(ArcElement, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const CATEGORY_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#64748b'
]

function getMonthName(monthIndex: number, lang: string): string {
  return new Intl.DateTimeFormat(lang, { month: 'long' }).format(new Date(2000, monthIndex, 1))
}

interface MonthlyReportPageProps {
  embedded?: boolean
}

export function MonthlyReportPage({ embedded = false }: MonthlyReportPageProps) {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [report, setReport] = useState<MonthlyReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'history'>('overview')

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

  const goToPreviousMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1) }
    else setMonth(month - 1)
  }
  const goToNextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1) }
    else setMonth(month + 1)
  }
  const goToToday = () => {
    const n = new Date()
    setYear(n.getFullYear())
    setMonth(n.getMonth() + 1)
  }

  const donutData = report
    ? {
        labels: report.expense_breakdown.map(c => t(`categories.${c.category}`, { defaultValue: c.category })),
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

  const controls = (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
      <button className="btn btn-secondary btn-sm" onClick={goToPreviousMonth}>← {t('reports.previousMonth')}</button>
      <span style={{ fontWeight: 600, minWidth: '120px', textAlign: 'center' }}>
        {getMonthName(month - 1, i18n.language)} {year}
      </span>
      <button className="btn btn-secondary btn-sm" onClick={goToNextMonth}>{t('reports.nextMonth')} →</button>
      <button className="btn btn-ghost btn-sm" onClick={goToToday}>{t('reports.today')}</button>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => triggerDownload(`/api/v1/export/pdf?year=${year}&month=${month}`)}>{t('reports.exportPdf')}</button>
        <button className="btn btn-secondary btn-sm" onClick={() => triggerDownload(`/api/v1/export/csv?year=${year}&month=${month}`)}>{t('reports.exportCsv')}</button>
      </div>
    </div>
  )

  return (
    <div className={embedded ? '' : 'page'}>
      {!embedded ? (
        <div className="page-header">
          <h1 className="page-title">{t('reports.title')} — {t('reports.monthly')}</h1>
          {controls}
        </div>
      ) : (
        <div style={{ marginBottom: '1rem' }}>{controls}</div>
      )}

      {loading ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : !report ? (
        <div className="empty-state"><p>{t('common.noData')}</p></div>
      ) : (
        <>
          <div className="tabs" style={{ marginBottom: '1.5rem' }}>
            <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>{t('reports.overview')}</button>
            <button className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>{t('reports.details')}</button>
            <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>{t('reports.history')}</button>
          </div>

          {activeTab === 'overview' && (
            <>
              {/* Hero metrics */}
              <div className="summary-numbers" style={{ marginBottom: '1.5rem' }}>
                <div className="card">
                  <div className="big-number-label">{t('reports.totalIncome')}</div>
                  <div className="text-success" style={{ fontSize: '2rem', fontWeight: 700 }}>{fmt(report.total_income)}</div>
                </div>
                <div className="card">
                  <div className="big-number-label">{t('reports.totalExpenses')}</div>
                  <div className="text-danger" style={{ fontSize: '2rem', fontWeight: 700 }}>{fmt(report.total_expenses)}</div>
                </div>
                <div className="card">
                  <div className="big-number-label">{t('reports.net')}</div>
                  <div className={report.net >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: '2rem', fontWeight: 700 }}>{fmt(report.net)}</div>
                </div>
              </div>

              <div className="grid-2">
                {/* Donut chart */}
                <div className="card">
                  <h3 className="card-title">{t('reports.expensesByCategory')}</h3>
                  {donutData && report.expense_breakdown.length > 0 ? (
                    <div style={{ height: '280px' }}>
                      <Doughnut data={donutData} options={donutOptions} />
                    </div>
                  ) : (
                    <p className="text-muted">{t('common.noData')}</p>
                  )}
                </div>

                {/* Required savings card */}
                <div className="card">
                  <h3 className="card-title">{t('reports.requiredSavings')}</h3>
                  <div className="text-warning" style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>
                    {fmt(report.required_savings ?? 0)}
                  </div>
                  {(report.required_savings_breakdown ?? []).length === 0 ? (
                    <p className="text-muted text-sm">{t('reports.noIrregularExpenses')}</p>
                  ) : (
                    <>
                      <p className="text-muted text-sm" style={{ marginBottom: '0.5rem' }}>{t('reports.forFollowingExpenses')}</p>
                      {report.required_savings_breakdown.slice(0, 5).map((item, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid var(--color-border)' }}>
                          <span className="text-sm">{item.name}</span>
                          <span className="text-sm text-warning">{fmt(item.monthly_reserve)}</span>
                        </div>
                      ))}
                      {report.required_savings_breakdown.length > 5 && (
                        <p className="text-muted text-sm" style={{ marginTop: '0.5rem' }}>
                          +{report.required_savings_breakdown.length - 5} {t('common.more')}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'details' && (
            <>
              {/* Income breakdown */}
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 className="card-title">{t('reports.incomeBreakdown')}</h3>
                {report.income_breakdown.length === 0 ? (
                  <p className="text-muted">{t('common.noData')}</p>
                ) : (
                  <div className="table-scroll"><table>
                    <thead>
                      <tr>
                        <th>{t('income.name')}</th>
                        <th>{t('income.amount')}</th>
                        <th>{t('income.interval')}</th>
                        <th>{t('reports.monthly')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.income_breakdown.map((item, i) => (
                        <tr key={i}>
                          <td>{item.name}</td>
                          <td className="text-success">{fmt(item.amount)}</td>
                          <td><span className="badge badge-info">{t(`income.${item.interval}`)}</span></td>
                          <td className="text-success">{fmt(item.monthly_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table></div>
                )}
              </div>

              {/* Expense breakdown by category */}
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 className="card-title">{t('reports.expenseBreakdown')}</h3>
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
                            <td style={{ fontWeight: 600 }}>{t(`categories.${cat.category}`, { defaultValue: cat.category })}</td>
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

              {/* Required savings full breakdown */}
              {(report.required_savings_breakdown ?? []).length > 0 && (
                <div className="card">
                  <h3 className="card-title">{t('reports.requiredSavingsBreakdown')}</h3>
                  <div className="table-scroll"><table>
                    <thead>
                      <tr>
                        <th>{t('expenses.name')}</th>
                        <th>{t('expenses.amount')}</th>
                        <th>{t('common.month')}</th>
                        <th>{t('reports.monthlyReserve')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.required_savings_breakdown.map((item, i) => (
                        <tr key={i}>
                          <td>{item.name}</td>
                          <td>{fmt(item.amount)}</td>
                          <td><span className="badge badge-info">{item.interval_months}</span></td>
                          <td className="text-warning">{fmt(item.monthly_reserve)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{ fontWeight: 600 }}>{t('common.total')}</td>
                        <td className="text-warning" style={{ fontWeight: 600 }}>
                          {fmt(report.required_savings_breakdown.reduce((s, i) => s + i.monthly_reserve, 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table></div>
                </div>
              )}
            </>
          )}

          {activeTab === 'history' && (
            <>
              {/* 6-month bar chart */}
              {report.snapshots && report.snapshots.length > 0 && (() => {
                const last6 = [...report.snapshots]
                  .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
                  .slice(-6)
                const labels = last6.map(s => `${getMonthName(s.month - 1, i18n.language).slice(0, 3)} ${s.year}`)
                const comparisonData = {
                  labels,
                  datasets: [
                    {
                      label: t('reports.income'),
                      data: last6.map(s => s.total_income),
                      backgroundColor: 'rgba(16, 185, 129, 0.7)'
                    },
                    {
                      label: t('reports.expenses'),
                      data: last6.map(s => s.total_expenses),
                      backgroundColor: 'rgba(239, 68, 68, 0.7)'
                    }
                  ]
                }
                const barOptions = {
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: 'top' as const, labels: { color: '#94a3b8', font: { size: 12 } } },
                    tooltip: { callbacks: { label: (ctx: { parsed: { y: number | null } }) => fmt(ctx.parsed.y ?? 0) } }
                  },
                  scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
                    y: { ticks: { color: '#94a3b8', callback: (v: number | string) => fmt(Number(v)) }, grid: { color: 'rgba(148,163,184,0.1)' } }
                  }
                }
                return (
                  <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 className="card-title">{t('reports.comparison')} <span className="text-muted text-sm">({t('reports.last6Months')})</span></h3>
                    <div style={{ height: '260px' }}>
                      <Bar data={comparisonData} options={barOptions} />
                    </div>
                  </div>
                )
              })()}

              {/* Snapshot archive */}
              {report.snapshots && report.snapshots.length > 0 && (
                <div className="card">
                  <h3 className="card-title">{t('reports.snapshotArchive')}</h3>
                  <div className="table-scroll"><table>
                    <thead>
                      <tr>
                        <th>{t('common.year')}</th>
                        <th>{t('common.month')}</th>
                        <th>{t('reports.income')}</th>
                        <th>{t('reports.expenses')}</th>
                        <th>{t('reports.net')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.snapshots.map(snap => (
                        <tr key={snap.id}>
                          <td>{snap.year}</td>
                          <td>{getMonthName(snap.month - 1, i18n.language)}</td>
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
        </>
      )}
    </div>
  )
}
