import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import {
  getSavingsGoals, createSavingsGoal, updateSavingsGoal, deleteSavingsGoal,
  getDashboard, getSavingsBalance, setSavingsInitialBalance,
  getSavingsTransactions, createSavingsTransaction, deleteSavingsTransaction
} from '../api'
import type { SavingsGoal, SavingsAccount, SavingsTransaction } from '../types'
import { Modal } from '../components/Modal'
import { ConfirmModal } from '../components/ConfirmModal'

const PRESET_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

const EMPTY_FORM = {
  name: '',
  target_amount: '',
  current_amount: '',
  contribution_mode: 'fixed' as SavingsGoal['contribution_mode'],
  fixed_amount: '',
  buffer_amount: '',
  color: PRESET_COLORS[0],
  target_date: '',
  priority: '0'
}

const EMPTY_TX_FORM = { amount: '', date: '', description: '' }

export function SavingsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [account, setAccount] = useState<SavingsAccount>({ initial_balance: 0, current_balance: 0 })
  const [transactions, setTransactions] = useState<SavingsTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const [showTxModal, setShowTxModal] = useState(false)
  const [txForm, setTxForm] = useState(EMPTY_TX_FORM)
  const [txSaving, setTxSaving] = useState(false)

  const [initialBalanceInput, setInitialBalanceInput] = useState('')
  const [savingInitial, setSavingInitial] = useState(false)

  const [totalMonthlyIncome, setTotalMonthlyIncome] = useState(0)
  const [dynamicResult, setDynamicResult] = useState<number | null>(null)
  const [recalcLoading, setRecalcLoading] = useState(false)
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteTxId, setDeleteTxId] = useState<number | null>(null)

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  const load = () => {
    setLoading(true)
    Promise.all([
      getSavingsGoals(),
      getDashboard(),
      getSavingsBalance(),
      getSavingsTransactions()
    ])
      .then(([g, dash, bal, txs]) => {
        setGoals(g)
        setTotalMonthlyIncome(dash.total_income)
        setAccount(bal)
        setInitialBalanceInput(String(bal.initial_balance))
        setTransactions(txs)
      })
      .catch(() => showToast(t('common.error'), 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (goal: SavingsGoal) => {
    setEditing(goal)
    setForm({
      name: goal.name,
      target_amount: String(goal.target_amount),
      current_amount: String(goal.current_amount),
      contribution_mode: goal.contribution_mode,
      fixed_amount: goal.fixed_amount != null ? String(goal.fixed_amount) : '',
      buffer_amount: goal.buffer_amount != null ? String(goal.buffer_amount) : '',
      color: PRESET_COLORS[0],
      target_date: goal.target_date ?? '',
      priority: String(goal.priority)
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        target_amount: parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount) || 0,
        contribution_mode: form.contribution_mode,
        fixed_amount: form.contribution_mode !== 'dynamic' && form.fixed_amount ? parseFloat(form.fixed_amount) : null,
        buffer_amount: form.contribution_mode !== 'fixed' && form.buffer_amount ? parseFloat(form.buffer_amount) : null,
        target_date: form.target_date || null,
        priority: parseInt(form.priority) || 0
      }
      if (editing) {
        const updated = await updateSavingsGoal(editing.id, payload)
        setGoals(prev => prev.map(g => g.id === updated.id ? updated : g))
      } else {
        const created = await createSavingsGoal(payload)
        setGoals(prev => [...prev, created])
      }
      showToast(t('common.success'), 'success')
      setShowModal(false)
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteSavingsGoal(id)
      setGoals(prev => prev.filter(g => g.id !== id))
      showToast(t('common.success'), 'success')
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

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

  const f = (field: keyof typeof form, val: string) =>
    setForm(prev => ({ ...prev, [field]: val }))

  const emergencyTarget = totalMonthlyIncome * 3
  const emergencyPct = emergencyTarget > 0
    ? Math.min(100, (account.current_balance / emergencyTarget) * 100)
    : 0

  const showFixed = form.contribution_mode === 'fixed' || form.contribution_mode === 'both'
  const showDynamic = form.contribution_mode === 'dynamic' || form.contribution_mode === 'both'

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('savings.title')}</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowTxModal(true)}>+ {t('savings.addTransaction')}</button>
          <button className="btn btn-primary" onClick={openAdd}>+ {t('savings.add')}</button>
        </div>
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

          {/* Goal cards */}
          {goals.length === 0 ? (
            <div className="empty-state">
              <p>{t('common.noData')}</p>
              <button className="btn btn-primary" onClick={openAdd}>{t('savings.add')}</button>
            </div>
          ) : (
            <div className="grid-2">
              {goals.map(goal => {
                const pct = goal.target_amount > 0
                  ? Math.min(100, (account.current_balance / goal.target_amount) * 100)
                  : 0
                return (
                  <div key={goal.id} className="goal-card">
                    <div className="section-header">
                      <span style={{ fontWeight: 600, fontSize: '1rem' }}>{goal.name}</span>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        {goal.priority > 0 && (
                          <span className="badge badge-warning">P{goal.priority}</span>
                        )}
                        <span className={`badge badge-${goal.contribution_mode === 'fixed' ? 'info' : goal.contribution_mode === 'dynamic' ? 'success' : 'warning'}`}>
                          {t(`savings.${goal.contribution_mode}`)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      <span className="text-muted">{fmt(account.current_balance)}</span>
                      <span className="text-muted">{pct.toFixed(0)}%</span>
                      <span className="text-muted">{fmt(goal.target_amount)}</span>
                    </div>

                    <div className="progress-bar" style={{ marginBottom: '0.75rem' }}>
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>

                    {goal.target_date && (
                      <p className="text-muted text-sm">
                        {t('savings.targetDate')}: {goal.target_date}
                        {goal.required_monthly_saving != null && (
                          <> · {t('savings.requiredMonthly')}: {fmt(goal.required_monthly_saving)}</>
                        )}
                      </p>
                    )}
                    {goal.fixed_amount != null && goal.fixed_amount > 0 && (
                      <p className="text-muted text-sm">
                        {t('savings.fixedAmount')}: {fmt(goal.fixed_amount)}/mo
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(goal)}>
                        {t('common.edit')}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(goal.id)}>
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

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

      {/* Goal modal */}
      {showModal && (
        <Modal
          title={editing ? t('common.edit') : t('savings.add')}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">{t('savings.name')}</label>
              <input className="form-input" value={form.name} onChange={e => f('name', e.target.value)} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('savings.targetAmount')}</label>
                <input className="form-input" type="number" step="0.01" min="0" value={form.target_amount} onChange={e => f('target_amount', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('savings.currentAmount')}</label>
                <input className="form-input" type="number" step="0.01" min="0" value={form.current_amount} onChange={e => f('current_amount', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('savings.targetDate')}</label>
                <input className="form-input" type="month" value={form.target_date} onChange={e => f('target_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">{t('savings.priority')}</label>
                <input className="form-input" type="number" min="0" value={form.priority} onChange={e => f('priority', e.target.value)} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('savings.mode')}</label>
              <select className="form-select" value={form.contribution_mode} onChange={e => f('contribution_mode', e.target.value as SavingsGoal['contribution_mode'])}>
                <option value="fixed">{t('savings.fixed')}</option>
                <option value="dynamic">{t('savings.dynamic')}</option>
                <option value="both">{t('savings.both')}</option>
              </select>
            </div>
            {showFixed && (
              <div className="form-group">
                <label className="form-label">{t('savings.fixedAmount')}</label>
                <input className="form-input" type="number" step="0.01" min="0" value={form.fixed_amount} onChange={e => f('fixed_amount', e.target.value)} />
              </div>
            )}
            {showDynamic && (
              <div className="form-group">
                <label className="form-label">{t('savings.bufferAmount')}</label>
                <input className="form-input" type="number" step="0.01" min="0" value={form.buffer_amount} onChange={e => f('buffer_amount', e.target.value)} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Color</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => f('color', c)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: c,
                      border: form.color === c ? '3px solid white' : '2px solid transparent',
                      cursor: 'pointer',
                      outline: form.color === c ? `2px solid ${c}` : 'none'
                    }}
                  />
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
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

      {deleteId !== null && (
        <ConfirmModal
          onConfirm={() => handleDelete(deleteId)}
          onClose={() => setDeleteId(null)}
        />
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
