import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import {
  getExpenses, createExpense, updateExpense, deleteExpense,
  scheduleExpenseChange, getExpenseChanges, deleteExpenseChange,
  getCategories, updateCategory, getLoans, getTransactions
} from '../api'
import type { Expense, Category, Loan, Transaction } from '../types'
import { Modal } from '../components/Modal'
import { ConfirmModal } from '../components/ConfirmModal'

const CATEGORIES = ['Housing', 'Mobility', 'Food & Groceries', 'Insurance', 'Entertainment', 'Health', 'Loans', 'Savings', 'Miscellaneous']
const INTERVAL_VALUES = [1, 3, 6, 12]

const EMPTY_FORM = {
  name: '',
  amount: '',
  interval_months: '1',
  booking_day: '1',
  category_id: '',
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: ''
}

type ExpenseChange = { id: number; expense_id: number; new_amount: number; effective_from: string }

export function ExpensesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [items, setItems] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(CATEGORIES))
  const [budgetTarget, setBudgetTarget] = useState<string | null>(null)
  const [budgetInput, setBudgetInput] = useState('')
  const [budgetSaving, setBudgetSaving] = useState(false)

  // Add/Edit modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Detail modal
  const [detailItem, setDetailItem] = useState<Expense | null>(null)
  const [detailChanges, setDetailChanges] = useState<ExpenseChange[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailEditMode, setDetailEditMode] = useState(false)
  const [detailForm, setDetailForm] = useState(EMPTY_FORM)

  // Schedule change
  const [changeTarget, setChangeTarget] = useState<Expense | null>(null)
  const [changeAmount, setChangeAmount] = useState('')
  const [changeDate, setChangeDate] = useState(new Date().toISOString().slice(0, 10))

  // Confirm delete
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteChangeId, setDeleteChangeId] = useState<{ expenseId: number; changeId: number } | null>(null)

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  const intervalLabel = (months: number) => {
    if (months === 1) return t('expenses.monthly')
    if (months === 3) return t('expenses.quarterly')
    if (months === 6) return t('expenses.semiannual')
    if (months === 12) return t('expenses.yearly')
    return `${months}M`
  }

  const load = () => {
    setLoading(true)
    Promise.all([getExpenses(), getCategories('expense'), getLoans(), getTransactions()])
      .then(([exps, cats, ls, txs]) => { setItems(exps); setCategories(cats); setLoans(ls); setTransactions(txs) })
      .catch(() => showToast(t('common.error'), 'error'))
      .finally(() => setLoading(false))
  }

  const handleSaveBudgetLimit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!budgetTarget) return
    const cat = categories.find(c => c.name === budgetTarget)
    if (!cat) return
    setBudgetSaving(true)
    try {
      const limit = budgetInput === '' ? null : parseFloat(budgetInput)
      await updateCategory(cat.id, { budget_limit: limit })
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, budget_limit: limit } : c))
      showToast(t('common.success'), 'success')
      setBudgetTarget(null)
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setBudgetSaving(false)
    }
  }

  useEffect(() => { load() }, [])

  // Group by category_id → canonical name, fall back to legacy text, then 'Uncategorized'
  const getCategoryName = (item: Expense) => {
    if (item.category_id) {
      const cat = categories.find(c => c.id === item.category_id)
      if (cat) return cat.name
    }
    return item.category || 'Uncategorized'
  }
  const categoryNames = categories.length > 0
    ? [...new Set(items.map(getCategoryName))]
    : CATEGORIES
  const grouped = categoryNames.reduce<Record<string, Expense[]>>((acc, cat) => {
    acc[cat] = items.filter(i => getCategoryName(i) === cat)
    return acc
  }, {})

  const monthlyEquivalent = (expense: Expense) => expense.amount / expense.interval_months

  const toggleCategory = (cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (item: Expense) => {
    setEditing(item)
    setForm({
      name: item.name,
      amount: String(item.amount),
      interval_months: String(item.interval_months),
      booking_day: String(item.booking_day),
      category_id: item.category_id ? String(item.category_id) : '',
      effective_from: item.effective_from,
      effective_to: item.effective_to || ''
    })
    setShowModal(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        name: form.name,
        amount: parseFloat(form.amount),
        interval_months: parseInt(form.interval_months),
        booking_day: parseInt(form.booking_day),
        category_id: form.category_id ? parseInt(form.category_id) : null,
        effective_from: form.effective_from,
        effective_to: form.effective_to || null,
        is_active: 1
      }
      if (editing) {
        const updated = await updateExpense(editing.id, payload)
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
        if (detailItem?.id === updated.id) setDetailItem(updated)
      } else {
        const created = await createExpense(payload)
        setItems(prev => [...prev, created])
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
      await deleteExpense(id)
      setItems(prev => prev.filter(i => i.id !== id))
      if (detailItem?.id === id) setDetailItem(null)
      showToast(t('common.success'), 'success')
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const openDetail = async (item: Expense) => {
    setDetailItem(item)
    setDetailEditMode(false)
    setDetailForm({
      name: item.name,
      amount: String(item.amount),
      interval_months: String(item.interval_months),
      booking_day: String(item.booking_day),
      category_id: item.category_id ? String(item.category_id) : '',
      effective_from: item.effective_from,
      effective_to: item.effective_to || ''
    })
    setDetailLoading(true)
    try {
      const changes = await getExpenseChanges(item.id)
      setDetailChanges(changes)
    } catch {
      setDetailChanges([])
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDetailSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!detailItem) return
    setSaving(true)
    try {
      const payload = {
        name: detailForm.name,
        amount: parseFloat(detailForm.amount),
        interval_months: parseInt(detailForm.interval_months),
        booking_day: parseInt(detailForm.booking_day),
        category_id: detailForm.category_id ? parseInt(detailForm.category_id) : null,
        effective_from: detailForm.effective_from,
        effective_to: detailForm.effective_to || null
      }
      const updated = await updateExpense(detailItem.id, payload)
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
      setDetailItem(updated)
      setDetailEditMode(false)
      showToast(t('common.success'), 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleScheduleChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!changeTarget) return
    setSaving(true)
    try {
      await scheduleExpenseChange(changeTarget.id, {
        new_amount: parseFloat(changeAmount),
        effective_from: changeDate
      })
      showToast(t('common.success'), 'success')
      setChangeTarget(null)
      if (detailItem?.id === changeTarget.id) {
        const changes = await getExpenseChanges(changeTarget.id)
        setDetailChanges(changes)
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteChange = async (expenseId: number, changeId: number) => {
    try {
      await deleteExpenseChange(expenseId, changeId)
      setDetailChanges(prev => prev.filter(c => c.id !== changeId))
      showToast(t('common.success'), 'success')
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const f = (field: keyof typeof EMPTY_FORM, val: string) => setForm(prev => ({ ...prev, [field]: val }))
  const fd = (field: keyof typeof EMPTY_FORM, val: string) => setDetailForm(prev => ({ ...prev, [field]: val }))

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('expenses.title')}</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ {t('expenses.add')}</button>
      </div>

      {loading ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : (
        <div className="category-groups">
          {categoryNames.map(cat => {
            const catItems = grouped[cat]
            if (!catItems || catItems.length === 0) return null
            const catTotal = catItems.reduce((s, i) => s + monthlyEquivalent(i), 0)
            const isOpen = expanded.has(cat)
            const catDef = categories.find(c => c.name === cat)
            const budgetLimit = catDef?.budget_limit ?? null
            const budgetPct = budgetLimit && budgetLimit > 0 ? Math.min(100, (catTotal / budgetLimit) * 100) : null

            return (
              <div key={cat} className="category-group">
                <div className="category-header" onClick={() => toggleCategory(cat)}>
                  <div className="category-header-left">
                    <span className="category-chevron">{isOpen ? '▾' : '▸'}</span>
                    <span className="category-name">{t(`categories.${cat}`, { defaultValue: cat })}</span>
                    <span className="badge badge-secondary">{catItems.length}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {budgetPct !== null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div style={{ width: '80px', height: '6px', background: 'var(--color-surface-active)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${budgetPct}%`, height: '100%', background: budgetPct >= 100 ? '#ef4444' : budgetPct >= 80 ? '#f59e0b' : '#10b981', borderRadius: '3px' }} />
                        </div>
                        <span className={`text-sm ${budgetPct >= 100 ? 'text-danger' : 'text-muted'}`}>{budgetPct.toFixed(0)}%</span>
                      </div>
                    )}
                    <span className="category-total text-danger">{fmt(catTotal)}/Mo</span>
                    <button
                      className="btn btn-ghost btn-xs"
                      title={t('budget.setLimit')}
                      onClick={e => { e.stopPropagation(); setBudgetTarget(cat); setBudgetInput(budgetLimit !== null ? String(budgetLimit) : '') }}
                    >⊙</button>
                  </div>
                </div>

                {isOpen && (
                  <div className="category-items">
                    <div className="item-card-list">
                      {catItems.map(item => (
                        <div
                          key={item.id}
                          className="item-card"
                          onClick={() => openDetail(item)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => e.key === 'Enter' && openDetail(item)}
                        >
                          <div className="item-card-main">
                            <span className="item-card-name">{item.name}</span>
                            <span className="item-card-meta">
                              {intervalLabel(item.interval_months)} · {item.booking_day}. · {t(`categories.${getCategoryName(item)}`, { defaultValue: getCategoryName(item) })}
                            </span>
                          </div>
                          <div className="item-card-right">
                            <div>
                              <span className="item-card-amount text-danger">{fmt(item.amount)}</span>
                              {item.interval_months !== 1 && (
                                <span className="item-card-equiv text-muted">{fmt(monthlyEquivalent(item))}/Mo</span>
                              )}
                            </div>
                            <div className="item-card-actions" onClick={e => e.stopPropagation()}>
                              <button className="btn btn-ghost btn-xs" title={t('expenses.scheduleChange')} onClick={() => { setChangeTarget(item); setChangeAmount(String(item.amount)); setChangeDate(new Date().toISOString().slice(0, 10)) }}>⏱</button>
                              <button className="btn btn-ghost btn-xs" title={t('common.edit')} onClick={() => openEdit(item)}>✏</button>
                              <button className="btn btn-ghost btn-xs text-danger" title={t('common.delete')} onClick={() => setDeleteId(item.id)}>🗑</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Loans Section */}
      {loans.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>{t('nav.loans')}</h2>
          <div className="item-list">
            {loans.map(loan => (
              <div key={loan.id} className="item-card">
                <div className="item-card-left">
                  <span className="item-card-name">{loan.name}</span>
                  <span className="text-muted text-sm">{t('loans.monthlyRate')}</span>
                </div>
                <div className="item-card-right">
                  <span className="item-card-amount text-danger">{fmt(loan.monthly_rate ?? 0)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bookings Section (issues 2+7) */}
      {(() => {
        const expenseTxs = transactions.filter(tx => tx.type === 'expense')
        const autoTxs = expenseTxs.filter(tx => tx.is_auto === 1)
        const manualTxs = expenseTxs.filter(tx => tx.is_auto === 0)
        if (expenseTxs.length === 0) return null
        const grouped2 = expenseTxs.reduce<Record<string, Transaction[]>>((acc, tx) => {
          const key = tx.date.slice(0, 7)
          if (!acc[key]) acc[key] = []
          acc[key].push(tx)
          return acc
        }, {})
        return (
          <div className="card" style={{ marginTop: '1.5rem' }}>
            <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>{t('transactions.title')}</h2>
            <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>
              {t('expenses.autoBookings', { auto: autoTxs.length, manual: manualTxs.length })}
            </p>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('expenses.name')}</th>
                    <th style={{ textAlign: 'right' }}>{t('expenses.amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped2).sort((a, b) => b[0].localeCompare(a[0])).flatMap(([, txs]) =>
                    txs.map(tx => (
                      <tr key={tx.id}>
                        <td className="text-muted">{new Date(tx.date + 'T00:00:00').toLocaleDateString('de-DE')}</td>
                        <td>
                          {tx.name}
                          {tx.is_auto ? <span className="badge badge-neutral" style={{ marginLeft: '0.4rem', fontSize: '0.7rem' }}>auto</span> : null}
                        </td>
                        <td style={{ textAlign: 'right' }} className="text-danger">{fmt(tx.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {/* Add / Edit Modal */}
      {showModal && (
        <Modal title={editing ? t('common.edit') : t('expenses.add')} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">{t('expenses.name')}</label>
              <input className="form-input" value={form.name} onChange={e => f('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('expenses.amount')}</label>
              <input className="form-input" type="number" step="0.01" value={form.amount} onChange={e => f('amount', e.target.value)} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('expenses.interval')}</label>
                <select className="form-select" value={form.interval_months} onChange={e => f('interval_months', e.target.value)}>
                  {INTERVAL_VALUES.map(v => (
                    <option key={v} value={v}>{intervalLabel(v)}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('expenses.bookingDay')}</label>
                <input className="form-input" type="number" min="1" max="31" value={form.booking_day} onChange={e => f('booking_day', e.target.value)} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('expenses.category')}</label>
              <select className="form-select" value={form.category_id} onChange={e => f('category_id', e.target.value)}>
                <option value="">—</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{t(`categories.${cat.name}`, { defaultValue: cat.name })}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('expenses.effectiveFrom')}</label>
                <input className="form-input" type="date" value={form.effective_from} onChange={e => f('effective_from', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('expenses.effectiveTo')}</label>
                <input className="form-input" type="date" value={form.effective_to} onChange={e => f('effective_to', e.target.value)} />
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>{t('common.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('common.loading') : t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <Modal title={detailItem.name} onClose={() => setDetailItem(null)} size="lg">
          {detailEditMode ? (
            <form onSubmit={handleDetailSave}>
              <div className="form-group">
                <label className="form-label">{t('expenses.name')}</label>
                <input className="form-input" value={detailForm.name} onChange={e => fd('name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('expenses.amount')}</label>
                <input className="form-input" type="number" step="0.01" value={detailForm.amount} onChange={e => fd('amount', e.target.value)} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('expenses.interval')}</label>
                  <select className="form-select" value={detailForm.interval_months} onChange={e => fd('interval_months', e.target.value)}>
                    {INTERVAL_VALUES.map(v => (
                      <option key={v} value={v}>{intervalLabel(v)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">{t('expenses.bookingDay')}</label>
                  <input className="form-input" type="number" min="1" max="31" value={detailForm.booking_day} onChange={e => fd('booking_day', e.target.value)} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">{t('expenses.category')}</label>
                <select className="form-select" value={detailForm.category_id} onChange={e => fd('category_id', e.target.value)}>
                  <option value="">—</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{t(`categories.${cat.name}`, { defaultValue: cat.name })}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">{t('expenses.effectiveFrom')}</label>
                  <input className="form-input" type="date" value={detailForm.effective_from} onChange={e => fd('effective_from', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('expenses.effectiveTo')}</label>
                  <input className="form-input" type="date" value={detailForm.effective_to} onChange={e => fd('effective_to', e.target.value)} />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setDetailEditMode(false)}>{t('common.cancel')}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('common.loading') : t('common.save')}</button>
              </div>
            </form>
          ) : (
            <>
              <div className="detail-fields">
                <div className="detail-row">
                  <span className="detail-label">{t('expenses.amount')}</span>
                  <span className="detail-value text-danger">{fmt(detailItem.amount)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('expenses.interval')}</span>
                  <span className="detail-value">{intervalLabel(detailItem.interval_months)}</span>
                </div>
                {detailItem.interval_months !== 1 && (
                  <div className="detail-row">
                    <span className="detail-label">{t('expenses.monthlyEquiv')}</span>
                    <span className="detail-value text-danger">{fmt(monthlyEquivalent(detailItem))}/Mo</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">{t('expenses.bookingDay')}</span>
                  <span className="detail-value">{detailItem.booking_day}.</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('expenses.category')}</span>
                  <span className="detail-value">{t(`categories.${getCategoryName(detailItem)}`, { defaultValue: getCategoryName(detailItem) })}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('expenses.effectiveFrom')}</span>
                  <span className="detail-value">{new Date(detailItem.effective_from).toLocaleDateString('de-DE')}</span>
                </div>
                {detailItem.effective_to && (
                  <div className="detail-row">
                    <span className="detail-label">{t('expenses.effectiveTo')}</span>
                    <span className="detail-value">{new Date(detailItem.effective_to).toLocaleDateString('de-DE')}</span>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <div className="detail-section-header">
                  <span className="detail-section-title">{t('common.scheduledChanges')}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setChangeTarget(detailItem); setChangeAmount(String(detailItem.amount)); setChangeDate(new Date().toISOString().slice(0, 10)) }}>
                    + {t('expenses.scheduleChange')}
                  </button>
                </div>
                {detailLoading ? (
                  <p className="text-muted">{t('common.loading')}</p>
                ) : detailChanges.length === 0 ? (
                  <p className="text-muted text-sm">{t('common.noChanges')}</p>
                ) : (
                  <div className="changes-list">
                    {detailChanges.map(c => (
                      <div key={c.id} className="change-row">
                        <span className="text-danger">{fmt(c.new_amount)}</span>
                        <span className="text-muted text-sm">{t('expenses.effectiveFrom')}: {new Date(c.effective_from).toLocaleDateString('de-DE')}</span>
                        <button className="btn btn-ghost btn-xs text-danger" onClick={() => setDeleteChangeId({ expenseId: detailItem.id, changeId: c.id })}>🗑</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(detailItem.id)}>{t('common.delete')}</button>
                <button className="btn btn-secondary" onClick={() => setDetailItem(null)}>{t('common.close')}</button>
                <button className="btn btn-primary" onClick={() => setDetailEditMode(true)}>{t('common.edit')}</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Schedule Change Modal */}
      {changeTarget && (
        <Modal title={t('expenses.scheduleChange')} onClose={() => setChangeTarget(null)} size="sm">
          <form onSubmit={handleScheduleChange}>
            <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>{changeTarget.name}</p>
            <div className="form-group">
              <label className="form-label">{t('expenses.newAmount')}</label>
              <input className="form-input" type="number" step="0.01" value={changeAmount} onChange={e => setChangeAmount(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('expenses.effectiveFrom')}</label>
              <input className="form-input" type="date" value={changeDate} onChange={e => setChangeDate(e.target.value)} required />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setChangeTarget(null)}>{t('common.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('common.loading') : t('common.save')}</button>
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

      {deleteChangeId !== null && (
        <ConfirmModal
          onConfirm={() => handleDeleteChange(deleteChangeId.expenseId, deleteChangeId.changeId)}
          onClose={() => setDeleteChangeId(null)}
        />
      )}

      {budgetTarget !== null && (
        <Modal title={t('budget.setLimit')} onClose={() => setBudgetTarget(null)} size="sm">
          <form onSubmit={handleSaveBudgetLimit}>
            <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>{t(`categories.${budgetTarget}`)}</p>
            <div className="form-group">
              <label className="form-label">{t('budget.monthlyLimit')}</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                value={budgetInput}
                onChange={e => setBudgetInput(e.target.value)}
                placeholder={t('budget.noLimit')}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setBudgetTarget(null)}>{t('common.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={budgetSaving}>{budgetSaving ? t('common.loading') : t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
