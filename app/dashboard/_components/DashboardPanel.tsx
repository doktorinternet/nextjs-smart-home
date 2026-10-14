'use client'

import type { ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { AutoRefreshControl, type AutoFetchState, type AutoRefreshStatusType } from './useAutoFetch'
import styles from './DashboardPanel.module.css'

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
  className = 'dashboard-module',
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
    <section className={`${styles.panel} ${className}`} aria-labelledby={headingId}>
      <div className={styles.heading} data-dashboard-panel-heading>
        <span className={`${styles.icon}${iconClassName ? ` ${iconClassName}` : ''}`} data-dashboard-panel-icon aria-hidden="true">
          <FontAwesomeIcon icon={icon} />
        </span>
        <div>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 className={styles.title} data-dashboard-panel-title id={headingId}>{title}</h2>
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
      <div className={styles.content} data-dashboard-panel-content aria-live={contentAriaLive}>
        {children}
      </div>
    </section>
  )
}