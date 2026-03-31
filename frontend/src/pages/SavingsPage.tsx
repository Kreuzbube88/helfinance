import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import {
  getSavingsSummary,
  setSavingsInitialBalance,
  createSavingsTransaction,
  deleteSavingsTransaction,
  getExpenses,
  getCategories
} from '../api'
import type { SavingsSummary, SavingsTransaction, Expense, Category } from '../types'
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { Modal } from '../components/Modal'
import { ConfirmModal } from '../components/ConfirmModal'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

function getMonthShort(monthIndex: number, lang: string): string {
  return new Intl.DateTimeFormat(lang, { month: 'short' }).format(new Date(2000, monthIndex, 1))
}

function intervalLabel(months: number, t: (key: string) => string): string {
  if (months === 1) return t('income.monthly')
  if (months === 3) return t('expenses.quarterly')
  if (months === 6) return t('expenses.semiannual')
  if (months === 12) return t('income.yearly')
  return `${months}m`
}

export function SavingsPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()

  const currency = user?.currency || 'EUR'
  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  const [summary, setSummary] = useState<SavingsSummary | null>(null)
  const [irregularExpenses, setIrregularExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  // Initial balance form
  const [initBalance, setInitBalance] = useState('')
  const [initDate, setInitDate] = useState('')
  const [savingInit, setSavingInit] = useState(false)

  // Adjustment modal
  const [showAdjModal, setShowAdjModal] = useState(false)
  const [adjAmount, setAdjAmount] = useState('')
  const [adjDate, setAdjDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [adjDesc, setAdjDesc] = useState('')
  const [savingAdj, setSavingAdj] = useState(false)

  // Delete confirm
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sum, expenses, cats] = await Promise.all([
        getSavingsSummary(),
        getExpenses(),
        getCategories('expense')
      ])
      setSummary(sum)
      setInitBalance(String(sum.initial_balance))
      setInitDate(sum.initial_balance_date ?? '')

      const savingsCat = cats.find((c: Category) => c.name === 'Savings')
      const irregular = expenses.filter(
        (e: Expense) =>
          e.interval_months > 1 &&
          (savingsCat ? e.category_id !== savingsCat.id : true)
      )
      setIrregularExpenses(irregular)
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSaveInit = async () => {
    const val = parseFloat(initBalance.replace(',', '.'))
    if (isNaN(val)) return
    setSavingInit(true)
    try {
      await setSavingsInitialBalance({
        initial_balance: val,
        initial_balance_date: initDate || undefined
      })
      showToast(t('common.success'), 'success')
      await load()
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setSavingInit(false)
    }
  }

  const handleAddAdj = async () => {
    const val = parseFloat(adjAmount.replace(',', '.'))
    if (isNaN(val) || !adjDate) return
    setSavingAdj(true)
    try {
      await createSavingsTransaction({ amount: val, date: adjDate, description: adjDesc || undefined })
      showToast(t('common.success'), 'success')
      setShowAdjModal(false)
      setAdjAmount('')
      setAdjDesc('')
      setAdjDate(new Date().toISOString().slice(0, 10))
      await load()
    } catch {
      showToast(t('common.error'), 'error')
    } finally {
      setSavingAdj(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteSavingsTransaction(id)
      showToast(t('common.success'), 'success')
      await load()
    } catch {
      showToast(t('common.error'), 'error')
    }
  }

  const totalMonthlyReserve = irregularExpenses.reduce(
    (sum, e) => sum + e.amount / e.interval_months,
    0
  )

  const chartData = summary
    ? {
        labels: summary.projection.slice(0, 6).map(p =>
          `${getMonthShort(p.month - 1, i18n.language)} ${p.year}`
        ),
        datasets: [
          {
            label: t('savings.currentBalance'),
            data: summary.projection.slice(0, 6).map(p => p.balance),
            backgroundColor: 'rgba(16, 185, 129, 0.7)'
          }
        ]
      }
    : null

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx: { parsed: { y: number | null } }) => fmt(ctx.parsed.y ?? 0) } }
    },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.1)' } },
      y: {
        ticks: { color: '#94a3b8', callback: (v: number | string) => fmt(Number(v)) },
        grid: { color: 'rgba(148,163,184,0.1)' }
      }
    }
  }

  if (loading) {
    return <div className="page"><p className="text-muted">{t('common.loading')}</p></div>
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">{t('savings.title')}</h1>
      </div>

      {/* Startguthaben setzen */}
      <div className="card">
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('savings.initialBalance')}</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              value={initBalance}
              onChange={e => setInitBalance(e.target.value)}
              style={{ width: '160px' }}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('savings.initialBalanceDate')}</label>
            <input
              className="form-input"
              type="date"
              value={initDate}
              onChange={e => setInitDate(e.target.value)}
              style={{ width: '160px' }}
            />
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSaveInit}
            disabled={savingInit}
          >
            {t('common.save')}
          </button>
        </div>
      </div>

      {/* Kontostand-Übersicht */}
      {summary && (
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
              <span>{t('savings.initialBalance')}</span>
              <span>{fmt(summary.initial_balance)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
              <span>
                {t('savings.contributions')}
                {summary.initial_balance_date && summary.monthly_contribution > 0 && (
                  <span style={{ fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                    ({fmt(summary.monthly_contribution)} / {t('income.monthly').toLowerCase()})
                  </span>
                )}
              </span>
              <span className="text-success">+{fmt(summary.total_contributions)}</span>
            </div>
            {summary.adjustments_sum !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                <span>{t('savings.adjustments')}</span>
                <span className={summary.adjustments_sum >= 0 ? 'text-success' : 'text-danger'}>
                  {summary.adjustments_sum >= 0 ? '+' : ''}{fmt(summary.adjustments_sum)}
                </span>
              </div>
            )}
            <div style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: '0.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontWeight: 700 }}>{t('savings.currentBalance')}</span>
              <span
                className={summary.current_balance >= 0 ? 'text-success' : 'text-danger'}
                style={{ fontSize: '1.5rem', fontWeight: 700 }}
              >
                {fmt(summary.current_balance)}
              </span>
            </div>
          </div>

          {summary.sparen_expenses.length === 0 ? (
            <p className="text-muted" style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
              {t('savings.noSparenExpenses')}
            </p>
          ) : (
            <div style={{ marginTop: '1rem' }}>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>
                {t('savings.contributions')}:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {summary.sparen_expenses.map(e => (
                  <span key={e.id} className="badge badge-info">
                    {e.name} · {fmt(e.amount)} / {intervalLabel(e.interval_months, t)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Prognose */}
      {chartData && summary && summary.monthly_contribution > 0 && (
        <div className="card">
          <h3 className="card-title">{t('savings.projection')}</h3>
          <div style={{ height: '220px' }}>
            <Bar data={chartData} options={barOptions} />
          </div>
        </div>
      )}

      {/* Entnahmen & Korrekturen */}
      <div className="card">
        <div className="section-header">
          <h3 className="card-title">{t('savings.transactions')}</h3>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAdjModal(true)}>
            + {t('savings.addAdjustment')}
          </button>
        </div>
        {!summary || summary.transactions.length === 0 ? (
          <p className="text-muted">{t('common.noData')}</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('common.description')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.amount')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {summary.transactions.map((tx: SavingsTransaction) => (
                  <tr key={tx.id}>
                    <td>{tx.date}</td>
                    <td>{tx.description ?? '—'}</td>
                    <td
                      style={{ textAlign: 'right' }}
                      className={tx.amount >= 0 ? 'text-success' : 'text-danger'}
                    >
                      {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm text-danger"
                        onClick={() => setDeleteId(tx.id)}
                      >
                        {t('common.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Rücklagen für unregelmäßige Kosten */}
      <div className="card">
        <h3 className="card-title">{t('savings.irregularCosts')}</h3>
        {irregularExpenses.length === 0 ? (
          <p className="text-muted">{t('savings.noIrregularExpenses')}</p>
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{t('expenses.name')}</th>
                    <th style={{ textAlign: 'right' }}>{t('expenses.amount')}</th>
                    <th>{t('expenses.interval')}</th>
                    <th style={{ textAlign: 'right' }}>{t('savings.monthlyReserve')}</th>
                  </tr>
                </thead>
                <tbody>
                  {irregularExpenses.map(e => (
                    <tr key={e.id}>
                      <td>{e.name}</td>
                      <td style={{ textAlign: 'right' }}>{fmt(e.amount)}</td>
                      <td>
                        <span className="badge badge-info">{intervalLabel(e.interval_months, t)}</span>
                      </td>
                      <td style={{ textAlign: 'right' }} className="text-warning">
                        {fmt(e.amount / e.interval_months)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '0.75rem',
              fontWeight: 700,
              borderTop: '1px solid var(--color-border)',
              paddingTop: '0.75rem'
            }}>
              <span>{t('savings.totalReserveNeeded')}</span>
              <span className="text-warning">{fmt(totalMonthlyReserve)}</span>
            </div>
          </>
        )}
      </div>

      {/* Modal: Entnahme / Korrektur */}
      {showAdjModal && (
        <Modal title={t('savings.addAdjustment')} onClose={() => setShowAdjModal(false)} size="sm">
          <div className="form-group">
            <label className="form-label">{t('common.amount')}</label>
            <input
              className="form-input"
              type="number"
              step="0.01"
              placeholder="-500"
              value={adjAmount}
              onChange={e => setAdjAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('common.date')}</label>
            <input
              className="form-input"
              type="date"
              value={adjDate}
              onChange={e => setAdjDate(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">{t('common.description')}</label>
            <input
              className="form-input"
              type="text"
              value={adjDesc}
              onChange={e => setAdjDesc(e.target.value)}
            />
          </div>
          <div className="modal-actions">
            <button className="btn btn-secondary" onClick={() => setShowAdjModal(false)}>
              {t('common.cancel')}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAddAdj}
              disabled={savingAdj || !adjAmount || !adjDate}
            >
              {t('common.save')}
            </button>
          </div>
        </Modal>
      )}

      {deleteId !== null && (
        <ConfirmModal
          onConfirm={() => { handleDelete(deleteId); setDeleteId(null) }}
          onClose={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
