import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { getSavingsGoals, createSavingsGoal, updateSavingsGoal, deleteSavingsGoal, getDashboard } from '../api'
import type { SavingsGoal } from '../types'
import { Modal } from '../components/Modal'

const PRESET_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

const EMPTY_FORM = {
  name: '',
  target_amount: '',
  current_amount: '',
  contribution_mode: 'fixed' as SavingsGoal['contribution_mode'],
  fixed_amount: '',
  buffer_amount: '',
  color: PRESET_COLORS[0]
}

export function SavingsPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [goals, setGoals] = useState<SavingsGoal[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SavingsGoal | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const [emergencyCurrent, setEmergencyCurrent] = useState('')
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [dynamicResult, setDynamicResult] = useState<number | null>(null)
  const [recalcLoading, setRecalcLoading] = useState(false)
  const [totalMonthlyIncome, setTotalMonthlyIncome] = useState(0)

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  const load = () => {
    setLoading(true)
    Promise.all([
      getSavingsGoals(),
      getDashboard()
    ])
      .then(([g, dash]) => {
        setGoals(g)
        setTotalMonthlyIncome(dash.total_income)
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
      color: PRESET_COLORS[0]
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
        buffer_amount: form.contribution_mode !== 'fixed' && form.buffer_amount ? parseFloat(form.buffer_amount) : null
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
    if (!confirm(t('common.confirm'))) return
    try {
      await deleteSavingsGoal(id)
      setGoals(prev => prev.filter(g => g.id !== id))
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
      const dynamicSavings = Math.max(0, dash.free_money)
      setDynamicResult(dynamicSavings)
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setRecalcLoading(false)
    }
  }

  const f = (field: keyof typeof form, val: string) =>
    setForm(prev => ({ ...prev, [field]: val }))

  const emergencyTarget = totalMonthlyIncome * 3
  const emergencyCurrentNum = parseFloat(emergencyCurrent) || 0
  const emergencyPct = emergencyTarget > 0
    ? Math.min(100, (emergencyCurrentNum / emergencyTarget) * 100)
    : 0

  const showFixed = form.contribution_mode === 'fixed' || form.contribution_mode === 'both'
  const showDynamic = form.contribution_mode === 'dynamic' || form.contribution_mode === 'both'

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('savings.title')}</h1>
        <button className="btn btn-primary" onClick={openAdd}>+ {t('savings.add')}</button>
      </div>

      {loading ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : (
        <>
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
                  ? Math.min(100, (goal.current_amount / goal.target_amount) * 100)
                  : 0
                return (
                  <div key={goal.id} className="goal-card">
                    <div className="section-header">
                      <span style={{ fontWeight: 600, fontSize: '1rem' }}>{goal.name}</span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span className={`badge badge-${goal.contribution_mode === 'fixed' ? 'info' : goal.contribution_mode === 'dynamic' ? 'success' : 'warning'}`}>
                          {t(`savings.${goal.contribution_mode}`)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      <span className="text-muted">{fmt(goal.current_amount)}</span>
                      <span className="text-muted">{pct.toFixed(0)}%</span>
                      <span className="text-muted">{fmt(goal.target_amount)}</span>
                    </div>

                    <div className="progress-bar" style={{ marginBottom: '0.75rem' }}>
                      <div className="progress-fill" style={{ width: `${pct}%` }} />
                    </div>

                    {goal.fixed_amount != null && (
                      <p className="text-muted text-sm">
                        {t('savings.fixedAmount')}: {fmt(goal.fixed_amount)}/mo
                      </p>
                    )}
                    {goal.buffer_amount != null && (
                      <p className="text-muted text-sm">
                        {t('savings.bufferAmount')}: {fmt(goal.buffer_amount)}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(goal)}>
                        {t('common.edit')}
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(goal.id)}>
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
              Target: {fmt(emergencyTarget)} (3× monthly income)
            </p>
            <div className="form-group">
              <label className="form-label">Current emergency savings (€)</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                value={emergencyCurrent}
                onChange={e => setEmergencyCurrent(e.target.value)}
                placeholder="0"
                style={{ maxWidth: '240px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              <span className="text-muted">{fmt(emergencyCurrentNum)}</span>
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

          {/* Monthly recalc */}
          <div className="card">
            <h3 className="card-title">{t('savings.savingsRate')}</h3>
            <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
              Enter this month's salary to recalculate dynamic savings contribution.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">This month's salary (€)</label>
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
                {recalcLoading ? t('common.loading') : 'Recalculate'}
              </button>
            </div>
            {dynamicResult !== null && (
              <div className="card" style={{ marginTop: '1rem', background: 'var(--color-surface-2)' }}>
                <span className="text-muted">Dynamic savings this month: </span>
                <strong className={dynamicResult >= 0 ? 'text-success' : 'text-danger'}>
                  {fmt(dynamicResult)}
                </strong>
              </div>
            )}
          </div>
        </>
      )}

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
    </div>
  )
}
