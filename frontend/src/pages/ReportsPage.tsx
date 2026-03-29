import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { MonthlyReportPage } from './MonthlyReportPage'
import { YearlyReportPage } from './YearlyReportPage'

export function ReportsPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') ?? 'monthly') as 'monthly' | 'yearly'

  const setTab = (next: 'monthly' | 'yearly') => {
    setSearchParams({ tab: next }, { replace: true })
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('reports.title')}</h1>
      </div>
      <div className="tabs">
        <button
          className={`tab-btn ${tab === 'monthly' ? 'active' : ''}`}
          onClick={() => setTab('monthly')}
        >
          {t('reports.monthly')}
        </button>
        <button
          className={`tab-btn ${tab === 'yearly' ? 'active' : ''}`}
          onClick={() => setTab('yearly')}
        >
          {t('reports.yearly')}
        </button>
      </div>
      <div className="tab-content">
        {tab === 'monthly' && <MonthlyReportPage embedded />}
        {tab === 'yearly' && <YearlyReportPage embedded />}
      </div>
    </div>
  )
}
