'use client'

import type { ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { AutoRefreshControl, type AutoFetchState, type AutoRefreshStatusType } from './useAutoFetch'

type DashboardPanelProps = {
  headingId: string
  icon: IconDefinition
  iconClassName?: string
  eyebrow: string
  title: string
  label: string
  autoFetch: AutoFetchState
  onRefresh: () => void
  refreshLabel: string
  refreshing: boolean
  className?: string
  headerAddon?: ReactNode
  refreshError?: boolean
  refreshDisabled?: boolean
  statusMessage?: string | null
  statusType?: AutoRefreshStatusType
  statusPosition?: 'before' | 'after' | 'above' | 'below'
  contentAriaLive?: 'off' | 'polite' | 'assertive'
  children: ReactNode
}

export default function DashboardPanel({
  headingId,
  icon,
  iconClassName,
  eyebrow,
  title,
  label,
  autoFetch,
  onRefresh,
  refreshLabel,
  refreshing,
  className = 'dashboard-module dashboard-live-card',
  headerAddon,
  refreshError,
  refreshDisabled,
  statusMessage,
  statusType,
  statusPosition,
  contentAriaLive,
  children,
}: DashboardPanelProps) {
  return (
    <section className={className} aria-labelledby={headingId}>
      <div className="dashboard-module-heading">
        <span className={`dashboard-module-icon${iconClassName ? ` ${iconClassName}` : ''}`} aria-hidden="true">
          <FontAwesomeIcon icon={icon} />
        </span>
        <div>
          <p className="dashboard-eyebrow">{eyebrow}</p>
          <h2 id={headingId}>{title}</h2>
        </div>
        {headerAddon}
        <AutoRefreshControl
          label={label}
          {...autoFetch}
          onChange={autoFetch.setEnabled}
          onRefresh={onRefresh}
          refreshLabel={refreshLabel}
          refreshing={refreshing}
          refreshError={refreshError}
          refreshDisabled={refreshDisabled}
          statusMessage={statusMessage}
          statusType={statusType}
          statusPosition={statusPosition}
        />
      </div>
      <div className="dashboard-panel-content" aria-live={contentAriaLive}>
        {children}
      </div>
    </section>
  )
}