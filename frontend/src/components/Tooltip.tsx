import React, { useState, useRef, useEffect } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!visible) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [visible])

  return (
    <span ref={ref} className="tooltip-wrapper">
      {children}
      <span
        className="tooltip-icon"
        onClick={() => setVisible(v => !v)}
        aria-label="Info"
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setVisible(v => !v)}
      >
        ℹ️
      </span>
      {visible && (
        <span className="tooltip-content" role="tooltip">
          {content}
        </span>
      )}
    </span>
  )
}
