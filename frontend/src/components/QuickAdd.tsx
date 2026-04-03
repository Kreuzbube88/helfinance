import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { createIncome, createExpense } from '../api'
import { Modal } from './Modal'

interface QuickAddProps {
  onSuccess: () => void
}

export function QuickAdd({ onSuccess }: QuickAddProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()

  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'income' | 'expense'>('expense')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().slice(0, 10)

  const reset = () => {
    setName('')
    setAmount('')
    setType('expense')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !amount) return
    setSaving(true)
    try {
      if (type === 'income') {
        await createIncome({
          name: name.trim(),
          amount: parseFloat(amount),
          interval: 'monthly',
          booking_day: 1,
          effective_from: today,
          effective_to: null,
          category_id: null,
          is_active: 1
        })
      } else {
        await createExpense({
          name: name.trim(),
          amount: parseFloat(amount),
          interval_months: 1,
          booking_day: 1,
          category_id: null,
          effective_from: today,
          effective_to: null,
          is_active: 1
        })
      }
      showToast(t('common.success'), 'success')
      setOpen(false)
      reset()
      onSuccess()
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit = name.trim().length > 0 && amount !== '' && parseFloat(amount) > 0

  return (
    <>
      <button
        className="fab"
        onClick={() => setOpen(true)}
        aria-label={t('quickAdd.title')}
      >
        +
      </button>

      {open && (
        <Modal title={t('quickAdd.title')} onClose={() => { setOpen(false); reset() }} size="sm">
          <div className="quickadd-type-toggle">
            <button
              type="button"
              className={`quickadd-type-btn ${type === 'income' ? 'active' : ''}`}
              onClick={() => setType('income')}
            >
              {t('quickAdd.typeIncome')}
            </button>
            <button
              type="button"
              className={`quickadd-type-btn ${type === 'expense' ? 'active' : ''}`}
              onClick={() => setType('expense')}
            >
              {t('quickAdd.typeExpense')}
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <input
                className="form-input"
                autoFocus
                placeholder={t('quickAdd.namePlaceholder')}
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0.01"
                placeholder={t('quickAdd.amountPlaceholder')}
                value={amount}
                onChange={e => setAmount(e.target.value)}
                required
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => { setOpen(false); reset() }}>
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!canSubmit || saving}
              >
                {saving ? t('common.loading') : t('quickAdd.submit')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
