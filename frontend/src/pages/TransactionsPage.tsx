import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import {
  getTransactions, createTransaction, updateTransaction, deleteTransaction,
  getCategories, importTransactionsCsv,
  scheduleIncomeChange, scheduleExpenseChange,
  updateIncome, updateExpense
} from '../api'
import type { Transaction, Category } from '../types'
import { Modal } from '../components/Modal'
import { ConfirmModal } from '../components/ConfirmModal'

const EMPTY_FORM = {
  name: '',
  amount: '',
  type: 'expense' as 'income' | 'expense',
  category_id: '',
  date: new Date().toISOString().slice(0, 10),
  note: ''
}

export function TransactionsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [items, setItems] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [changeMode, setChangeMode] = useState<'once' | 'permanent' | 'end'>('once')
  const [showImport, setShowImport] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  const load = () => {
    setLoading(true)
    getTransactions()
      .then(txs => setItems(txs))
      .catch(() => showToast(t('common.error'), 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    getCategories('expense').then(setCategories).catch(() => {})
  }, [])

  useEffect(() => {
    getCategories(form.type === 'income' ? 'income' : 'expense').then(setCategories).catch(() => {})
  }, [form.type])

  const f = (field: keyof typeof EMPTY_FORM, val: string) =>
    setForm(prev => ({ ...prev, [field]: val }))

  const openEdit = (tx: Transaction) => {
    setEditing(tx)
    setChangeMode('once')
    setForm({
      name: tx.name,
      amount: String(tx.amount),
      type: tx.type,
      category_id: tx.category_id ? String(tx.category_id) : '',
      date: tx.date,
      note: tx.note ?? ''
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setChangeMode('once')
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name: form.name,
      amount: parseFloat(form.amount),
      type: form.type,
      category_id: form.category_id ? parseInt(form.category_id) : null,
      date: form.date,
      note: form.note || null
    }
    try {
      if (editing) {
        if (changeMode === 'end' && editing.is_auto === 1) {
          if (editing.income_id != null) {
            await updateIncome(editing.income_id, { effective_to: form.date })
          } else if (editing.expense_id != null) {
            await updateExpense(editing.expense_id, { effective_to: form.date })
          }
          showToast(t('common.success'), 'success')
          closeModal()
          load()
          return
        } else if (changeMode === 'permanent' && editing.is_auto === 1) {
          // Bug 9: for permanent changes on auto-transactions, only schedule change — don't update the transaction record
          if (editing.income_id != null) {
            await scheduleIncomeChange(editing.income_id, {
              new_amount: parseFloat(form.amount),
              effective_from: form.date
            })
          } else if (editing.expense_id != null) {
            await scheduleExpenseChange(editing.expense_id, {
              new_amount: parseFloat(form.amount),
              effective_from: form.date
            })
          }
          // Don't call updateTransaction — let income_change/expense_change drive regeneration
        } else {
          // Once mode: update transaction and upsert booking_override via backend
          const body: Partial<Transaction> & { changeMode: string } = { ...payload, changeMode: 'once' }
          const updated = await updateTransaction(editing.id, body as Partial<Transaction>)
          setItems(prev => prev.map(i => i.id === editing.id ? updated : i))
        }
      } else {
        const created = await createTransaction(payload)
        setItems(prev => [created, ...prev])
      }
      showToast(t('common.success'), 'success')
      closeModal()
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteTransaction(id)
      setItems(prev => prev.filter(i => i.id !== id))
      showToast(t('common.success'), 'success')
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleImport = async () => {
    if (!csvText.trim()) return
    setImporting(true)
    try {
      const result = await importTransactionsCsv(csvText)
      showToast(t('transactions.importSuccess', { count: result.imported }), 'success')
      if (result.errors.length > 0) {
        result.errors.forEach(e => showToast(e, 'error'))
      }
      setShowImport(false)
      setCsvText('')
      load()
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setImporting(false)
    }
  }

  const getCatName = (id: number | null) => {
    if (!id) return '—'
    const cat = categories.find(c => c.id === id)
    return cat ? t(`categories.${cat.name}`, { defaultValue: cat.name }) : '—'
  }

  // Group by month
  const grouped = items.reduce<Record<string, Transaction[]>>((acc, tx) => {
    const key = tx.date.slice(0, 7)
    if (!acc[key]) acc[key] = []
    acc[key].push(tx)
    return acc
  }, {})

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('transactions.title')}</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
            {t('transactions.import')}
          </button>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }}>
            + {t('transactions.add')}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>{t('transactions.noTransactions')}</p>
          <button className="btn btn-primary" onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowModal(true) }}>
            {t('transactions.add')}
          </button>
        </div>
      ) : (
        Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([month, txs]) => (
          <div key={month} className="card" style={{ marginBottom: '1rem' }}>
            <h3 className="card-title" style={{ marginBottom: '0.75rem' }}>
              {new Date(month + '-01').toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })}
            </h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t('transactions.date')}</th>
                    <th>{t('transactions.name')}</th>
                    <th>{t('transactions.type')}</th>
                    <th>{t('transactions.category')}</th>
                    <th style={{ textAlign: 'right' }}>{t('transactions.amount')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {txs.map(tx => (
                    <tr key={tx.id}>
                      <td className="text-muted">{new Date(tx.date + 'T00:00:00').toLocaleDateString('de-DE')}</td>
                      <td>
                        <span>{tx.name}</span>
                        {tx.is_auto ? <span className="badge badge-neutral" style={{ marginLeft: '0.4rem', fontSize: '0.7rem' }}>auto</span> : null}
                        {tx.note && <div className="text-muted text-sm">{tx.note}</div>}
                      </td>
                      <td>
                        <span className={`badge ${tx.type === 'income' ? 'badge-success' : 'badge-neutral'}`}>
                          {t(`transactions.${tx.type}`)}
                        </span>
                      </td>
                      <td className="text-muted">{getCatName(tx.category_id)}</td>
                      <td style={{ textAlign: 'right' }} className={tx.type === 'income' ? 'text-success' : 'text-danger'}>
                        {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                      </td>
                      <td style={{ display: 'flex', gap: '0.25rem' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(tx)}>✎</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setDeleteId(tx.id)}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}

      {showModal && (
        <Modal title={editing ? t('common.edit') : t('transactions.add')} onClose={closeModal}>
          <form onSubmit={handleSave}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('transactions.date')}</label>
                <input className="form-input" type="date" value={form.date} onChange={e => f('date', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('transactions.type')}</label>
                <select className="form-select" value={form.type} onChange={e => { f('type', e.target.value); f('category_id', '') }}>
                  <option value="expense">{t('transactions.expense')}</option>
                  <option value="income">{t('transactions.income')}</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('transactions.name')}</label>
              <input className="form-input" value={form.name} onChange={e => f('name', e.target.value)} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('transactions.amount')}</label>
                <input className="form-input" type="number" step="0.01" min="0" value={form.amount} onChange={e => f('amount', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('transactions.category')}</label>
                <select className="form-select" value={form.category_id} onChange={e => f('category_id', e.target.value)}>
                  <option value="">—</option>
                  {categories.filter(cat => cat.type === form.type || cat.type === 'both').map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {t(`categories.${cat.name}`, { defaultValue: cat.name })}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('transactions.note')}</label>
              <input className="form-input" value={form.note} onChange={e => f('note', e.target.value)} />
            </div>
            {editing && editing.is_auto === 1 && (editing.income_id != null || editing.expense_id != null) && (
              <div className="form-group" style={{ borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
                <label className="form-label">{t('transactions.changeMode')}</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="radio" value="once" checked={changeMode === 'once'} onChange={() => setChangeMode('once')} style={{ marginRight: '0.4rem' }} />
                    {t('transactions.changeModeOnce')}
                  </label>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="radio" value="permanent" checked={changeMode === 'permanent'} onChange={() => setChangeMode('permanent')} style={{ marginRight: '0.4rem' }} />
                    {t('transactions.changeModePermanent')}
                  </label>
                  <label style={{ cursor: 'pointer' }}>
                    <input type="radio" value="end" checked={changeMode === 'end'} onChange={() => setChangeMode('end')} style={{ marginRight: '0.4rem' }} />
                    {t('transactions.changeModeEnd')}
                  </label>
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeModal}>{t('common.cancel')}</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? t('common.loading') : t('common.save')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {showImport && (
        <Modal title={t('transactions.import')} onClose={() => setShowImport(false)}>
          <p className="text-muted text-sm" style={{ marginBottom: '0.75rem' }}>{t('transactions.importDesc')}</p>
          <textarea
            className="form-input"
            rows={8}
            style={{ fontFamily: 'monospace', fontSize: '0.8rem', resize: 'vertical' }}
            placeholder="2025-01-15,50.00,Supermarkt,expense&#10;2025-01-01,3000.00,Gehalt,income"
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
          />
          <div className="modal-actions" style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={() => setShowImport(false)}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={handleImport} disabled={importing || !csvText.trim()}>
              {importing ? t('common.loading') : t('common.import')}
            </button>
          </div>
        </Modal>
      )}

      {deleteId !== null && (
        <ConfirmModal
          onConfirm={() => handleDelete(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
