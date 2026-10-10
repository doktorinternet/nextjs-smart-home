'use client'

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import styles from './tabsLayout.module.css'

type DashboardLayoutPanel = {
  id: 'transit' | 'air' | 'printer' | 'cast' | 'spotify' | 'speed'
  label: string
  icon: ReactNode
  content: ReactNode
}

type TabsLayoutProps = { panels: DashboardLayoutPanel[] }

export default function TabsLayout({ panels }: TabsLayoutProps) {
  const id = useId()
  const [selectedId, setSelectedId] = useState<DashboardLayoutPanel['id'] | null>(panels[0]?.id ?? null)
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([])
  const activeId = panels.some((panel) => panel.id === selectedId) ? selectedId : panels[0]?.id ?? null

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % panels.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + panels.length) % panels.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = panels.length - 1
    if (nextIndex === null) return

    event.preventDefault()
    const nextPanel = panels[nextIndex]
    if (!nextPanel) return
    setSelectedId(nextPanel.id)
    tabsRef.current[nextIndex]?.focus()
  }

  return (
    <section className={styles.layout} aria-label="Dashboard panels">
      <div className={styles.tabList} role="tablist" aria-label="Dashboard panels">
        {panels.map((panel, index) => {
          const selected = panel.id === activeId
          const tabId = `${id}-tab-${panel.id}`
          return (
            <button
              key={panel.id}
              ref={(element) => { tabsRef.current[index] = element }}
              className={styles.tab}
              id={tabId}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${id}-panel-${panel.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setSelectedId(panel.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              <span className={styles.icon} aria-hidden="true">{panel.icon}</span>
              <span className={styles.label}>{panel.label}</span>
            </button>
          )
        })}
      </div>

      <div className={styles.panels}>
        {panels.map((panel) => {
          const selected = panel.id === activeId
          return (
            <section
              key={panel.id}
              className={styles.panel}
              id={`${id}-panel-${panel.id}`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-${panel.id}`}
              hidden={!selected}
              tabIndex={0}
            >
              {panel.content}
            </section>
          )
        })}
      </div>
    </section>
  )
}
