import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { createIncome, createExpense, createSavingsGoal, updateProfile, completeOnboarding } from '../api'
import i18next from '../i18n/index'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CAD', 'AUD']
const LANGUAGES = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' }
]

export function OnboardingPage() {
  const { t } = useTranslation()
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [language, setLanguage] = useState('de')
  const [currency, setCurrency] = useState('EUR')

  const [incomeName, setIncomeName] = useState('')
  const [incomeAmount, setIncomeAmount] = useState('')
  const [incomeBookingDay, setIncomeBookingDay] = useState('1')

  const [expenseName, setExpenseName] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseCategory, setExpenseCategory] = useState('Housing')
  const [expenseBookingDay, setExpenseBookingDay] = useState('1')

  const [savingsName, setSavingsName] = useState('')
  const [savingsTarget, setSavingsTarget] = useState('')

  const totalSteps = 5

  const handleLanguage = async () => {
    await i18next.changeLanguage(language)
    localStorage.setItem('helfinance_lang', language)
    await updateProfile({ language }).catch(() => {})
    setStep(2)
  }

  const handleCurrency = async () => {
    await updateProfile({ currency }).catch(() => {})
    setStep(3)
  }

  const handleIncome = async () => {
    if (!incomeName || !incomeAmount) { setStep(4); return }
    setLoading(true)
    try {
      await createIncome({
        name: incomeName,
        amount: parseFloat(incomeAmount),
        interval: 'monthly',
        booking_day: parseInt(incomeBookingDay),
        effective_from: new Date().toISOString().slice(0, 10),
        effective_to: null
      })
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
    setStep(4)
  }

  const handleExpense = async () => {
    if (!expenseName || !expenseAmount) { setStep(5); return }
    setLoading(true)
    try {
      await createExpense({
        name: expenseName,
        amount: parseFloat(expenseAmount),
        interval_months: 1,
        booking_day: parseInt(expenseBookingDay),
        category: expenseCategory,
        effective_from: new Date().toISOString().slice(0, 10),
        effective_to: null
      })
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
    setStep(5)
  }

  const handleFinish = async () => {
    if (savingsName && savingsTarget) {
      setLoading(true)
      try {
        await createSavingsGoal({
          name: savingsName,
          target_amount: parseFloat(savingsTarget),
          current_amount: 0,
          contribution_mode: 'fixed',
          fixed_amount: null,
          buffer_amount: null
        })
      } catch {
        showToast(t('common.error'), 'error')
      } finally {
        setLoading(false)
      }
    }
    try {
      await completeOnboarding()
      await refreshUser()
      navigate('/dashboard', { replace: true })
    } catch {
      navigate('/dashboard', { replace: true })
    }
  }

  const handleSkip = () => {
    if (step < totalSteps) setStep(step + 1)
    else handleFinish()
  }

  const categories = ['Housing', 'Mobility', 'Food & Groceries', 'Insurance', 'Entertainment', 'Health', 'Miscellaneous']

  return (
    <div className="onboarding-page">
      <div className="onboarding-card">
        <div className="onboarding-header">
          <h1>{t('onboarding.title')}</h1>
          <div className="onboarding-progress">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`progress-dot ${i + 1 <= step ? 'active' : ''}`}
              />
            ))}
          </div>
          <p className="step-label">
            {step === 1 && t('onboarding.step1')}
            {step === 2 && t('onboarding.step2')}
            {step === 3 && t('onboarding.step3')}
            {step === 4 && t('onboarding.step4')}
            {step === 5 && t('onboarding.step5')}
          </p>
        </div>

        <div className="onboarding-body">
          {step === 1 && (
            <div>
              <div className="form-group">
                <label className="form-label">{t('onboarding.step1')}</label>
                <select className="form-select" value={language} onChange={e => setLanguage(e.target.value)}>
                  {LANGUAGES.map(l => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </div>
              <div className="onboarding-actions">
                <button className="btn btn-ghost" onClick={handleSkip}>{t('onboarding.skip')}</button>
                <button className="btn btn-primary" onClick={handleLanguage}>{t('onboarding.next')}</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <div className="form-group">
                <label className="form-label">{t('onboarding.step2')}</label>
                <select className="form-select" value={currency} onChange={e => setCurrency(e.target.value)}>
                  {CURRENCIES.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="onboarding-actions">
                <button className="btn btn-ghost" onClick={handleSkip}>{t('onboarding.skip')}</button>
                <button className="btn btn-primary" onClick={handleCurrency}>{t('onboarding.next')}</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="form-group">
                <label className="form-label">{t('income.name')}</label>
                <input className="form-input" value={incomeName} onChange={e => setIncomeName(e.target.value)} placeholder="Gehalt" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('income.amount')}</label>
                <input className="form-input" type="number" value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} placeholder="3000" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('income.bookingDay')}</label>
                <input className="form-input" type="number" min="1" max="31" value={incomeBookingDay} onChange={e => setIncomeBookingDay(e.target.value)} />
              </div>
              <div className="onboarding-actions">
                <button className="btn btn-ghost" onClick={handleSkip}>{t('onboarding.skip')}</button>
                <button className="btn btn-primary" onClick={handleIncome} disabled={loading}>{t('onboarding.next')}</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div>
              <div className="form-group">
                <label className="form-label">{t('expenses.name')}</label>
                <input className="form-input" value={expenseName} onChange={e => setExpenseName(e.target.value)} placeholder="Miete" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('expenses.amount')}</label>
                <input className="form-input" type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="800" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('expenses.category')}</label>
                <select className="form-select" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value)}>
                  {categories.map(c => (
                    <option key={c} value={c}>{t(`categories.${c}`)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('expenses.bookingDay')}</label>
                <input className="form-input" type="number" min="1" max="31" value={expenseBookingDay} onChange={e => setExpenseBookingDay(e.target.value)} />
              </div>
              <div className="onboarding-actions">
                <button className="btn btn-ghost" onClick={handleSkip}>{t('onboarding.skip')}</button>
                <button className="btn btn-primary" onClick={handleExpense} disabled={loading}>{t('onboarding.next')}</button>
              </div>
            </div>
          )}

          {step === 5 && (
            <div>
              <div className="form-group">
                <label className="form-label">{t('savings.name')}</label>
                <input className="form-input" value={savingsName} onChange={e => setSavingsName(e.target.value)} placeholder="Urlaub" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('savings.targetAmount')}</label>
                <input className="form-input" type="number" value={savingsTarget} onChange={e => setSavingsTarget(e.target.value)} placeholder="2000" />
              </div>
              <div className="onboarding-actions">
                <button className="btn btn-ghost" onClick={handleSkip}>{t('onboarding.skip')}</button>
                <button className="btn btn-primary" onClick={handleFinish} disabled={loading}>{t('onboarding.finish')}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
