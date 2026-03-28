import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import { getLoans, createLoan, deleteLoan, getLoanAmortization, getLoanSpecialPayments, createLoanSpecialPayment, deleteLoanSpecialPayment } from '../api'
import type { Loan, AmortizationRow, LoanSpecialPayment } from '../types'
import { Modal } from '../components/Modal'
import { ConfirmModal } from '../components/ConfirmModal'

function calcMonthlyRate(principal: number, annualPct: number, termMonths: number): number {
  if (principal <= 0 || annualPct <= 0 || termMonths <= 0) return 0
  const r = annualPct / 100 / 12
  return (principal * r * Math.pow(1 + r, termMonths)) / (Math.pow(1 + r, termMonths) - 1)
}

const EMPTY_FORM = {
  name: '',
  principal: '',
  interest_rate_pct: '',
  term_months: '',
  start_date: new Date().toISOString().slice(0, 10),
  loan_type: 'annuity' as Loan['loan_type']
}

const EMPTY_SP_FORM = { amount: '', date: '' }

const PAGE_SIZE = 12

export function LoansPage() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [loans, setLoans] = useState<Loan[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [amortLoan, setAmortLoan] = useState<Loan | null>(null)
  const [amortRows, setAmortRows] = useState<AmortizationRow[]>([])
  const [amortLoading, setAmortLoading] = useState(false)
  const [amortPage, setAmortPage] = useState(0)

  const [spLoan, setSpLoan] = useState<Loan | null>(null)
  const [specialPayments, setSpecialPayments] = useState<LoanSpecialPayment[]>([])
  const [spForm, setSpForm] = useState(EMPTY_SP_FORM)
  const [spSaving, setSpSaving] = useState(false)
  const [deleteSpId, setDeleteSpId] = useState<{ loanId: number; spId: number } | null>(null)

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  const load = () => {
    setLoading(true)
    getLoans()
      .then(setLoans)
      .catch(() => showToast(t('common.error'), 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const liveMonthly = calcMonthlyRate(
    parseFloat(form.principal) || 0,
    parseFloat(form.interest_rate_pct) || 0,
    parseInt(form.term_months) || 0
  )

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const created = await createLoan({
        name: form.name,
        principal: parseFloat(form.principal),
        interest_rate_pct: parseFloat(form.interest_rate_pct),
        term_months: parseInt(form.term_months),
        start_date: form.start_date,
        loan_type: form.loan_type
      })
      setLoans(prev => [...prev, created])
      showToast(t('common.success'), 'success')
      setShowModal(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteLoan(id)
      setLoans(prev => prev.filter(l => l.id !== id))
      showToast(t('common.success'), 'success')
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const openAmortization = async (loan: Loan) => {
    setAmortLoan(loan)
    setAmortPage(0)
    setAmortLoading(true)
    try {
      const rows = await getLoanAmortization(loan.id)
      setAmortRows(rows)
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setAmortLoading(false)
    }
  }

  const openSpecialPayments = async (loan: Loan) => {
    setSpLoan(loan)
    setSpForm(EMPTY_SP_FORM)
    try {
      const sps = await getLoanSpecialPayments(loan.id)
      setSpecialPayments(sps)
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const handleAddSp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!spLoan) return
    setSpSaving(true)
    try {
      const sp = await createLoanSpecialPayment(spLoan.id, {
        amount: parseFloat(spForm.amount),
        date: spForm.date
      })
      setSpecialPayments(prev => [...prev, sp])
      setSpForm(EMPTY_SP_FORM)
      showToast(t('common.success'), 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('common.error'), 'error')
    } finally {
      setSpSaving(false)
    }
  }

  const handleDeleteSp = async (loanId: number, spId: number) => {
    try {
      await deleteLoanSpecialPayment(loanId, spId)
      setSpecialPayments(prev => prev.filter(sp => sp.id !== spId))
      showToast(t('common.success'), 'success')
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const f = (field: keyof typeof form, val: string) =>
    setForm(prev => ({ ...prev, [field]: val }))

  const sortedByRate = [...loans].sort((a, b) => b.interest_rate_pct - a.interest_rate_pct)

  const amortPageRows = amortRows.slice(amortPage * PAGE_SIZE, (amortPage + 1) * PAGE_SIZE)
  const amortTotalPages = Math.ceil(amortRows.length / PAGE_SIZE)

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('loans.title')}</h1>
        <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }}>
          + {t('loans.add')}
        </button>
      </div>

      {loading ? (
        <p className="text-muted">{t('common.loading')}</p>
      ) : loans.length === 0 ? (
        <div className="empty-state">
          <p>{t('common.noData')}</p>
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY_FORM); setShowModal(true) }}>
            {t('loans.add')}
          </button>
        </div>
      ) : (
        <>
          {loans.length >= 2 && (
            <div className="avalanche-hint">
              <strong>{t('loans.avalancheHint')}</strong>
              <ol style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                {sortedByRate.map(l => (
                  <li key={l.id}>{l.name} — {l.interest_rate_pct}%</li>
                ))}
              </ol>
            </div>
          )}

          <div className="grid-2">
            {loans.map(loan => {
              const elapsed = Math.max(0, Math.floor(
                (Date.now() - new Date(loan.start_date).getTime()) / (1000 * 60 * 60 * 24 * 30.44)
              ))
              const remaining = Math.max(0, loan.term_months - elapsed)
              const paidMonths = Math.min(elapsed, loan.term_months)
              const pctPaid = loan.term_months > 0 ? Math.min(100, (paidMonths / loan.term_months) * 100) : 0

              return (
                <div key={loan.id} className="loan-card">
                  <div className="loan-card-info">
                    <div className="loan-card-name">{loan.name}</div>
                    <div className="loan-card-meta">
                      <span>{t('loans.principal')}: {fmt(loan.principal)}</span>
                      <span>{t('loans.monthlyRate')}: <strong>{fmt(loan.monthly_rate)}</strong></span>
                      <span>{t('loans.interestRate')}: {loan.interest_rate_pct}%</span>
                      <span>{t('loans.termMonths')}: {remaining} {t('common.month')} {t('common.noData') !== 'No data available' ? '' : 'remaining'}</span>
                    </div>
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        <span className="text-muted">{t('loans.pctPaid', { pct: pctPaid.toFixed(0) })}</span>
                        <span className="text-muted">{t('loans.monthsLeft', { months: remaining })}</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${pctPaid}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="loan-card-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => openAmortization(loan)}>
                      {t('loans.amortization')}
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => openSpecialPayments(loan)}>
                      {t('loans.specialPayments')}
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => setDeleteId(loan.id)}>
                      {t('common.delete')}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {showModal && (
        <Modal title={t('loans.add')} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label className="form-label">{t('loans.name')}</label>
              <input className="form-input" value={form.name} onChange={e => f('name', e.target.value)} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('loans.principal')}</label>
                <input className="form-input" type="number" step="0.01" min="0" value={form.principal} onChange={e => f('principal', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('loans.interestRate')}</label>
                <input className="form-input" type="number" step="0.01" min="0" max="100" value={form.interest_rate_pct} onChange={e => f('interest_rate_pct', e.target.value)} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('loans.termMonths')}</label>
                <input className="form-input" type="number" min="1" value={form.term_months} onChange={e => f('term_months', e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('loans.startDate')}</label>
                <input className="form-input" type="date" value={form.start_date} onChange={e => f('start_date', e.target.value)} required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('loans.loanType')}</label>
              <select className="form-select" value={form.loan_type} onChange={e => f('loan_type', e.target.value as Loan['loan_type'])}>
                <option value="annuity">{t('loans.annuity')}</option>
                <option value="real_estate">{t('loans.realEstate')}</option>
              </select>
            </div>

            {liveMonthly > 0 && (
              <div className="card" style={{ marginBottom: '1rem', background: 'var(--color-surface-2)' }}>
                <span className="text-muted">{t('loans.monthlyRate')}: </span>
                <strong className="text-primary">{fmt(liveMonthly)}</strong>
              </div>
            )}

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

      {amortLoan && (
        <Modal title={`${t('loans.amortization')} — ${amortLoan.name}`} onClose={() => setAmortLoan(null)} size="lg">
          {amortLoading ? (
            <p className="text-muted">{t('common.loading')}</p>
          ) : (
            <>
              <div className="amort-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>{t('loans.date')}</th>
                      <th>{t('loans.payment')}</th>
                      <th>{t('loans.principalCol')}</th>
                      <th>{t('loans.interestCol')}</th>
                      <th>{t('loans.balance')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {amortPageRows.map(row => {
                      const d = new Date(amortLoan.start_date)
                      d.setMonth(d.getMonth() + row.month - 1)
                      return (
                        <tr key={row.month}>
                          <td>{row.month}</td>
                          <td>{d.toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit' })}</td>
                          <td>{fmt(row.payment)}</td>
                          <td className="text-success">{fmt(row.principal)}</td>
                          <td className="text-danger">{fmt(row.interest)}</td>
                          <td>{fmt(row.balance)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {amortTotalPages > 1 && (
                <div className="pagination">
                  <button className="btn btn-secondary btn-sm" onClick={() => setAmortPage(p => Math.max(0, p - 1))} disabled={amortPage === 0}>
                    ‹
                  </button>
                  <span className="text-muted text-sm">{amortPage + 1} / {amortTotalPages}</span>
                  <button className="btn btn-secondary btn-sm" onClick={() => setAmortPage(p => Math.min(amortTotalPages - 1, p + 1))} disabled={amortPage >= amortTotalPages - 1}>
                    ›
                  </button>
                </div>
              )}
            </>
          )}
        </Modal>
      )}

      {deleteId !== null && (
        <ConfirmModal
          onConfirm={() => handleDelete(deleteId)}
          onClose={() => setDeleteId(null)}
        />
      )}

      {spLoan && (
        <Modal title={`${t('loans.specialPayments')} — ${spLoan.name}`} onClose={() => setSpLoan(null)}>
          <form onSubmit={handleAddSp} style={{ marginBottom: '1rem' }}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{t('common.amount')}</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  min="0"
                  value={spForm.amount}
                  onChange={e => setSpForm(p => ({ ...p, amount: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('common.date')} (YYYY-MM)</label>
                <input
                  className="form-input"
                  type="month"
                  value={spForm.date}
                  onChange={e => setSpForm(p => ({ ...p, date: e.target.value }))}
                  required
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={spSaving}>
              {spSaving ? t('common.loading') : t('common.add')}
            </button>
          </form>

          {specialPayments.length === 0 ? (
            <p className="text-muted text-sm">{t('common.noData')}</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.amount')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {specialPayments.map(sp => (
                  <tr key={sp.id}>
                    <td>{sp.date}</td>
                    <td style={{ textAlign: 'right' }}>{fmt(sp.amount)}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => setDeleteSpId({ loanId: spLoan.id, spId: sp.id })}
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Modal>
      )}

      {deleteSpId !== null && (
        <ConfirmModal
          onConfirm={() => handleDeleteSp(deleteSpId.loanId, deleteSpId.spId)}
          onClose={() => setDeleteSpId(null)}
        />
      )}
    </div>
  )
}
