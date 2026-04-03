import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { IncomePage } from './IncomePage'
import { ExpensesPage } from './ExpensesPage'
import { QuickAdd } from '../components/QuickAdd'

export function BookingsPage() {
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = (searchParams.get('tab') ?? 'income') as 'income' | 'expenses'
  const addParam = searchParams.get('add') === 'true'

  const [triggerIncome, setTriggerIncome] = useState(false)
  const [triggerExpenses, setTriggerExpenses] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (addParam) {
      if (tab === 'income') setTriggerIncome(true)
      else setTriggerExpenses(true)
      setSearchParams({ tab }, { replace: true })
    }
  }, [])

  const setTab = (next: 'income' | 'expenses') => {
    setSearchParams({ tab: next }, { replace: true })
  }

  const handleQuickAddSuccess = () => {
    setReloadKey(k => k + 1)
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
        {tab === 'income' && (
          <IncomePage
            key={reloadKey}
            embedded
            triggerAdd={triggerIncome}
            onTriggerHandled={() => setTriggerIncome(false)}
          />
        )}
        {tab === 'expenses' && (
          <ExpensesPage
            key={reloadKey}
            embedded
            triggerAdd={triggerExpenses}
            onTriggerHandled={() => setTriggerExpenses(false)}
          />
        )}
      </div>
      <QuickAdd onSuccess={handleQuickAddSuccess} />
    </div>
  )
}
