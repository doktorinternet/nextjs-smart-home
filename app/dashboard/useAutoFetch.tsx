'use client'

import { useCallback, useEffect, useState } from 'react'

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

export function AutoFetchSwitch({
  label,
  ready,
  enabled,
  onChange,
}: {
  label: string
  ready: boolean
  enabled: boolean
  onChange: (enabled: boolean) => void
}) {
  const id = `auto-fetch-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <label className="dashboard-auto-fetch" htmlFor={id}>
      <span>Auto-fetch</span>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={enabled}
        disabled={!ready}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={`Automatically fetch ${label}`}
      />
    </label>
  )
}
