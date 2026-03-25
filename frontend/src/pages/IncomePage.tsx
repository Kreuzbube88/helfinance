import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { getIncome, createIncome, updateIncome, deleteIncome, scheduleIncomeChange } from '../api'
import type { Income } from '../types'
import { Modal } from '../components/Modal'

const EMPTY_FORM = {
  name: '',
  amount: '',
  interval: 'monthly' as Income['interval'],
  booking_day: '1',
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: ''
}

export function IncomePage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [items, setItems] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Income | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const [changeTarget, setChangeTarget] = useState<Income | null>(null)
  const [changeAmount, setChangeAmount] = useState('')
  const [changeDate, setChangeDate] = useState(new Date().toISOString().slice(0, 10))

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  const load = () => {
    setLoading(true)
    getIncome()
      .then(setItems)
      .catch(() => showToast(t('common.error'), 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowModal(true)
  }

  const openEdit = (item: Income) => {
    setEditing(item)
    setForm({
      name: item.name,
      amount: String(item.amount),
      interval: item.interval,
      booking_day: String(item.booking_day),
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
        interval: form.interval,
        booking_day: parseInt(form.booking_day),
        effective_from: form.effective_from,
        effective_to: form.effective_to || null
      }
      if (editing) {
        const updated = await updateIncome(editing.id, payload)
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
      } else {
        const created = await createIncome(payload)
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
      await deleteIncome(id)
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
      await scheduleIncomeChange(changeTarget.id, {
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
        <h1 className="page-title">{t('income.title')}</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ {t('income.add')}</button>
      </div>

      {loading ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>{t('common.noData')}</p>
          <button className="btn btn-primary" onClick={openAdd}>{t('income.add')}</button>
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th>{t('income.name')}</th>
                <th>{t('income.amount')}</th>
                <th>{t('income.interval')}</th>
                <th>{t('income.bookingDay')}</th>
                <th>{t('income.effectiveFrom')}</th>
                <th>{t('income.effectiveTo')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td className="text-success">{fmt(item.amount)}</td>
                  <td>
                    <span className="badge badge-primary">
                      {t(`income.${item.interval}`)}
                    </span>
                  </td>
                  <td>{item.booking_day}.</td>
                  <td>{new Date(item.effective_from).toLocaleDateString('de-DE')}</td>
                  <td>{item.effective_to ? new Date(item.effective_to).toLocaleDateString('de-DE') : '—'}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => { setChangeTarget(item); setChangeAmount(String(item.amount)); setChangeDate(new Date().toISOString().slice(0, 10)) }}
                      >
                        {t('income.scheduleChange')}
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

      {showModal && (
        <Modal
          title={editing ? t('common.edit') : t('income.add')}
          onClose={() => setShowModal(false)}
        >
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">{t('income.name')}</label>
              <input className="form-input" value={form.name} onChange={e => f('name', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('income.amount')}</label>
              <input className="form-input" type="number" step="0.01" value={form.amount} onChange={e => f('amount', e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('income.interval')}</label>
              <select className="form-select" value={form.interval} onChange={e => f('interval', e.target.value)}>
                <option value="monthly">{t('income.monthly')}</option>
                <option value="yearly">{t('income.yearly')}</option>
                <option value="once">{t('income.once')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('income.bookingDay')}</label>
              <input className="form-input" type="number" min="1" max="31" value={form.booking_day} onChange={e => f('booking_day', e.target.value)} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('income.effectiveFrom')}</label>
                <input className="form-input" type="date" value={form.effective_from} onChange={e => f('effective_from', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('income.effectiveTo')}</label>
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
        <Modal title={t('income.scheduleChange')} onClose={() => setChangeTarget(null)} size="sm">
          <form onSubmit={handleScheduleChange}>
            <p className="text-muted">{changeTarget.name}</p>
            <div className="form-group">
              <label className="form-label">{t('income.amount')}</label>
              <input className="form-input" type="number" step="0.01" value={changeAmount} onChange={e => setChangeAmount(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('income.effectiveFrom')}</label>
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
