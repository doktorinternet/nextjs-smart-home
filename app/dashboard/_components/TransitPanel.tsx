'use client'

import { useCallback, useState } from 'react'
import { faTrain } from '@fortawesome/free-solid-svg-icons'
import CustomTimeTable from './CustomTimeTable'
import { copy } from '@/app/copy'
import DashboardPanel from './DashboardPanel'
import { useAutoFetch } from './useAutoFetch'
import styles from './TransitPanel.module.css'

export default function TransitPanel() {
  const autoFetch = useAutoFetch('dashboard.autoFetch.tramDepartures')
  const [refreshDepartures, setRefreshDepartures] = useState<(() => void) | null>(null)
  const [fetchState, setFetchState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null })
  const handleRefreshReady = useCallback((refresh: (() => void) | null) => setRefreshDepartures(() => refresh), [])
  const handleFetchStateChange = useCallback((state: { loading: boolean; error: string | null }) => setFetchState(state), [])

  return (
    <DashboardPanel
      className={'dashboard-module ' + styles.transitPanel}
      headingId="transit-heading"
      icon={faTrain}
      eyebrow={copy.dashboard.travel}
      title={copy.dashboard.departures}
      label={copy.dashboard.transit}
      autoFetch={autoFetch}
      onRefresh={() => refreshDepartures?.()}
      refreshLabel={copy.transit.refresh}
      refreshing={fetchState.loading}
      refreshError={Boolean(fetchState.error)}
      refreshDisabled={!refreshDepartures}
    >
      <CustomTimeTable
        autoFetch={autoFetch}
        onRefreshReady={handleRefreshReady}
        onFetchStateChange={handleFetchStateChange}
      />
    </DashboardPanel>
  )
}