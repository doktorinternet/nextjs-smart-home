'use client'

import { useCallback, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrain } from '@fortawesome/free-solid-svg-icons'
import CustomTimeTable from '@/app/components/TimeTable/CustomTimeTable'
import { copy } from '@/app/copy'
import { AutoRefreshControl, useAutoFetch } from './useAutoFetch'
import styles from './TransitPanel.module.css'

export default function TransitPanel() {
  const autoFetch = useAutoFetch('dashboard.autoFetch.tramDepartures')
  const [refreshDepartures, setRefreshDepartures] = useState<(() => void) | null>(null)
  const [fetchState, setFetchState] = useState<{ loading: boolean; error: string | null }>({ loading: false, error: null })
  const handleRefreshReady = useCallback((refresh: (() => void) | null) => setRefreshDepartures(() => refresh), [])
  const handleFetchStateChange = useCallback((state: { loading: boolean; error: string | null }) => setFetchState(state), [])

  return (
    <section className={'dashboard-module ' + styles.transitPanel} aria-labelledby="transit-heading">
      <div className="dashboard-module-heading">
        <span className="dashboard-module-icon" aria-hidden="true"><FontAwesomeIcon icon={faTrain} /></span>
        <div>
          <p className="dashboard-eyebrow">{copy.dashboard.travel}</p>
          <h2 id="transit-heading">{copy.dashboard.departures}</h2>
        </div>
        <AutoRefreshControl
          label={copy.dashboard.transit}
          {...autoFetch}
          onChange={autoFetch.setEnabled}
          onRefresh={() => refreshDepartures?.()}
          refreshLabel={copy.transit.refresh}
          refreshing={fetchState.loading}
          refreshError={Boolean(fetchState.error)}
          refreshDisabled={!refreshDepartures}
        />
      </div>
      <div className="dashboard-panel-content">
        <CustomTimeTable
          autoFetch={autoFetch}
          onRefreshReady={handleRefreshReady}
          onFetchStateChange={handleFetchStateChange}
        />
      </div>
    </section>
  )
}