import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import {
  getDashboard, getSavingsBalance, setSavingsInitialBalance,
  getSavingsTransactions, createSavingsTransaction, deleteSavingsTransaction
} from '../api'
import type { SavingsAccount, SavingsTransaction } from '../types'
import { Modal } from '../components/Modal'
import { ConfirmModal } from '../components/ConfirmModal'

const EMPTY_TX_FORM = { amount: '', date: '', description: '' }

export function SavingsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [account, setAccount] = useState<SavingsAccount>({ initial_balance: 0, current_balance: 0 })
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([])
  const [loading, setLoading] = useState(true)

  const [showTxModal, setShowTxModal] = useState(false)
  const [txForm, setTxForm] = useState(EMPTY_TX_FORM)
  const [txSaving, setTxSaving] = useState(false)

  const [initialBalanceInput, setInitialBalanceInput] = useState('')
  const [savingInitial, setSavingInitial] = useState(false)

  const [totalMonthlyIncome, setTotalMonthlyIncome] = useState(0)
  const [dynamicResult, setDynamicResult] = useState<number | null>(null)
  const [recalcLoading, setRecalcLoading] = useState(false)
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [deleteTxId, setDeleteTxId] = useState<number | null>(null)

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  const load = () => {
    setLoading(true)
    Promise.all([
      getDashboard(),
      getSavingsBalance(),
      getSavingsTransactions()
    ])
      .then(([dash, bal, txs]) => {
        setTotalMonthlyIncome(dash.total_income)
        setAccount(bal)
        setInitialBalanceInput(String(bal.initial_balance))
        setTransactions(txs)
      })
      .catch(() => showToast(t('common.error'), 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleSaveInitialBalance = async () => {
    setSavingInitial(true)
    try {
      await setSavingsInitialBalance(parseFloat(initialBalanceInput) || 0)
      const bal = await getSavingsBalance()
      setAccount(bal)
      showToast(t('common.success'), 'success')
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setSavingInitial(false)
    }
  }

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault()
    setTxSaving(true)
    try {
      const tx = await createSavingsTransaction({
        amount: parseFloat(txForm.amount),
        date: txForm.date,
        description: txForm.description || undefined
      })
      setTransactions(prev => [tx, ...prev])
      const bal = await getSavingsBalance()
      setAccount(bal)
      showToast(t('common.success'), 'success')
      setShowTxModal(false)
      setTxForm(EMPTY_TX_FORM)
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setTxSaving(false)
    }
  }

  const handleDeleteTx = async (id: number) => {
    try {
      await deleteSavingsTransaction(id)
      setTransactions(prev => prev.filter(tx => tx.id !== id))
      const bal = await getSavingsBalance()
      setAccount(bal)
      showToast(t('common.success'), 'success')
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleRecalc = async () => {
    const income = parseFloat(monthlyIncome)
    if (!income || income <= 0) return
    setRecalcLoading(true)
    try {
      const dash = await getDashboard()
      setDynamicResult(Math.max(0, dash.free_money))
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setRecalcLoading(false)
    }
  }

  const emergencyTarget = totalMonthlyIncome * 3
  const emergencyPct = emergencyTarget > 0
    ? Math.min(100, (account.current_balance / emergencyTarget) * 100)
    : 0

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('savings.title')}</h1>
        <button className="btn btn-primary" onClick={() => setShowTxModal(true)}>+ {t('savings.addTransaction')}</button>
      </div>

      {loading ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : (
        <>
          {/* Current balance */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 className="card-title">{t('savings.currentBalance')}</h3>
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <p className="text-muted text-sm">{t('savings.currentBalance')}</p>
                <strong style={{ fontSize: '1.5rem' }}>{fmt(account.current_balance)}</strong>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{t('savings.initialBalance')}</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.01"
                    value={initialBalanceInput}
                    onChange={e => setInitialBalanceInput(e.target.value)}
                    style={{ maxWidth: '180px' }}
                  />
                </div>
                <button className="btn btn-secondary" onClick={handleSaveInitialBalance} disabled={savingInitial}>
                  {savingInitial ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </div>
          </div>

          {/* Emergency reserve */}
          <div className="card">
            <h3 className="card-title">{t('savings.emergencyReserve')}</h3>
            <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
              {t('savings.emergencyTargetLabel', { target: fmt(emergencyTarget) })}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              <span className="text-muted">{fmt(account.current_balance)}</span>
              <span className="text-muted">{emergencyPct.toFixed(0)}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{
                  width: `${emergencyPct}%`,
                  background: emergencyPct >= 100 ? 'var(--color-success)' : emergencyPct >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'
                }}
              />
            </div>
          </div>

          {/* Transaction log */}
          <div className="card">
            <div className="section-header">
              <h3 className="card-title" style={{ margin: 0 }}>{t('savings.transactions')}</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowTxModal(true)}>+</button>
            </div>
            {transactions.length === 0 ? (
              <p className="text-muted text-sm">{t('common.noData')}</p>
            ) : (
              <table className="table" style={{ marginTop: '0.5rem' }}>
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('common.description')}</th>
                    <th style={{ textAlign: 'right' }}>{t('common.amount')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id}>
                      <td>{tx.date}</td>
                      <td>{tx.description ?? '—'}</td>
                      <td style={{ textAlign: 'right', color: tx.amount >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {fmt(tx.amount)}
                      </td>
                      <td>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteTxId(tx.id)}>
                          {t('common.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Monthly savings rate */}
          <div className="card">
            <h3 className="card-title">{t('savings.savingsRate')}</h3>
            <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
              {t('savings.savingsRateDescription')}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">{t('savings.thisMonthsSalary')}</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  value={monthlyIncome}
                  onChange={e => setMonthlyIncome(e.target.value)}
                  placeholder="3000"
                />
              </div>
              <button className="btn btn-primary" onClick={handleRecalc} disabled={recalcLoading}>
                {recalcLoading ? t('common.loading') : t('savings.recalculate')}
              </button>
            </div>
            {dynamicResult !== null && (
              <div className="card" style={{ marginTop: '1rem', background: 'var(--color-surface-2)' }}>
                <span className="text-muted">{t('savings.dynamicSavingsThisMonth')}</span>
                <strong className={dynamicResult >= 0 ? 'text-success' : 'text-danger'}>
                  {fmt(dynamicResult)}
                </strong>
              </div>
            )}
          </div>
        </>
      )}

      {/* Transaction modal */}
      {showTxModal && (
        <Modal title={t('savings.addTransaction')} onClose={() => setShowTxModal(false)}>
          <form onSubmit={handleAddTx}>
            <div className="form-group">
              <label className="form-label">{t('common.amount')} (+/-)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={txForm.amount}
                onChange={e => setTxForm(p => ({ ...p, amount: e.target.value }))}
                required
                placeholder="-500 or 1000"
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('common.date')}</label>
              <input
                className="form-input"
                type="month"
                value={txForm.date}
                onChange={e => setTxForm(p => ({ ...p, date: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('common.description')}</label>
              <input
                className="form-input"
                value={txForm.description}
                onChange={e => setTxForm(p => ({ ...p, description: e.target.value }))}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowTxModal(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={txSaving}>
                {txSaving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTxId !== null && (
        <ConfirmModal
          onConfirm={() => handleDeleteTx(deleteTxId)}
          onClose={() => setDeleteTxId(null)}
        />
      )}
    </div>
  )
}
