import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { getYearlyReport, getToken } from '../api'
import type { YearlyReport } from '../types'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function YearlyReportPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [report, setReport] = useState<YearlyReport | null>(null)
  const [loading, setLoading] = useState(true)

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  const load = useCallback(() => {
    setLoading(true)
    getYearlyReport(year)
      .then(setReport)
      .catch(() => showToast(t('common.error'), 'error'))
      .finally(() => setLoading(false))
  }, [year])

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
        a.download = url.includes('pdf') ? `report-${year}.pdf` : `report-${year}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      })
      .catch(() => showToast(t('common.error'), 'error'))
  }

  const yearOptions = Array.from({ length: 7 }, (_, i) => now.getFullYear() - 3 + i)

  // Build a month map for quick lookup
  const monthMap = new Map(report?.months.map(m => [m.month, m]) ?? [])

  const rows: Array<{ label: string; key: keyof Omit<YearlyReport['months'][number], 'month'>; isNet: boolean }> = [
    { label: 'Income',          key: 'income',          isNet: false },
    { label: 'Fixed Expenses',  key: 'fixed_expenses',  isNet: false },
    { label: 'Provisions',      key: 'provisions',      isNet: false },
    { label: 'Loans',           key: 'loans',           isNet: false },
    { label: 'Net Savings',     key: 'net_savings',     isNet: true  }
  ]

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('reports.title')} — {t('reports.yearly')}</h1>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ width: 'auto' }}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => triggerDownload(`/api/v1/export/pdf?year=${year}`)}
          >
            {t('reports.exportPdf')}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => triggerDownload(`/api/v1/export/csv?year=${year}`)}
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
        <div className="card">
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table className="report-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '140px' }}>Row</th>
                  {MONTH_SHORT.map((m, i) => (
                    <th key={i}>{m}</th>
                  ))}
                  <th className="total-col">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.key}>
                    <td style={{ fontWeight: 600 }}>{row.label}</td>
                    {Array.from({ length: 12 }, (_, i) => {
                      const mData = monthMap.get(i + 1)
                      const val = mData ? mData[row.key] : 0
                      return (
                        <td
                          key={i}
                          style={{
                            textAlign: 'right',
                            color: row.isNet
                              ? val >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                              : undefined,
                            fontSize: '0.85rem'
                          }}
                        >
                          {val !== 0 ? fmt(val) : '—'}
                        </td>
                      )
                    })}
                    <td
                      className="total-col"
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: row.isNet
                          ? report.totals[row.key] >= 0 ? 'var(--color-success)' : 'var(--color-danger)'
                          : undefined
                      }}
                    >
                      {fmt(report.totals[row.key])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
