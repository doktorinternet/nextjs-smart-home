'use client'

import { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faRotate } from '@fortawesome/free-solid-svg-icons'

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
  const id = `auto-fetch-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const actionLabel = refreshError ? `Försök igen: ${refreshLabel}` : refreshing ? `Uppdaterar ${label}` : refreshLabel

  return (
    <div className="dashboard-header-controls dashboard-refresh-control" role="group" aria-label={`${label} update controls`}>
      <label className="dashboard-auto-fetch" htmlFor={id}>
        <span>Auto</span>
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={enabled}
          disabled={!ready}
          onChange={(event) => onChange(event.target.checked)}
          aria-label={`Hämta ${label} automatiskt`}
        />
      </label>
      <button
        className={`dashboard-header-refresh${refreshError ? ' is-error' : ''}`}
        type="button"
        onClick={onRefresh}
        disabled={refreshing || refreshDisabled}
        aria-label={actionLabel}
        title={actionLabel}
      >
        <FontAwesomeIcon icon={faRotate} aria-hidden="true" />
      </button>
    </div>
  )
}
