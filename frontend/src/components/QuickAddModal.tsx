import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './Modal'
import { useToast } from '../contexts/ToastContext'
import { getCategories, createTransaction } from '../api'
import type { Category } from '../types'

interface Props {
  onClose: () => void
  onAdded?: () => void
}

export function QuickAddModal({ onClose, onAdded }: Props) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [categories, setCategories] = useState<Category[]>([])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getCategories('expense').then(setCategories).catch(() => {})
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !amount) return
    setSaving(true)
    try {
      await createTransaction({
        name,
        amount: parseFloat(amount),
        type: 'expense',
        category_id: categoryId ? parseInt(categoryId) : null,
        date: new Date().toISOString().slice(0, 10),
        note: null
      })
      showToast(t('common.success'), 'success')
      onAdded?.()
      onClose()
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('quickAdd.title')} onClose={onClose} size="sm">
      <form onSubmit={handleSave}>
        <div className="form-group">
          <label className="form-label">{t('quickAdd.description')}</label>
          <input
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('transactions.amount')}</label>
          <input
            className="form-input"
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">{t('transactions.category')}</label>
          <select className="form-select" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            <option value="">—</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {t(`categories.${cat.name}`, { defaultValue: cat.name })}
              </option>
            ))}
          </select>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.loading') : t('common.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
