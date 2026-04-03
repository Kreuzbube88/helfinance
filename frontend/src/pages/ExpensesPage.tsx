import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import {
  getExpenses, createExpense, updateExpense, deleteExpense,
  scheduleExpenseChange, getExpenseChanges, deleteExpenseChange,
  getCategories, updateCategory, getLoans
} from '../api'
import type { Expense, Category, Loan } from '../types'
import { Modal } from '../components/Modal'
import { ConfirmModal } from '../components/ConfirmModal'
import { Tooltip } from '../components/Tooltip'
import { LivePreview } from '../components/LivePreview'

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

interface ExpensesPageProps {
  embedded?: boolean
  triggerAdd?: boolean
  onTriggerHandled?: () => void
}

export function ExpensesPage({ embedded = false, triggerAdd, onTriggerHandled }: ExpensesPageProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [items, setItems] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set(CATEGORIES))
  const [sortByAmount, setSortByAmount] = useState(false)
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

  // End date modal
  const [endDateTarget, setEndDateTarget] = useState<Expense | null>(null)
  const [endDateValue, setEndDateValue] = useState('')

  // Confirm delete
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteChangeId, setDeleteChangeId] = useState<{ expenseId: number; changeId: number } | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

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
    Promise.all([getExpenses(), getCategories('expense'), getLoans()])
      .then(([exps, cats, ls]) => { setItems(exps); setCategories(cats); setLoans(ls) })
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

  useEffect(() => {
    if (triggerAdd) {
      openAdd()
      onTriggerHandled?.()
    }
  }, [triggerAdd])

  const getCategoryName = (item: Expense) => {
    if (item.category_id) {
      const cat = categories.find(c => c.id === item.category_id)
      if (cat) return cat.name
    }
    return item.category || 'Uncategorized'
  }
  const categoryNames = (categories.length > 0
    ? [...new Set(items.map(getCategoryName))]
    : CATEGORIES
  ).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))

  const grouped = categoryNames.reduce<Record<string, Expense[]>>((acc, cat) => {
    acc[cat] = items
      .filter(i => getCategoryName(i) === cat)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
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
    setShowAdvanced(false)
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
    setShowAdvanced(true)
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
    <div className={embedded ? '' : 'page'}>
      {!embedded && (
        <div className="page-header">
          <h1 className="page-title">{t('expenses.title')}</h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setSortByAmount(v => !v)}>
              {sortByAmount ? t('expenses.sortAlpha') : t('expenses.sortAmount')}
            </button>
            <button className="btn btn-primary" onClick={openAdd}>+ {t('expenses.add')}</button>
          </div>
        </div>
      )}
      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSortByAmount(v => !v)}>
            {sortByAmount ? t('expenses.sortAlpha') : t('expenses.sortAmount')}
          </button>
          <button className="btn btn-primary" onClick={openAdd}>+ {t('expenses.add')}</button>
        </div>
      )}

      {!loading && items.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}>
          <div className="card" style={{ padding: '0.875rem', textAlign: 'center' }}>
            <div className="text-muted text-sm">{t('expenses.totalMonthly')}</div>
            <div className="text-danger" style={{ fontWeight: 700, fontSize: '1.25rem' }}>
              {fmt(items.reduce((s, e) => s + e.amount / e.interval_months, 0))}
            </div>
          </div>
          <div className="card" style={{ padding: '0.875rem', textAlign: 'center' }}>
            <div className="text-muted text-sm">{t('expenses.totalLoans')}</div>
            <div className="text-danger" style={{ fontWeight: 700, fontSize: '1.25rem' }}>
              {fmt(loans.filter(l => {
                const end = new Date(l.start_date); end.setMonth(end.getMonth() + l.term_months)
                return new Date() < end
              }).reduce((s, l) => s + (l.monthly_rate ?? 0), 0))}
            </div>
          </div>
          <div className="card" style={{ padding: '0.875rem', textAlign: 'center' }}>
            <div className="text-muted text-sm">{t('expenses.categories')}</div>
            <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{categories.length}</div>
          </div>
          <div className="card" style={{ padding: '0.875rem', textAlign: 'center' }}>
            <div className="text-muted text-sm">{t('expenses.totalAll')}</div>
            <div className="text-danger" style={{ fontWeight: 700, fontSize: '1.25rem' }}>
              {fmt(
                items.reduce((s, e) => s + e.amount / e.interval_months, 0) +
                loans.filter(l => { const end = new Date(l.start_date); end.setMonth(end.getMonth() + l.term_months); return new Date() < end }).reduce((s, l) => s + (l.monthly_rate ?? 0), 0)
              )}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : (
        <div className="category-groups">
          {(sortByAmount
            ? [...categoryNames].sort((a, b) => {
                const ta = (grouped[a] ?? []).reduce((s, i) => s + monthlyEquivalent(i), 0)
                const tb = (grouped[b] ?? []).reduce((s, i) => s + monthlyEquivalent(i), 0)
                return tb - ta
              })
            : categoryNames
          ).map(cat => {
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
                      {catItems.map(item => {
                        const isEnded = item.effective_to && new Date(item.effective_to) < new Date()
                        return (
                        <div
                          key={item.id}
                          className="item-card"
                          style={{
                            opacity: isEnded ? 0.55 : 1,
                            borderLeft: `3px solid ${isEnded ? 'var(--color-border)' : 'var(--color-danger)'}`,
                          }}
                          onClick={() => openDetail(item)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={e => e.key === 'Enter' && openDetail(item)}
                        >
                          <div className="item-card-main">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <span className="item-card-name">{item.name}</span>
                              {isEnded && <span className="badge badge-neutral">{t('expenses.ended')}</span>}
                            </div>
                            <span className="item-card-meta">
                              {intervalLabel(item.interval_months)} · {item.booking_day}. · {t(`categories.${getCategoryName(item)}`, { defaultValue: getCategoryName(item) })}
                            </span>
                          </div>
                          <div className="item-card-right">
                            <div>
                              {item.interval_months === 1 ? (
                                <span className="item-card-amount text-danger">{fmt(item.amount)}</span>
                              ) : (
                                <span className="item-card-amount" style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                                  <span className="text-muted" style={{ fontSize: '0.75rem' }}>{intervalLabel(item.interval_months)}</span>
                                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>{fmt(item.amount)}</span>
                                  <span className="text-danger">{fmt(monthlyEquivalent(item))}/Mo</span>
                                </span>
                              )}
                            </div>
                            <div className="item-card-actions" onClick={e => e.stopPropagation()}>
                              <button className="btn btn-ghost btn-xs" title={t('expenses.scheduleChange')} onClick={() => { setChangeTarget(item); setChangeAmount(String(item.amount)); setChangeDate(new Date().toISOString().slice(0, 10)) }}>⏱</button>
                              <button className="btn btn-ghost btn-xs" title={t('expenses.setEndDate')} onClick={() => { setEndDateTarget(item); setEndDateValue(item.effective_to || '') }}>⏹</button>
                              <button className="btn btn-ghost btn-xs" title={t('common.edit')} onClick={() => openEdit(item)}>✏</button>
                              <button className="btn btn-ghost btn-xs text-danger" title={t('common.delete')} onClick={() => setDeleteId(item.id)}>🗑</button>
                            </div>
                          </div>
                        </div>
                      )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Loans Section — read-only, edit on LoansPage */}
      {loans.length > 0 && (() => {
        const now = new Date()
        const currentYear = now.getFullYear()
        const currentMonth = now.getMonth() + 1

        return (
          <div className="category-group" style={{ marginTop: '1.5rem' }}>
            <div className="category-header" style={{ cursor: 'default' }}>
              <div className="category-header-left">
                <span className="category-name">{t('nav.loans')}</span>
                <span className="badge badge-secondary">{loans.length}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="category-total text-danger">
                  {fmt(loans.reduce((sum, l) => {
                    const end = new Date(l.start_date)
                    end.setMonth(end.getMonth() + l.term_months)
                    const current = new Date(currentYear, currentMonth - 1, 1)
                    return current < end ? sum + (l.monthly_rate ?? 0) : sum
                  }, 0))}/Mo
                </span>
                <button
                  className="btn btn-ghost btn-xs"
                  title={t('loans.editOnLoansPage')}
                  onClick={() => navigate('/loans')}
                >✎</button>
              </div>
            </div>
            <div className="category-items">
              <div className="item-card-list">
                {loans.map(loan => {
                  const end = new Date(loan.start_date)
                  end.setMonth(end.getMonth() + loan.term_months)
                  const current = new Date(currentYear, currentMonth - 1, 1)
                  const isActive = current < end
                  const startDate = new Date(loan.start_date)
                  const monthsElapsed = (currentYear - startDate.getFullYear()) * 12 +
                    (currentMonth - (startDate.getMonth() + 1))
                  const monthsRemaining = Math.max(0, loan.term_months - monthsElapsed)

                  return (
                    <div key={loan.id} className={`item-card ${!isActive ? 'opacity-50' : ''}`}>
                      <div className="item-card-main">
                        <span className="item-card-name">{loan.name}</span>
                        <span className="item-card-meta">
                          {isActive
                            ? t('loans.monthsRemaining', { count: monthsRemaining })
                            : t('loans.paidOff')}
                          {' · '}{t('loans.editOnLoansPage')}
                        </span>
                      </div>
                      <div className="item-card-right">
                        <div>
                          <span className={`item-card-amount ${isActive ? 'text-danger' : 'text-muted'}`}>
                            {fmt(loan.monthly_rate ?? 0)}
                          </span>
                          <span className="item-card-equiv text-muted">/Mo</span>
                        </div>
                        <div className="item-card-actions">
                          <button
                            className="btn btn-ghost btn-xs"
                            title={t('loans.editOnLoansPage')}
                            onClick={() => navigate('/loans')}
                          >✎</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Add / Edit Modal */}
      {showModal && (
        <Modal title={editing ? t('common.edit') : t('expenses.add')} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">
                <Tooltip content={t('tooltips.name')}>{t('expenses.name')}</Tooltip>
              </label>
              <input className="form-input" value={form.name} onChange={e => f('name', e.target.value)} required placeholder={t('placeholders.expenseName')} />
            </div>
            <div className="form-group">
              <label className="form-label">
                <Tooltip content={t('tooltips.amount')}>{t('expenses.amount')}</Tooltip>
              </label>
              <input className="form-input" type="number" step="0.01" value={form.amount} onChange={e => f('amount', e.target.value)} required placeholder={t('placeholders.amount')} />
            </div>
            <div className="form-group">
              <label className="form-label">
                <Tooltip content={t('tooltips.interval')}>{t('expenses.interval')}</Tooltip>
              </label>
              <select className="form-select" value={form.interval_months} onChange={e => f('interval_months', e.target.value)}>
                {INTERVAL_VALUES.map(v => (
                  <option key={v} value={v}>{intervalLabel(v)}</option>
                ))}
              </select>
            </div>
            <LivePreview
              amount={parseFloat(form.amount) || 0}
              interval={parseInt(form.interval_months) || 1}
              type="expense"
              currency={currency}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm advanced-toggle"
              onClick={() => setShowAdvanced(v => !v)}
            >
              {t('forms.advancedOptions')} {showAdvanced ? '▲' : '▼'}
            </button>
            {showAdvanced && (
              <>
                <div className="form-group">
                  <label className="form-label">
                    <Tooltip content={t('tooltips.bookingDay')}>{t('expenses.bookingDay')}</Tooltip>
                  </label>
                  <input className="form-input" type="number" min="1" max="31" value={form.booking_day} onChange={e => f('booking_day', e.target.value)} required placeholder={t('placeholders.bookingDay')} />
                </div>
                <div className="form-group">
                  <label className="form-label">
                    <Tooltip content={t('tooltips.category')}>{t('expenses.category')}</Tooltip>
                  </label>
                  <select className="form-select" value={form.category_id} onChange={e => f('category_id', e.target.value)}>
                    <option value="">—</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{t(`categories.${cat.name}`, { defaultValue: cat.name })}</option>
                    ))}
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      <Tooltip content={t('tooltips.effectiveDates')}>{t('expenses.effectiveFrom')}</Tooltip>
                    </label>
                    <input className="form-input" type="date" value={form.effective_from} onChange={e => f('effective_from', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('expenses.effectiveTo')}</label>
                    <input className="form-input" type="date" value={form.effective_to} onChange={e => f('effective_to', e.target.value)} />
                  </div>
                </div>
              </>
            )}
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
                <button className="btn btn-ghost btn-sm" title={t('expenses.setEndDate')} onClick={() => { setEndDateTarget(detailItem); setEndDateValue(detailItem.effective_to || '') }}>⏹</button>
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

      {endDateTarget && (
        <Modal title={t('expenses.setEndDate')} onClose={() => setEndDateTarget(null)} size="sm">
          <p className="text-muted text-sm" style={{ marginBottom: 'var(--space-3)' }}>
            {endDateTarget.name}
          </p>
          <div className="form-group">
            <label className="form-label">{t('expenses.lastBookingDate')}</label>
            <input
              className="form-input"
              type="date"
              value={endDateValue}
              onChange={e => setEndDateValue(e.target.value)}
            />
          </div>
          <p className="text-muted text-sm">{t('expenses.endDateHint')}</p>
          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={async () => {
                try {
                  await updateExpense(endDateTarget.id, { effective_to: null })
                  setItems(prev => prev.map(i => i.id === endDateTarget.id ? { ...i, effective_to: null } : i))
                  showToast(t('common.success'), 'success')
                  setEndDateTarget(null)
                } catch { showToast(t('common.error'), 'error') }
              }}
            >{t('expenses.removeEndDate')}</button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                if (!endDateValue) return
                try {
                  await updateExpense(endDateTarget.id, { effective_to: endDateValue })
                  setItems(prev => prev.map(i => i.id === endDateTarget.id ? { ...i, effective_to: endDateValue } : i))
                  showToast(t('common.success'), 'success')
                  setEndDateTarget(null)
                } catch { showToast(t('common.error'), 'error') }
              }}
            >{t('common.save')}</button>
          </div>
        </Modal>
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
