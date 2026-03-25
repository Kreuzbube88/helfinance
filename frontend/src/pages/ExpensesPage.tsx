import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { getExpenses, createExpense, updateExpense, deleteExpense, scheduleExpenseChange } from '../api'
import type { Expense } from '../types'
import { Modal } from '../components/Modal'

const CATEGORIES = ['Housing', 'Mobility', 'Food & Groceries', 'Insurance', 'Entertainment', 'Health', 'Loans', 'Savings', 'Miscellaneous']
const INTERVAL_OPTIONS = [
  { value: 1, label: 'Monatlich' },
  { value: 3, label: 'Vierteljährlich' },
  { value: 6, label: 'Halbjährlich' },
  { value: 12, label: 'Jährlich' }
]

const EMPTY_FORM = {
  name: '',
  amount: '',
  interval_months: '1',
  booking_day: '1',
  category: 'Housing',
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: ''
}

export function ExpensesPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [items, setItems] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [changeTarget, setChangeTarget] = useState<Expense | null>(null)
  const [changeAmount, setChangeAmount] = useState('')
  const [changeDate, setChangeDate] = useState(new Date().toISOString().slice(0, 10))

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  const load = () => {
    setLoading(true)
    getExpenses()
      .then(setItems)
      .catch(() => showToast(t('common.error'), 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const grouped = CATEGORIES.reduce<Record<string, Expense[]>>((acc, cat) => {
    acc[cat] = items.filter(i => i.category === cat)
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
      category: item.category,
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
        category: form.category,
        effective_from: form.effective_from,
        effective_to: form.effective_to || null
      }
      if (editing) {
        const updated = await updateExpense(editing.id, payload)
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
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
    if (!confirm(t('common.confirm'))) return
    try {
      await deleteExpense(id)
      setItems(prev => prev.filter(i => i.id !== id))
      showToast(t('common.success'), 'success')
    } catch {
      showToast(t('common.error'), 'error')
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
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const f = (field: keyof typeof form, val: string) => setForm(prev => ({ ...prev, [field]: val }))

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
          {CATEGORIES.map(cat => {
            const catItems = grouped[cat]
            if (catItems.length === 0) return null
            const catTotal = catItems.reduce((s, i) => s + monthlyEquivalent(i), 0)
            const isOpen = expanded.has(cat)

            return (
              <div key={cat} className="category-group">
                <div
                  className="category-header"
                  onClick={() => toggleCategory(cat)}
                >
                  <div className="category-header-left">
                    <span className="category-chevron">{isOpen ? '▾' : '▸'}</span>
                    <span className="category-name">{t(`categories.${cat}`)}</span>
                    <span className="badge badge-secondary">{catItems.length}</span>
                  </div>
                  <span className="category-total text-danger">{fmt(catTotal)}/Mo</span>
                </div>

                {isOpen && (
                  <div className="category-items">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t('expenses.name')}</th>
                          <th>{t('expenses.amount')}</th>
                          <th>{t('expenses.interval')}</th>
                          <th>Monatlich</th>
                          <th>{t('expenses.bookingDay')}</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {catItems.map(item => (
                          <tr key={item.id}>
                            <td>{item.name}</td>
                            <td>{fmt(item.amount)}</td>
                            <td>
                              {INTERVAL_OPTIONS.find(o => o.value === item.interval_months)?.label || `${item.interval_months}M`}
                            </td>
                            <td className="text-danger">
                              {item.interval_months !== 1 ? fmt(monthlyEquivalent(item)) : '—'}
                            </td>
                            <td>{item.booking_day}.</td>
                            <td>
                              <div className="action-buttons">
                                <button
                                  className="btn btn-ghost btn-sm"
                                  onClick={() => { setChangeTarget(item); setChangeAmount(String(item.amount)); setChangeDate(new Date().toISOString().slice(0, 10)) }}
                                >
                                  Ändern
                                </button>
                                <button className="btn btn-secondary btn-sm" onClick={() => openEdit(item)}>
                                  {t('common.edit')}
                                </button>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(item.id)}>
                                  {t('common.delete')}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

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
                  {INTERVAL_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
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
              <select className="form-select" value={form.category} onChange={e => f('category', e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{t(`categories.${c}`)}</option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Gültig ab</label>
                <input className="form-input" type="date" value={form.effective_from} onChange={e => f('effective_from', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Gültig bis</label>
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

      {changeTarget && (
        <Modal title="Änderung planen" onClose={() => setChangeTarget(null)} size="sm">
          <form onSubmit={handleScheduleChange}>
            <p className="text-muted">{changeTarget.name}</p>
            <div className="form-group">
              <label className="form-label">{t('expenses.amount')}</label>
              <input className="form-input" type="number" step="0.01" value={changeAmount} onChange={e => setChangeAmount(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Gültig ab</label>
              <input className="form-input" type="date" value={changeDate} onChange={e => setChangeDate(e.target.value)} required />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setChangeTarget(null)}>{t('common.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? t('common.loading') : t('common.save')}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
