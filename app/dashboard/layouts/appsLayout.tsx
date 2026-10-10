'use client'

import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
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
    <div className={styles.viewport} aria-label="Dashboard apps">
      <section className={styles.launcher} aria-label="Home" hidden={activePanel !== undefined}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>SMART HOME</p>
          <h1>Apps</h1>
          <p className={styles.hint}>Choose a panel to open it full screen.</p>
        </header>

        <nav className={styles.appGrid} aria-label="Open a dashboard panel">
          {panels.map((panel) => (
            <button
              className={styles.appButton}
              key={panel.id}
              type="button"
              ref={(element) => {
                if (element) launcherButtons.current.set(panel.id, element)
                else launcherButtons.current.delete(panel.id)
              }}
              onClick={() => setActivePanelId(panel.id)}
              aria-label={`Open ${panel.label}`}
            >
              <span className={styles.appIcon} aria-hidden="true">{panel.icon}</span>
              <span className={styles.appLabel}>{panel.label}</span>
            </button>
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
            aria-label={`${panel.label} panel`}
            aria-hidden={!isActive}
            hidden={!isActive}
          >
            <header className={styles.panelHeader}>
              <button className={styles.homeButton} type="button" onClick={returnHome}>
                <span aria-hidden="true">&larr;</span>
                <span>Home</span>
              </button>
              <h1 className={styles.panelTitle}>{panel.label}</h1>
              <span className={styles.headerSpacer} aria-hidden="true" />
            </header>
            <div className={styles.panelContent}>{panel.content}</div>
          </section>
        )
      })}
    </div>
  )
}
