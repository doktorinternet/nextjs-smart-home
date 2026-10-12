'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faRotate } from '@fortawesome/free-solid-svg-icons'
import { copy, formatCopy } from '@/app/copy'

export function useAutoFetch(storageKey: string) {
  const [ready, setReady] = useState(false)
  const [enabled, setEnabledState] = useState(true)

  useEffect(() => {
    try {
      setEnabledState(window.localStorage.getItem(storageKey) !== 'off')
    } catch {
      setEnabledState(true)
    }
    setReady(true)
  }, [storageKey])

  const setEnabled = useCallback((nextEnabled: boolean) => {
    setEnabledState(nextEnabled)
    try {
      window.localStorage.setItem(storageKey, nextEnabled ? 'on' : 'off')
    } catch {
      // Keep the setting active for this page even when storage is unavailable.
    }
  }, [storageKey])

  return { ready, enabled, setEnabled }
}

export function AutoRefreshControl({
  label,
  ready,
  enabled,
  onChange,
  onRefresh,
  refreshLabel,
  refreshing,
  refreshError = false,
  refreshDisabled = false,
}: {
  label: string
  ready: boolean
  enabled: boolean
  onChange: (enabled: boolean) => void
  onRefresh: () => void
  refreshLabel: string
  refreshing: boolean
  refreshError?: boolean
  refreshDisabled?: boolean
}) {
  const [iconState, setIconState] = useState<'idle' | 'refreshing' | 'complete'>('idle')
  const refreshStartedAt = useRef<number | null>(null)
  const id = `auto-fetch-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const actionLabel = refreshError
    ? formatCopy(copy.refresh.retry, { label: refreshLabel })
    : refreshing ? formatCopy(copy.refresh.updating, { label }) : refreshLabel

  useEffect(() => {
    let completionTimer: ReturnType<typeof setTimeout> | undefined
    let resetTimer: ReturnType<typeof setTimeout> | undefined

    if (refreshing) {
      refreshStartedAt.current = Date.now()
      setIconState('refreshing')
    } else if (refreshStartedAt.current !== null) {
      const remainingRotation = Math.max(0, 1000 - (Date.now() - refreshStartedAt.current))
      refreshStartedAt.current = null
      completionTimer = setTimeout(() => {
        setIconState('complete')
        resetTimer = setTimeout(() => setIconState('idle'), 1000)
      }, remainingRotation)
    }

    return () => {
      if (completionTimer) clearTimeout(completionTimer)
      if (resetTimer) clearTimeout(resetTimer)
    }
  }, [refreshing])

  return (
    <div className="dashboard-header-controls dashboard-refresh-control" role="group" aria-label={formatCopy(copy.refresh.updateControls, { label })}>
      <label className="dashboard-auto-fetch" htmlFor={id}>
        <span>{copy.refresh.auto}</span>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={enabled}
          disabled={!ready}
          onChange={(event) => onChange(event.target.checked)}
          aria-label={formatCopy(copy.refresh.fetchAutomatically, { label })}
        />
      </label>
      <button
        className={`dashboard-header-refresh${refreshError ? ' is-error' : ''}${iconState === 'refreshing' ? ' is-refreshing' : ''}`}
        type="button"
        onClick={onRefresh}
        disabled={refreshing || refreshDisabled}
        aria-label={actionLabel}
        title={actionLabel}
      >
        <span className={`dashboard-refresh-icons is-${iconState}`} aria-hidden="true">
          <FontAwesomeIcon className="dashboard-refresh-icon is-rotate" icon={faRotate} />
          <FontAwesomeIcon className="dashboard-refresh-icon is-check" icon={faCheck} />
        </span>
      </button>
    </div>
  )
}
