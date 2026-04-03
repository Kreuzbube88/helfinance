import React from 'react'
import { useTranslation } from 'react-i18next'

interface LivePreviewProps {
  amount: number
  interval: 'monthly' | 'yearly' | 'once' | number
  type: 'income' | 'expense'
  currency: string
}

export function LivePreview({ amount, interval, type, currency }: LivePreviewProps) {
  const { t } = useTranslation()

  if (!amount || amount <= 0) return null

  const fmt = (n: number) => n.toLocaleString('de-DE', { style: 'currency', currency })

  let label: string
  let displayAmount: number | null = null

  if (interval === 'once') {
    label = t('livePreview.once')
  } else if (interval === 'monthly' || interval === 1) {
    label = t('livePreview.monthly')
    displayAmount = amount
  } else if (interval === 'yearly') {
    label = t('livePreview.monthly')
    displayAmount = amount / 12
  } else if (typeof interval === 'number' && interval > 1) {
    label = t('livePreview.reserved')
    displayAmount = amount / interval
  } else {
    label = t('livePreview.monthly')
    displayAmount = amount
  }

  return (
    <div className={`live-preview live-preview-${type}`}>
      <span className="live-preview-icon">💶</span>
      <span className="live-preview-label">{label}:</span>
      {displayAmount !== null && (
        <span className="live-preview-amount">{fmt(displayAmount)}</span>
      )}
    </div>
  )
}
