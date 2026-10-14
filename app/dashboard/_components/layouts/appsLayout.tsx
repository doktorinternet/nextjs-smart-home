'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { copy, formatCopy } from '@/app/copy'
import RectangularButton from '@/app/components/ui/RectangularButton'
import { DashboardPanelVisibilityProvider } from '../DashboardPanelVisibility'
import styles from './appsLayout.module.css'

type DashboardLayoutPanel = {
  id: 'transit' | 'air' | 'printer' | 'cast' | 'spotify' | 'speed'
  label: string
  icon: ReactNode
  content: ReactNode
}

export default function AppsLayout({ panels }: { panels: DashboardLayoutPanel[] }) {
  const instanceId = useId()
  const [activePanelId, setActivePanelId] = useState<DashboardLayoutPanel['id'] | null>(null)
  const launcherButtons = useRef(new Map<DashboardLayoutPanel['id'], HTMLButtonElement>())
  const pendingFocusId = useRef<DashboardLayoutPanel['id'] | null>(null)
  const activePanel = panels.find((panel) => panel.id === activePanelId)

  useEffect(() => {
    if (activePanelId !== null && !panels.some((panel) => panel.id === activePanelId)) setActivePanelId(null)
  }, [activePanelId, panels])

  useEffect(() => {
    if (activePanelId !== null || pendingFocusId.current === null) return
    launcherButtons.current.get(pendingFocusId.current)?.focus()
    pendingFocusId.current = null
  }, [activePanelId])

  useEffect(() => {
    if (activePanelId === null) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        pendingFocusId.current = activePanelId
        setActivePanelId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePanelId])

  const returnHome = () => {
    pendingFocusId.current = activePanelId
    setActivePanelId(null)
  }

  return (
    <div className={styles.viewport} aria-label={copy.dashboard.layoutText.dashboardApps}>
      <section className={styles.launcher} aria-label={copy.dashboard.layoutText.home} hidden={activePanel !== undefined}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>{copy.dashboard.layoutText.appsEyebrow}</p>
          <h1>{copy.dashboard.layoutText.appsTitle}</h1>
          <p className={styles.hint}>{copy.dashboard.layoutText.appsHint}</p>
        </header>

        <nav className={styles.appGrid} aria-label={copy.dashboard.layoutText.choosePanels}>
          {panels.map((panel) => (
            <RectangularButton
              className={styles.appButton}
              key={panel.id}
              type="button"
              ref={(element) => {
                if (element) launcherButtons.current.set(panel.id, element)
                else launcherButtons.current.delete(panel.id)
              }}
              onClick={() => setActivePanelId(panel.id)}
              aria-label={formatCopy(copy.dashboard.layoutText.openPanel, { panel: panel.label })}
            >
              <span className={styles.appIcon} aria-hidden="true">{panel.icon}</span>
              <span className={styles.appLabel}>{panel.label}</span>
            </RectangularButton>
          ))}
        </nav>
      </section>

      {panels.map((panel) => {
        const isActive = panel.id === activePanelId
        const panelId = `${instanceId}-panel-${panel.id}`

        return (
          <section
            className={styles.panelView}
            key={panel.id}
            id={panelId}
            aria-label={formatCopy(copy.dashboard.layoutText.panel, { panel: panel.label })}
            aria-hidden={!isActive}
            hidden={!isActive}
          >
            <header className={styles.panelHeader}>
              <RectangularButton className={styles.homeButton} type="button" onClick={returnHome}>
                <span aria-hidden="true">&larr;</span>
                <span>{copy.dashboard.layoutText.home}</span>
              </RectangularButton>
              <h1 className={styles.panelTitle}>{panel.label}</h1>
              <span className={styles.headerSpacer} aria-hidden="true" />
            </header>
            <div className={styles.panelContent}>
              <DashboardPanelVisibilityProvider visible={isActive}>{panel.content}</DashboardPanelVisibilityProvider>
            </div>
          </section>
        )
      })}
    </div>
  )
}
