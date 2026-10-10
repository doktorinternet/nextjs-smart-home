'use client'

import { useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import styles from './widgetsLayout.module.css'

type DashboardLayoutPanel = {
  id: 'transit' | 'air' | 'printer' | 'cast' | 'spotify' | 'speed'
  label: string
  icon: ReactNode
  content: ReactNode
}

type WidgetsZone = {
  id: string
  label: string
  panelIds: DashboardLayoutPanel['id'][]
  size: 'feature' | 'standard'
  rowWeight: number
}

export const widgetsLayoutConfig: WidgetsZone[] = [
  { id: 'travel', label: 'Travel', panelIds: ['transit', 'air'], size: 'feature', rowWeight: .655 },
  { id: 'home', label: 'Home', panelIds: ['printer', 'speed'], size: 'standard', rowWeight: 1 },
  { id: 'media', label: 'Media', panelIds: ['spotify', 'cast'], size: 'standard', rowWeight: 1 },
]

export default function WidgetsLayout({ panels }: { panels: DashboardLayoutPanel[] }) {
  const [activePages, setActivePages] = useState<Record<string, number>>({})
  const touchStarts = useRef<Record<string, { x: number; y: number } | null>>({})
  const featureWeight = widgetsLayoutConfig.find((zone) => zone.size === 'feature')?.rowWeight ?? 1
  const standardWeight = widgetsLayoutConfig.find((zone) => zone.size === 'standard')?.rowWeight ?? 1

  function selectPage(zoneId: string, index: number) {
    setActivePages((current) => ({ ...current, [zoneId]: index }))
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>, zoneId: string) {
    if (event.pointerType !== 'touch' || !event.isPrimary) return
    if ((event.target as HTMLElement).closest('button, a, input, select, textarea')) return
    touchStarts.current[zoneId] = { x: event.clientX, y: event.clientY }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>, zone: WidgetsZone, currentIndex: number) {
    const start = touchStarts.current[zone.id]
    touchStarts.current[zone.id] = null
    if (!start || event.pointerType !== 'touch') return

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaX) < 44 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return
    selectPage(zone.id, Math.min(zone.panelIds.length - 1, Math.max(0, currentIndex + (deltaX < 0 ? 1 : -1))))
  }

  return (
    <div
      className={styles.viewport}
      style={{ '--feature-weight': `${featureWeight}fr`, '--standard-weight': `${standardWeight}fr` } as CSSProperties}
      aria-label="Dashboard widgets"
    >
      {widgetsLayoutConfig.map((zone) => {
        const zonePanels = zone.panelIds
          .map((panelId) => panels.find((panel) => panel.id === panelId))
          .filter((panel): panel is DashboardLayoutPanel => panel !== undefined)
        const activeIndex = Math.min(activePages[zone.id] ?? 0, Math.max(0, zonePanels.length - 1))

        return (
          <section className={styles.zone} data-size={zone.size} key={zone.id} aria-label={`${zone.label} widgets`}>
            <header className={styles.zoneHeader}>
              <h2 className={styles.zoneTitle}>{zone.label}</h2>
              <div className={styles.controls}>
                <button
                  className={styles.arrow}
                  type="button"
                  aria-label={`Previous ${zone.label} widget`}
                  onClick={() => selectPage(zone.id, Math.max(0, activeIndex - 1))}
                  disabled={activeIndex === 0 || zonePanels.length < 2}
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <span className={styles.pageCount} aria-live="polite">{activeIndex + 1} / {zonePanels.length}</span>
                <button
                  className={styles.arrow}
                  type="button"
                  aria-label={`Next ${zone.label} widget`}
                  onClick={() => selectPage(zone.id, Math.min(zonePanels.length - 1, activeIndex + 1))}
                  disabled={activeIndex >= zonePanels.length - 1 || zonePanels.length < 2}
                >
                  <span aria-hidden="true">›</span>
                </button>
              </div>
            </header>

            <div
              className={styles.stage}
              onPointerDown={(event) => handlePointerDown(event, zone.id)}
              onPointerUp={(event) => handlePointerUp(event, zone, activeIndex)}
              onPointerCancel={() => { touchStarts.current[zone.id] = null }}
            >
              {zonePanels.map((panel, index) => (
                <div
                  className={styles.panel}
                  key={panel.id}
                  aria-label={panel.label}
                  aria-hidden={index !== activeIndex}
                  hidden={index !== activeIndex}
                  tabIndex={index === activeIndex ? 0 : undefined}
                >
                  {panel.content}
                </div>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
