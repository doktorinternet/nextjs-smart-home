'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faRotate } from '@fortawesome/free-solid-svg-icons'
import { copy, formatCopy } from '@/app/copy'
import styles from './AutoRefreshControl.module.css'

export type AutoRefreshStatusType = 'info' | 'success' | 'error'
export type AutoRefreshStatusPosition = 'before' | 'after' | 'above' | 'below'

const STATUS_MESSAGE_DURATION_MS = 4000
const STATUS_MESSAGE_FADE_MS = 250

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
  statusMessage,
  statusType = 'info',
  statusPosition = 'before',
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
  statusMessage?: string | null
  statusType?: AutoRefreshStatusType
  statusPosition?: AutoRefreshStatusPosition
}) {
  const [iconState, setIconState] = useState<'idle' | 'refreshing' | 'complete'>('idle')
  const [showAutoFetchSwitch, setShowAutoFetchSwitch] = useState(false)
  const [fadingStatusKey, setFadingStatusKey] = useState<string | null>(null)
  const [dismissedStatusKey, setDismissedStatusKey] = useState<string | null>(null)
  const refreshStartedAt = useRef<number | null>(null)
  const holdTimer = useRef<number | null>(null)
  const hideSwitchTimer = useRef<number | null>(null)
  const pointerStartX = useRef(0)
  const dragEnabledState = useRef<boolean | null>(null)
  const pointerDown = useRef(false)
  const holdActivated = useRef(false)
  const suppressNextClick = useRef(false)
  const id = `auto-fetch-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const actionLabel = refreshError
    ? formatCopy(copy.refresh.retry, { label: refreshLabel })
    : refreshing ? formatCopy(copy.refresh.updating, { label }) : refreshLabel
  const statusKey = statusMessage ? JSON.stringify([statusType, statusMessage]) : null

  useEffect(() => {
    setFadingStatusKey(null)
    setDismissedStatusKey(null)
    if (!statusKey || statusType === 'error') return

    const fadeTimer = window.setTimeout(() => setFadingStatusKey(statusKey), STATUS_MESSAGE_DURATION_MS - STATUS_MESSAGE_FADE_MS)
    const dismissTimer = window.setTimeout(() => setDismissedStatusKey(statusKey), STATUS_MESSAGE_DURATION_MS)
    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(dismissTimer)
    }
  }, [statusKey, statusType])

  const status = statusMessage && statusKey !== dismissedStatusKey ? (
    <span
      key={statusKey}
      className={styles.statusMessage}
      data-status-type={statusType}
      data-fading={statusKey === fadingStatusKey ? 'true' : undefined}
      role={statusType === 'error' ? 'alert' : 'status'}
      aria-live={statusType === 'error' ? 'assertive' : 'polite'}
    >
      {statusMessage}
    </span>
  ) : null

  useEffect(() => () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    if (hideSwitchTimer.current !== null) window.clearTimeout(hideSwitchTimer.current)
  }, [])

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

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0 || !ready) return
    pointerDown.current = true
    holdActivated.current = false
    suppressNextClick.current = false
    pointerStartX.current = event.clientX
    dragEnabledState.current = enabled
    if (hideSwitchTimer.current !== null) window.clearTimeout(hideSwitchTimer.current)
    event.currentTarget.setPointerCapture(event.pointerId)
    holdTimer.current = window.setTimeout(() => {
      holdActivated.current = true
      suppressNextClick.current = true
      setShowAutoFetchSwitch(true)
    }, 450)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerDown.current || !holdActivated.current) return
    const dragDistance = event.clientX - pointerStartX.current
    if (dragDistance <= -14 && dragEnabledState.current !== false) {
      dragEnabledState.current = false
      onChange(false)
    } else if (dragDistance >= 14 && dragEnabledState.current !== true) {
      dragEnabledState.current = true
      onChange(true)
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointerDown.current) return
    pointerDown.current = false
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
    if (holdActivated.current) {
      suppressNextClick.current = true
      hideSwitchTimer.current = window.setTimeout(() => setShowAutoFetchSwitch(false), 900)
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const handlePointerCancel = () => {
    pointerDown.current = false
    suppressNextClick.current = false
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current)
    holdTimer.current = null
    setShowAutoFetchSwitch(false)
  }

  return (
    <div className={`dashboard-refresh-control ${styles.control}${status ? ` ${styles.hasStatusMessage}` : ''}${statusPosition === 'above' ? ` ${styles.statusAbove}` : statusPosition === 'below' ? ` ${styles.statusBelow}` : ''}`} role="group" aria-label={formatCopy(copy.refresh.updateControls, { label })}>
      {(statusPosition === 'before' || statusPosition === 'above') && status}
      <button
        className={`dashboard-header-refresh${enabled ? ' is-auto-enabled' : ''}${refreshError ? ' is-error' : ''}${iconState === 'refreshing' ? ' is-refreshing' : ''}`}
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onClick={() => {
          if (suppressNextClick.current) {
            suppressNextClick.current = false
            return
          }
          onRefresh()
        }}
        onKeyDown={(event) => {
          if (event.shiftKey && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            if (!event.repeat) onChange(!enabled)
          }
        }}
        disabled={refreshing || refreshDisabled}
        aria-label={actionLabel}
        aria-describedby={`${id}-instructions`}
        aria-keyshortcuts="Shift+Enter Shift+Space"
        title={`${actionLabel}. ${copy.refresh.holdToChange}`}
      >
        <span className="sr-only" id={`${id}-instructions`}>
          {enabled ? copy.refresh.autoFetchEnabled : copy.refresh.autoFetchDisabled} {copy.refresh.holdToChange} {copy.refresh.keyboardToggle}
        </span>
        <span className={`dashboard-refresh-icons is-${iconState}${showAutoFetchSwitch ? ' is-hidden' : ''}`} aria-hidden="true">
          <FontAwesomeIcon className="dashboard-refresh-icon is-rotate" icon={faRotate} />
          <FontAwesomeIcon className="dashboard-refresh-icon is-check" icon={faCheck} />
        </span>
        <span className={`dashboard-auto-fetch-reveal${showAutoFetchSwitch ? ' is-visible' : ''}`} aria-hidden="true">
          <span className={`dashboard-auto-fetch-track${enabled ? ' is-enabled' : ''}`}>
            <span className="dashboard-auto-fetch-thumb" />
          </span>
        </span>
      </button>
      {(statusPosition === 'after' || statusPosition === 'below') && status}
    </div>
  )
}
