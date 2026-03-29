import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import {
  getIncome, createIncome, updateIncome, deleteIncome,
  scheduleIncomeChange, getIncomeChanges, deleteIncomeChange,
  getCategories,
  upsertOverride, getOverrides, deleteOverride
} from '../api'
import type { Income, IncomeChange, Category, BookingOverride } from '../types'
import { Modal } from '../components/Modal'
import { ConfirmModal } from '../components/ConfirmModal'

const EMPTY_FORM = {
  name: '',
  amount: '',
  interval: 'monthly' as Income['interval'],
  booking_day: '1',
  effective_from: new Date().toISOString().slice(0, 10),
  effective_to: '',
  category_id: ''
}

interface IncomePageProps {
  embedded?: boolean
}

export function IncomePage({ embedded = false }: IncomePageProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [items, setItems] = useState<Income[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Add/edit modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Income | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Detail modal
  const [detailItem, setDetailItem] = useState<Income | null>(null)
  const [detailChanges, setDetailChanges] = useState<IncomeChange[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailEditMode, setDetailEditMode] = useState(false)
  const [detailForm, setDetailForm] = useState(EMPTY_FORM)

  // Schedule change modal
  const [changeTarget, setChangeTarget] = useState<Income | null>(null)
  const [changeAmount, setChangeAmount] = useState('')
  const [changeDate, setChangeDate] = useState(new Date().toISOString().slice(0, 10))

  // End date modal
  const [endDateTarget, setEndDateTarget] = useState<Income | null>(null)
  const [endDateValue, setEndDateValue] = useState('')

  // Override modal
  const [overrideTarget, setOverrideTarget] = useState<Income | null>(null)
  const [overrideMonth, setOverrideMonth] = useState(new Date().toISOString().slice(0, 7))
  const [overrideAmount, setOverrideAmount] = useState('')
  const [existingOverrides, setExistingOverrides] = useState<BookingOverride[]>([])
  const [overridesLoading, setOverridesLoading] = useState(false)

  // Confirm delete modals
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteChangeId, setDeleteChangeId] = useState<{ incomeId: number; changeId: number } | null>(null)

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  const load = () => {
    setLoading(true)
    Promise.all([getIncome(), getCategories('income')])
      .then(([inc, cats]) => { setItems(inc); setCategories(cats) })
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
      effective_to: item.effective_to || '',
      category_id: item.category_id ? String(item.category_id) : ''
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
        effective_to: form.effective_to || null,
        category_id: form.category_id ? parseInt(form.category_id) : null,
        is_active: 1
      }
      if (editing) {
        const updated = await updateIncome(editing.id, payload)
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i))
        if (detailItem?.id === updated.id) setDetailItem(updated)
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
    try {
      await deleteIncome(id)
      setItems(prev => prev.filter(i => i.id !== id))
      if (detailItem?.id === id) setDetailItem(null)
      showToast(t('common.success'), 'success')
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const openDetail = async (item: Income) => {
    setDetailItem(item)
    setDetailEditMode(false)
    setDetailForm({
      name: item.name,
      amount: String(item.amount),
      interval: item.interval,
      booking_day: String(item.booking_day),
      effective_from: item.effective_from,
      effective_to: item.effective_to || '',
      category_id: item.category_id ? String(item.category_id) : ''
    })
    setDetailLoading(true)
    try {
      const changes = await getIncomeChanges(item.id)
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
        interval: detailForm.interval,
        booking_day: parseInt(detailForm.booking_day),
        effective_from: detailForm.effective_from,
        effective_to: detailForm.effective_to || null,
        category_id: detailForm.category_id ? parseInt(detailForm.category_id) : null
      }
      const updated = await updateIncome(detailItem.id, payload)
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
      await scheduleIncomeChange(changeTarget.id, {
        new_amount: parseFloat(changeAmount),
        effective_from: changeDate
      })
      showToast(t('common.success'), 'success')
      setChangeTarget(null)
      // Refresh changes if detail modal is open
      if (detailItem?.id === changeTarget.id) {
        const changes = await getIncomeChanges(changeTarget.id)
        setDetailChanges(changes)
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteChange = async (incomeId: number, changeId: number) => {
    try {
      await deleteIncomeChange(incomeId, changeId)
      setDetailChanges(prev => prev.filter(c => c.id !== changeId))
      showToast(t('common.success'), 'success')
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const f = (field: keyof typeof EMPTY_FORM, val: string) => setForm(prev => ({ ...prev, [field]: val }))
  const fd = (field: keyof typeof EMPTY_FORM, val: string) => setDetailForm(prev => ({ ...prev, [field]: val }))

  const intervalLabel = (interval: Income['interval']) => {
    if (interval === 'monthly') return t('income.monthly')
    if (interval === 'yearly') return t('income.yearly')
    return t('income.once')
  }

  return (
    <div className={embedded ? '' : 'page'}>
      {!embedded && (
        <div className="page-header">
          <h1 className="page-title">{t('income.title')}</h1>
          <button className="btn btn-primary" onClick={openAdd}>+ {t('income.add')}</button>
        </div>
      )}
      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
          <button className="btn btn-primary" onClick={openAdd}>+ {t('income.add')}</button>
        </div>
      )}

      {loading ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : (
        <>
          {items.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.75rem',
              marginBottom: '1.5rem',
            }}>
              <div className="card" style={{ padding: '0.875rem', textAlign: 'center' }}>
                <div className="text-muted text-sm">{t('income.totalMonthly')}</div>
                <div className="text-success" style={{ fontWeight: 700, fontSize: '1.25rem' }}>
                  {fmt(items.reduce((s, i) => s + (i.interval === 'yearly' ? i.amount / 12 : i.interval === 'monthly' ? i.amount : 0), 0))}
                </div>
              </div>
              <div className="card" style={{ padding: '0.875rem', textAlign: 'center' }}>
                <div className="text-muted text-sm">{t('income.sources')}</div>
                <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>{items.length}</div>
              </div>
              <div className="card" style={{ padding: '0.875rem', textAlign: 'center' }}>
                <div className="text-muted text-sm">{t('income.activeNow')}</div>
                <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>
                  {items.filter(i => !i.effective_to || new Date(i.effective_to) >= new Date()).length}
                </div>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="empty-state">
              <p>{t('common.noData')}</p>
              <button className="btn btn-primary" onClick={openAdd}>{t('income.add')}</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {items.map(item => {
                const isEnded = item.effective_to && new Date(item.effective_to) < new Date()
                const monthlyAmt = item.interval === 'yearly' ? item.amount / 12 : item.amount
                return (
                  <div
                    key={item.id}
                    className="card"
                    style={{
                      padding: '1rem',
                      cursor: 'pointer',
                      opacity: isEnded ? 0.55 : 1,
                      borderLeft: `3px solid ${isEnded ? 'var(--color-border)' : 'var(--color-success)'}`,
                    }}
                    onClick={() => openDetail(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && openDetail(item)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{item.name}</span>
                          {isEnded && <span className="badge badge-neutral">{t('income.ended')}</span>}
                          {item.interval === 'once' && <span className="badge badge-info">{t('income.once')}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                          <span className="text-muted text-sm">
                            {intervalLabel(item.interval)} · {t('common.day')} {item.booking_day}
                          </span>
                          {item.effective_from && (
                            <span className="text-muted text-sm">
                              {t('income.from')}: {new Date(item.effective_from).toLocaleDateString('de-DE')}
                            </span>
                          )}
                          {item.effective_to && (
                            <span className="text-muted text-sm">
                              {t('income.to')}: {new Date(item.effective_to).toLocaleDateString('de-DE')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
                        <div style={{ textAlign: 'right' }}>
                          <div className="text-success" style={{ fontWeight: 700, fontSize: '1rem' }}>
                            {fmt(item.amount)}
                          </div>
                          {item.interval !== 'monthly' && item.interval !== 'once' && (
                            <div className="text-muted text-sm">{fmt(monthlyAmt)}/Mo</div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem' }} onClick={e => e.stopPropagation()}>
                          <button className="btn btn-ghost btn-xs" title={t('income.scheduleChange')}
                            onClick={() => { setChangeTarget(item); setChangeAmount(String(item.amount)); setChangeDate(new Date().toISOString().slice(0, 10)) }}>⏱</button>
                          <button className="btn btn-ghost btn-xs" title={t('income.setEndDate')}
                            onClick={() => { setEndDateTarget(item); setEndDateValue(item.effective_to || '') }}>⏹</button>
                          <button
                            className="btn btn-ghost btn-xs"
                            title={t('income.overrideMonth')}
                            onClick={async () => {
                              setOverrideTarget(item); setOverrideAmount(String(item.amount))
                              setOverrideMonth(new Date().toISOString().slice(0, 7))
                              setOverridesLoading(true)
                              try { const ovs = await getOverrides({ booking_type: 'income', booking_id: item.id }); setExistingOverrides(ovs) }
                              catch { setExistingOverrides([]) } finally { setOverridesLoading(false) }
                            }}>◎</button>
                          <button className="btn btn-ghost btn-xs text-danger" title={t('common.delete')}
                            onClick={() => setDeleteId(item.id)}>🗑</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}


      {/* Add / Edit Modal */}
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

      {/* Detail Modal */}
      {detailItem && (
        <Modal title={detailItem.name} onClose={() => setDetailItem(null)} size="lg">
          {detailEditMode ? (
            <form onSubmit={handleDetailSave}>
              <div className="form-group">
                <label className="form-label">{t('income.name')}</label>
                <input className="form-input" value={detailForm.name} onChange={e => fd('name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('income.amount')}</label>
                <input className="form-input" type="number" step="0.01" value={detailForm.amount} onChange={e => fd('amount', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('income.interval')}</label>
                <select className="form-select" value={detailForm.interval} onChange={e => fd('interval', e.target.value)}>
                  <option value="monthly">{t('income.monthly')}</option>
                  <option value="yearly">{t('income.yearly')}</option>
                  <option value="once">{t('income.once')}</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('income.bookingDay')}</label>
                <input className="form-input" type="number" min="1" max="31" value={detailForm.booking_day} onChange={e => fd('booking_day', e.target.value)} required />
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
                  <label className="form-label">{t('income.effectiveFrom')}</label>
                  <input className="form-input" type="date" value={detailForm.effective_from} onChange={e => fd('effective_from', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">{t('income.effectiveTo')}</label>
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
                  <span className="detail-label">{t('income.amount')}</span>
                  <span className="detail-value text-success">{fmt(detailItem.amount)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('income.interval')}</span>
                  <span className="detail-value">{intervalLabel(detailItem.interval)}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('income.bookingDay')}</span>
                  <span className="detail-value">{detailItem.booking_day}.</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{t('income.effectiveFrom')}</span>
                  <span className="detail-value">{new Date(detailItem.effective_from).toLocaleDateString('de-DE')}</span>
                </div>
                {detailItem.effective_to && (
                  <div className="detail-row">
                    <span className="detail-label">{t('income.effectiveTo')}</span>
                    <span className="detail-value">{new Date(detailItem.effective_to).toLocaleDateString('de-DE')}</span>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <div className="detail-section-header">
                  <span className="detail-section-title">{t('common.scheduledChanges')}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setChangeTarget(detailItem); setChangeAmount(String(detailItem.amount)); setChangeDate(new Date().toISOString().slice(0, 10)) }}>
                    + {t('income.scheduleChange')}
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
                        <span className="text-success">{fmt(c.new_amount)}</span>
                        <span className="text-muted text-sm">{t('income.effectiveFrom')}: {new Date(c.effective_from).toLocaleDateString('de-DE')}</span>
                        <button className="btn btn-ghost btn-xs text-danger" onClick={() => setDeleteChangeId({ incomeId: detailItem.id, changeId: c.id })}>🗑</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(detailItem.id)}>{t('common.delete')}</button>
                <button className="btn btn-ghost btn-sm" title={t('income.setEndDate')} onClick={() => { setEndDateTarget(detailItem); setEndDateValue(detailItem.effective_to || '') }}>⏹</button>
                <button
                  className="btn btn-ghost btn-sm"
                  title={t('income.overrideMonth')}
                  onClick={async () => {
                    setOverrideTarget(detailItem)
                    setOverrideAmount(String(detailItem.amount))
                    setOverrideMonth(new Date().toISOString().slice(0, 7))
                    setOverridesLoading(true)
                    try {
                      const ovs = await getOverrides({ booking_type: 'income', booking_id: detailItem.id })
                      setExistingOverrides(ovs)
                    } catch { setExistingOverrides([]) }
                    finally { setOverridesLoading(false) }
                  }}
                >◎</button>
                <button className="btn btn-secondary" onClick={() => setDetailItem(null)}>{t('common.close')}</button>
                <button className="btn btn-primary" onClick={() => setDetailEditMode(true)}>{t('common.edit')}</button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Schedule Change Modal */}
      {changeTarget && (
        <Modal title={t('income.scheduleChange')} onClose={() => setChangeTarget(null)} size="sm">
          <form onSubmit={handleScheduleChange}>
            <p className="text-muted" style={{ marginBottom: 'var(--space-4)' }}>{changeTarget.name}</p>
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

      {endDateTarget && (
        <Modal title={t('income.setEndDate')} onClose={() => setEndDateTarget(null)} size="sm">
          <p className="text-muted text-sm" style={{ marginBottom: 'var(--space-3)' }}>
            {endDateTarget.name}
          </p>
          <div className="form-group">
            <label className="form-label">{t('income.lastBookingDate')}</label>
            <input
              className="form-input"
              type="date"
              value={endDateValue}
              onChange={e => setEndDateValue(e.target.value)}
            />
          </div>
          <p className="text-muted text-sm">{t('income.endDateHint')}</p>
          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              onClick={async () => {
                try {
                  await updateIncome(endDateTarget.id, { effective_to: null })
                  setItems(prev => prev.map(i => i.id === endDateTarget.id ? { ...i, effective_to: null } : i))
                  showToast(t('common.success'), 'success')
                  setEndDateTarget(null)
                } catch { showToast(t('common.error'), 'error') }
              }}
            >{t('income.removeEndDate')}</button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                if (!endDateValue) return
                try {
                  await updateIncome(endDateTarget.id, { effective_to: endDateValue })
                  setItems(prev => prev.map(i => i.id === endDateTarget.id ? { ...i, effective_to: endDateValue } : i))
                  showToast(t('common.success'), 'success')
                  setEndDateTarget(null)
                } catch { showToast(t('common.error'), 'error') }
              }}
            >{t('common.save')}</button>
          </div>
        </Modal>
      )}

      {overrideTarget && (
        <Modal title={t('income.overrideMonth')} onClose={() => setOverrideTarget(null)} size="sm">
          <p className="text-muted text-sm" style={{ marginBottom: 'var(--space-3)' }}>
            {overrideTarget.name} — {t('income.overrideHint')}
          </p>
          <div className="form-group">
            <label className="form-label">{t('common.month')}</label>
            <input
              className="form-input"
              type="month"
              value={overrideMonth}
              onChange={e => setOverrideMonth(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('income.amount')}</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              value={overrideAmount}
              onChange={e => setOverrideAmount(e.target.value)}
            />
          </div>
          <div className="modal-actions" style={{ marginBottom: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => setOverrideTarget(null)}>{t('common.cancel')}</button>
            <button
              className="btn btn-primary"
              onClick={async () => {
                try {
                  await upsertOverride({
                    booking_type: 'income',
                    booking_id: overrideTarget.id,
                    month: overrideMonth,
                    override_amount: parseFloat(overrideAmount),
                  })
                  const ovs = await getOverrides({ booking_type: 'income', booking_id: overrideTarget.id })
                  setExistingOverrides(ovs)
                  showToast(t('common.success'), 'success')
                } catch { showToast(t('common.error'), 'error') }
              }}
            >{t('common.save')}</button>
          </div>
          {overridesLoading ? (
            <p className="text-muted text-sm">{t('common.loading')}</p>
          ) : existingOverrides.length > 0 && (
            <div>
              <p className="text-muted text-sm" style={{ marginBottom: '0.4rem' }}>{t('income.existingOverrides')}</p>
              {existingOverrides.map(ov => (
                <div key={ov.id} className="change-row">
                  <span className="text-muted text-sm">{ov.month}</span>
                  <span className="text-success">{fmt(ov.override_amount)}</span>
                  <button
                    className="btn btn-ghost btn-xs text-danger"
                    onClick={async () => {
                      try {
                        await deleteOverride(ov.id)
                        setExistingOverrides(prev => prev.filter(o => o.id !== ov.id))
                        showToast(t('common.success'), 'success')
                      } catch { showToast(t('common.error'), 'error') }
                    }}
                  >🗑</button>
                </div>
              ))}
            </div>
          )}
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
          onConfirm={() => handleDeleteChange(deleteChangeId.incomeId, deleteChangeId.changeId)}
          onClose={() => setDeleteChangeId(null)}
        />
      )}
    </div>
  )
}
