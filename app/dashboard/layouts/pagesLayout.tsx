'use client'

import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { copy, formatCopy } from '@/app/copy'
import { DashboardPanelVisibilityProvider } from '../DashboardPanelVisibility'
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
  { label: copy.dashboard.pageNames.travel, panelIds: ['transit', 'spotify'] },
  { label: copy.dashboard.pageNames.environment, panelIds: ['printer', 'air'] },
  { label: copy.dashboard.pageNames.home, panelIds: ['speed', 'cast'] },
]

export default function PagesLayout({ panels }: { panels: DashboardLayoutPanel[] }) {
  const [pageState, setPageState] = useState({ index: 0, direction: 1 })
  const activePage = pageState.index
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const selectPage = (index: number) => {
    setPageState((current) => {
      const nextIndex = Math.min(pages.length - 1, Math.max(0, index))
      return { index: nextIndex, direction: nextIndex >= current.index ? 1 : -1 }
    })
  }

  const movePage = (direction: -1 | 1) => {
    selectPage(activePage + direction)
  }

  const handleTouchStart = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== 'touch' || !event.isPrimary) return
    if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea, summary, [contenteditable="true"], [role="button"], [role="slider"], [role="spinbutton"], [role="scrollbar"], [data-page-swipe-ignore]')) return
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
      aria-label={copy.dashboard.layoutText.dashboardPages}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onPointerDown={handleTouchStart}
      onPointerUp={handleTouchEnd}
      onPointerCancel={() => { touchStart.current = null }}
    >
      <section className={styles.page} aria-label={formatCopy(copy.dashboard.layoutText.page, { panel: pages[activePage].label })}>
        <div className={styles.panels} data-page={activePage} data-direction={pageState.direction > 0 ? 'forward' : 'backward'}>
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
                <DashboardPanelVisibilityProvider visible={isVisible}>{panel.content}</DashboardPanelVisibilityProvider>
              </div>
            )
          })}
        </div>

        <nav className={styles.navigation} aria-label={copy.dashboard.layoutText.dashboardPages}>
          <button
            className={styles.arrow}
            type="button"
            aria-label={copy.dashboard.layoutText.previousPage}
            onClick={() => movePage(-1)}
            disabled={activePage === 0}
          >
            <FontAwesomeIcon icon={faChevronLeft} aria-hidden="true" />
          </button>
          <div className={styles.indicators} role="group" aria-label={copy.dashboard.layoutText.choosePage}>
            {pages.map((page, index) => (
              <button
                className={styles.indicator}
                type="button"
                key={page.label}
                aria-label={formatCopy(copy.dashboard.layoutText.pageCount, { page: page.label, current: index + 1, total: pages.length })}
                aria-current={activePage === index ? 'page' : undefined}
                onClick={() => selectPage(index)}
              >
                <span className={styles.dot} aria-hidden="true" />
              </button>
            ))}
          </div>
          <span className={styles.pageCount} aria-live="polite">{activePage + 1} / {pages.length}</span>
          <button
            className={styles.arrow}
            type="button"
            aria-label={copy.dashboard.layoutText.nextPage}
            onClick={() => movePage(1)}
            disabled={activePage === pages.length - 1}
          >
            <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
          </button>
        </nav>
      </section>
    </div>
  )
}
