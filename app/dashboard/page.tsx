'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGauge, faGear, faMusic, faPrint, faTrain, faVolumeHigh, faWind } from '@fortawesome/free-solid-svg-icons'
import Link from 'next/link'
import CastPanel from './CastPanel'
import SpotifyPanel from './SpotifyPanel'
import ElectroluxPanel from './ElectroluxPanel'
import PrinterPanel from './PrinterPanel'
import SpeedPanel from './SpeedPanel'
import TransitPanel from './TransitPanel'
import { copy } from '@/app/copy'
import PagesLayout from './layouts/pagesLayout'
import AppsLayout from './layouts/appsLayout'
import TabsLayout from './layouts/tabsLayout'
import ExpandableLayout from './layouts/expandableLayout'
import WidgetsLayout from './layouts/widgetsLayout'
import { layoutOptions, type LayoutMode } from './layouts/layoutOptions'

type DashboardPanel = {
  id: 'transit' | 'air' | 'printer' | 'cast' | 'spotify' | 'speed'
  label: string
  icon: ReactNode
  content: ReactNode
}

export default function Page() {
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('pages')
  const [layoutReady, setLayoutReady] = useState(false)

  useEffect(() => {
    const storedMode = window.localStorage.getItem('dashboard.layout')
    if (layoutOptions.some((option) => option.id === storedMode)) setLayoutMode(storedMode as LayoutMode)
    setLayoutReady(true)
  }, [])

  useEffect(() => {
    if (layoutReady) window.localStorage.setItem('dashboard.layout', layoutMode)
  }, [layoutMode, layoutReady])

  const panels: DashboardPanel[] = [
    {
      id: 'transit', label: copy.dashboard.departures,
      icon: <FontAwesomeIcon icon={faTrain} />,
      content: <TransitPanel />,
    },
    { id: 'air', label: copy.electrolux.title, icon: <FontAwesomeIcon icon={faWind} />, content: <ElectroluxPanel /> },
    { id: 'printer', label: copy.printer.title, icon: <FontAwesomeIcon icon={faPrint} />, content: <PrinterPanel /> },
    { id: 'cast', label: copy.cast.title, icon: <FontAwesomeIcon icon={faVolumeHigh} />, content: <CastPanel /> },
    { id: 'spotify', label: copy.spotify.title, icon: <FontAwesomeIcon icon={faMusic} />, content: <SpotifyPanel /> },
    { id: 'speed', label: copy.speed.title, icon: <FontAwesomeIcon icon={faGauge} />, content: <SpeedPanel /> },
  ]

  const selectedLayout = {
    widgets: <WidgetsLayout panels={panels} />,
    pages: <PagesLayout panels={panels} />,
    apps: <AppsLayout panels={panels} />,
    tabs: <TabsLayout panels={panels} />,
    expandable: <ExpandableLayout panels={panels} />,
  }[layoutMode]

  return (
    <main className="dashboard-shell">
      <div className="dashboard-frame">
        <header className="dashboard-header">
          <div className="dashboard-brand">
            <span className="dashboard-brand-mark" aria-hidden="true">H</span>
            <div>
              <h1>{copy.dashboard.title}</h1>
            </div>
          </div>
          <Link className="dashboard-settings-link" href="/settings" aria-label={copy.dashboard.settings} title={copy.dashboard.settings}>
            <FontAwesomeIcon icon={faGear} aria-hidden="true" />
          </Link>
        </header>

        <div className="dashboard-layout-stage" aria-live="off">{selectedLayout}</div>
      </div>
    </main>
  )
}
