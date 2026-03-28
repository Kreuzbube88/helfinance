import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from './Modal'

interface ConfirmModalProps {
  title?: string
  message?: string
  confirmLabel?: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmModal({ title, message, confirmLabel, onConfirm, onClose }: ConfirmModalProps) {
  const { t } = useTranslation()

  return (
    <Modal title={title ?? t('common.confirmDeleteTitle')} onClose={onClose} size="sm">
      <p className="text-secondary" style={{ marginBottom: 'var(--space-5)' }}>
        {message ?? t('common.confirmDeleteMsg')}
      </p>
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn btn-danger" onClick={() => { onConfirm(); onClose() }}>
          {confirmLabel ?? t('common.delete')}
        </button>
      </div>
    </Modal>
  )
}
