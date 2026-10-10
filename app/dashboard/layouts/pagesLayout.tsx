'use client'

import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import styles from './pagesLayout.module.css'

type DashboardLayoutPanel = {
  id: 'transit' | 'air' | 'printer' | 'cast' | 'spotify' | 'speed'
  label: string
  icon: ReactNode
  content: ReactNode
}

type PageDefinition = {
  label: string
  panelIds: DashboardLayoutPanel['id'][]
}

const pages: PageDefinition[] = [
  { label: 'Travel', panelIds: ['transit', 'air'] },
  { label: 'Home', panelIds: ['printer', 'speed'] },
  { label: 'Media', panelIds: ['cast', 'spotify'] },
]

export default function PagesLayout({ panels }: { panels: DashboardLayoutPanel[] }) {
  const [activePage, setActivePage] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const movePage = (direction: -1 | 1) => {
    setActivePage((current) => Math.min(pages.length - 1, Math.max(0, current + direction)))
  }

  const handleTouchStart = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch' || !event.isPrimary) return
    touchStart.current = { x: event.clientX, y: event.clientY }
  }

  const handleTouchEnd = (event: PointerEvent<HTMLElement>) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || event.pointerType !== 'touch') return

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return
    movePage(deltaX < 0 ? 1 : -1)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      movePage(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      movePage(1)
    }
  }

  return (
    <div
      className={styles.viewport}
      aria-label="Dashboard pages"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handleTouchStart}
      onPointerUp={handleTouchEnd}
      onPointerCancel={() => { touchStart.current = null }}
    >
      <section className={styles.page} aria-label={`${pages[activePage].label} dashboard page`}>
        <div className={styles.panels} data-page={activePage}>
          {panels.map((panel) => {
            const isVisible = pages[activePage].panelIds.includes(panel.id)
            return (
              <div
                className={styles.panel}
                key={panel.id}
                aria-label={panel.label}
                aria-hidden={!isVisible}
                hidden={!isVisible}
                tabIndex={isVisible ? 0 : undefined}
              >
                {panel.content}
              </div>
            )
          })}
        </div>

        <nav className={styles.navigation} aria-label="Dashboard pages">
          <button
            className={styles.arrow}
            type="button"
            aria-label="Previous page"
            onClick={() => movePage(-1)}
            disabled={activePage === 0}
          >
            <span aria-hidden="true">‹</span>
          </button>
          <div className={styles.indicators} role="group" aria-label="Choose dashboard page">
            {pages.map((page, index) => (
              <button
                className={styles.indicator}
                type="button"
                key={page.label}
                aria-label={`${page.label} page, ${index + 1} of ${pages.length}`}
                aria-current={activePage === index ? 'page' : undefined}
                onClick={() => setActivePage(index)}
              >
                <span className={styles.dot} aria-hidden="true" />
              </button>
            ))}
          </div>
          <span className={styles.pageCount} aria-live="polite">{activePage + 1} / {pages.length}</span>
          <button
            className={styles.arrow}
            type="button"
            aria-label="Next page"
            onClick={() => movePage(1)}
            disabled={activePage === pages.length - 1}
          >
            <span aria-hidden="true">›</span>
          </button>
        </nav>
      </section>
    </div>
  )
}
