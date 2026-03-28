import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import {
  getHousehold,
  inviteHousehold,
  acceptHousehold,
  cancelHousehold,
  getSharedExpenses,
  createSharedExpense
} from '../api'
import type { HouseholdLink, SharedExpense } from '../types'
import { ConfirmModal } from '../components/ConfirmModal'

const EMPTY_EXPENSE = {
  name: '',
  amount: '',
  split_pct_a: '50',
  split_pct_b: '50',
  paid_by: ''
}

export function HouseholdPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [household, setHousehold] = useState<HouseholdLink | null | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [inviteInput, setInviteInput] = useState('')
  const [inviting, setSInviting] = useState(false)
  const [accepting, setAccepting] = useState(false)

  const [sharedExpenses, setSharedExpenses] = useState<SharedExpense[]>([])
  const [expForm, setExpForm] = useState(EMPTY_EXPENSE)
  const [addingExp, setAddingExp] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  const loadHousehold = () => {
    setLoading(true)
    getHousehold()
      .then(h => {
        setHousehold(h)
        if (h?.status === 'active') {
          return getSharedExpenses().then(setSharedExpenses)
        }
      })
      .catch(() => showToast(t('common.error'), 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadHousehold() }, [])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteInput.trim()) return
    setSInviting(true)
    try {
      const h = await inviteHousehold(inviteInput.trim())
      setHousehold(h)
      showToast(t('common.success'), 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSInviting(false)
    }
  }

  const handleAccept = async () => {
    if (!household) return
    setAccepting(true)
    try {
      const h = await acceptHousehold(household.id)
      setHousehold(h)
      const expenses = await getSharedExpenses()
      setSharedExpenses(expenses)
      showToast(t('common.success'), 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setAccepting(false)
    }
  }

  const handleCancel = async () => {
    if (!household) return
    try {
      await cancelHousehold(household.id)
      setHousehold(null)
      showToast(t('common.success'), 'success')
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setAddingExp(true)
    try {
      const created = await createSharedExpense({
        name: expForm.name,
        amount: parseFloat(expForm.amount),
        split_pct_a: parseFloat(expForm.split_pct_a),
        split_pct_b: parseFloat(expForm.split_pct_b),
        paid_by: parseInt(expForm.paid_by) || user.id
      })
      setSharedExpenses(prev => [...prev, created])
      setExpForm(EMPTY_EXPENSE)
      showToast(t('common.success'), 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setAddingExp(false)
    }
  }

  if (loading) {
    return (
      <div className="page">
        <p className="text-muted">{t('common.loading')}</p>
      </div>
    )
  }

  const iAmInviter = household?.invited_by === user?.id
  const partnerName = household?.partner_username || household?.partner_email || 'Partner'

  // State A: no household
  if (!household) {
    return (
      <div className="page">
        <h1 className="page-title">{t('household.title')}</h1>
        <div className="card household-status">
          <p className="text-muted">{t('household.connectHint')}</p>
          <form onSubmit={handleInvite} style={{ display: 'flex', gap: '0.75rem', width: '100%', maxWidth: '400px' }}>
            <input
              className="form-input"
              value={inviteInput}
              onChange={e => setInviteInput(e.target.value)}
              placeholder={t('household.inviteBy')}
              required
            />
            <button type="submit" className="btn btn-primary" disabled={inviting}>
              {inviting ? t('common.loading') : t('household.invite')}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // State B: pending
  if (household.status === 'pending') {
    if (iAmInviter) {
      // B: I sent the invite
      return (
        <div className="page">
          <h1 className="page-title">{t('household.title')}</h1>
          <div className="card household-status">
            <span className="badge badge-warning">{t('household.pending')}</span>
            <p>{t('household.waitingAccept', { name: partnerName })}</p>
            <button className="btn btn-danger btn-sm" onClick={() => setShowCancelConfirm(true)}>
              {t('household.cancelInvitation')}
            </button>
          </div>
        </div>
      )
    }

    // B2: partner sent the invite to me
    return (
      <div className="page">
        <h1 className="page-title">{t('household.title')}</h1>
        <div className="card household-status">
          <span className="badge badge-info">{t('household.pending')}</span>
          <p>{t('household.pendingFrom', { name: partnerName })}</p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-primary" onClick={handleAccept} disabled={accepting}>
              {accepting ? t('common.loading') : t('household.acceptInvitation')}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => setShowCancelConfirm(true)}>
              {t('household.decline')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // State C: active household
  const myShare = (exp: SharedExpense) => {
    const iAmA = household.user_a_id === user?.id
    const pct = iAmA ? exp.split_pct_a : exp.split_pct_b
    return (exp.amount * pct) / 100
  }

  const myTotal = sharedExpenses.reduce((sum, e) => sum + myShare(e), 0)
  const partnerTotal = sharedExpenses.reduce((sum, e) => sum + (e.amount - myShare(e)), 0)
  const diff = Math.abs(myTotal - partnerTotal)
  const iOwe = myTotal > partnerTotal

  return (
    <div className="page">
      <h1 className="page-title">{t('household.title')}</h1>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontWeight: 600 }}>{t('household.connectedWith')} <span className="text-primary">{partnerName}</span></p>
            <span className="badge badge-success">{t('household.active')}</span>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => setShowCancelConfirm(true)}>
            {t('household.disconnect')}
          </button>
        </div>
      </div>

      {/* Balance */}
      <div className="card" style={{
        background: iOwe ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
        borderColor: iOwe ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'
      }}>
        <h3 className="card-title">{t('household.balance')}</h3>
        <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>
          {iOwe
            ? <span className="text-danger">{t('household.youOwe', { name: partnerName, amount: fmt(diff) })}</span>
            : <span className="text-success">{t('household.owesYou', { name: partnerName, amount: fmt(diff) })}</span>
          }
        </p>
      </div>

      {/* Shared expenses */}
      <div className="card">
        <h3 className="card-title">{t('household.sharedExpenses')}</h3>

        {sharedExpenses.length > 0 ? (
          <div className="table-wrapper" style={{ marginBottom: '1.5rem' }}>
            <table>
              <thead>
                <tr>
                  <th>{t('expenses.name')}</th>
                  <th>{t('expenses.amount')}</th>
                  <th>Split A / B</th>
                  <th>{t('household.paidBy')}</th>
                  <th>{t('household.yourShare')}</th>
                </tr>
              </thead>
              <tbody>
                {sharedExpenses.map(exp => (
                  <tr key={exp.id}>
                    <td>{exp.name}</td>
                    <td>{fmt(exp.amount)}</td>
                    <td>{exp.split_pct_a}% / {exp.split_pct_b}%</td>
                    <td className="text-muted" style={{ fontSize: '0.85rem' }}>
                      {exp.paid_by === user?.id ? t('household.you') : partnerName}
                    </td>
                    <td>{fmt(myShare(exp))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-muted" style={{ marginBottom: '1rem' }}>{t('common.noData')}</p>
        )}

        <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.9rem' }}>{t('household.addSharedExpense')}</h4>
        <form onSubmit={handleAddExpense}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('expenses.name')}</label>
              <input
                className="form-input"
                value={expForm.name}
                onChange={e => setExpForm(p => ({ ...p, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('expenses.amount')}</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                min="0"
                value={expForm.amount}
                onChange={e => setExpForm(p => ({ ...p, amount: e.target.value }))}
                required
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('household.splitPctA')}</label>
              <input
                className="form-input"
                type="number"
                min="0"
                max="100"
                value={expForm.split_pct_a}
                onChange={e => setExpForm(p => ({ ...p, split_pct_a: e.target.value, split_pct_b: String(100 - (parseFloat(e.target.value) || 0)) }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('household.splitPctB')}</label>
              <input
                className="form-input"
                type="number"
                min="0"
                max="100"
                value={expForm.split_pct_b}
                onChange={e => setExpForm(p => ({ ...p, split_pct_b: e.target.value, split_pct_a: String(100 - (parseFloat(e.target.value) || 0)) }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">{t('household.paidBy')}</label>
            <select
              className="form-select"
              value={expForm.paid_by}
              onChange={e => setExpForm(p => ({ ...p, paid_by: e.target.value }))}
            >
              <option value={user?.id ?? ''}>{user?.username ?? t('household.you')}</option>
              <option value={household.user_a_id === user?.id ? household.user_b_id : household.user_a_id}>
                {partnerName}
              </option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={addingExp}>
            {addingExp ? t('common.loading') : t('household.addExpense')}
          </button>
        </form>
      </div>

      {showCancelConfirm && (
        <ConfirmModal
          onConfirm={handleCancel}
          onClose={() => setShowCancelConfirm(false)}
        />
      )}
    </div>
  )
}
