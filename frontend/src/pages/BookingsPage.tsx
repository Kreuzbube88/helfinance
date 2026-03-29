import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { IncomePage } from './IncomePage'
import { ExpensesPage } from './ExpensesPage'

export function BookingsPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') ?? 'income') as 'income' | 'expenses'

  const setTab = (next: 'income' | 'expenses') => {
    setSearchParams({ tab: next }, { replace: true })
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('nav.bookings')}</h1>
      </div>
      <div className="tabs">
        <button
          className={`tab-btn ${tab === 'income' ? 'active' : ''}`}
          onClick={() => setTab('income')}
        >
          {t('nav.income')}
        </button>
        <button
          className={`tab-btn ${tab === 'expenses' ? 'active' : ''}`}
          onClick={() => setTab('expenses')}
        >
          {t('nav.expenses')}
        </button>
      </div>
      <div className="tab-content">
        {tab === 'income' && <IncomePage embedded />}
        {tab === 'expenses' && <ExpensesPage embedded />}
      </div>
    </div>
  )
}
