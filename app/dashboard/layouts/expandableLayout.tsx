'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import styles from './expandableLayout.module.css'

type DashboardLayoutPanel = {
  id: 'transit' | 'air' | 'printer' | 'cast' | 'spotify' | 'speed'
  label: string
  icon: ReactNode
  content: ReactNode
}

type ExpandableLayoutProps = {
  panels: DashboardLayoutPanel[]
}

export default function ExpandableLayout({ panels }: ExpandableLayoutProps) {
  const [selectedIds, setSelectedIds] = useState<DashboardLayoutPanel['id'][]>(['transit', 'air'])

  function togglePanel(id: DashboardLayoutPanel['id']) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        // Keep one panel visible so the main area never becomes an empty shell.
        return current.length === 1 ? current : current.filter((selectedId) => selectedId !== id)
      }
      return [...current, id]
    })
  }

  return (
    <div className={styles.layout}>
      <nav className={styles.controls} aria-label="Choose dashboard panels">
        <span className={styles.controlsLabel}>Panels</span>
        <div className={styles.choices}>
          {panels.map((panel) => {
            const selected = selectedIds.includes(panel.id)
            return (
              <button
                key={panel.id}
                type="button"
                className={`${styles.choice}${selected ? ` ${styles.selected}` : ''}`}
                aria-pressed={selected}
                onClick={() => togglePanel(panel.id)}
              >
                <span className={styles.choiceIcon} aria-hidden="true">{panel.icon}</span>
                <span>{panel.label}</span>
              </button>
            )
          })}
        </div>
      </nav>

      <div className={styles.grid} aria-label="Dashboard panels">
        {panels.map((panel) => {
          const selected = selectedIds.includes(panel.id)
          return (
            <div
              className={styles.panel}
              key={panel.id}
              aria-label={panel.label}
              aria-hidden={!selected}
              hidden={!selected}
            >
              <div className={styles.panelContent}>{panel.content}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
