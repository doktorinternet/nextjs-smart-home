'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
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
  const [hiddenIds, setHiddenIds] = useState<DashboardLayoutPanel['id'][]>(() =>
    panels.filter((panel) => !['transit', 'air'].includes(panel.id)).map((panel) => panel.id),
  )
  const shouldReduceMotion = useReducedMotion()

  function togglePanel(id: DashboardLayoutPanel['id']) {
    if (selectedIds.includes(id)) {
      if (selectedIds.length === 1) return
      setSelectedIds((current) => current.filter((selectedId) => selectedId !== id))
      return
    }

    setHiddenIds((current) => current.filter((hiddenId) => hiddenId !== id))
    setSelectedIds((current) => [...current, id])
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
            <motion.div
              className={styles.panel}
              key={panel.id}
              layout
              animate={{ opacity: selected ? 1 : 0 }}
              transition={shouldReduceMotion
                ? { duration: 0 }
                : { layout: { type: 'spring', stiffness: 320, damping: 34 }, opacity: { duration: .2 } }}
              data-selected={selected}
              aria-label={panel.label}
              aria-hidden={!selected}
              hidden={!selected && hiddenIds.includes(panel.id)}
              onAnimationComplete={() => {
                if (!selected) {
                  setHiddenIds((current) => current.includes(panel.id) ? current : [...current, panel.id])
                }
              }}
            >
              <div className={styles.panelContent}>{panel.content}</div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
