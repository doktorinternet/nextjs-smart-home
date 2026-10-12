'use client'

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import { faArrowLeft, faCircleCheck, faCircleQuestion, faCircleXmark, faGear, faRotate } from '@fortawesome/free-solid-svg-icons'
import { faSpotify } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import { copy } from '@/app/copy'
import { layoutOptions, type LayoutMode } from '@/app/dashboard/layouts/layoutOptions'
import styles from './settings.module.css'

type PermissionStatus = {
  status: 'unverified' | 'complete' | 'missing'
  connected: boolean
  expectedScopes: string[]
  grantedScopes: string[]
  missingScopes: string[]
}

type SettingsSection = 'general' | 'spotify'

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('general')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('pages')
  const [layoutReady, setLayoutReady] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus | null>(null)
  const [checking, setChecking] = useState(true)
  const [checkError, setCheckError] = useState(false)
  const [authorizationComplete, setAuthorizationComplete] = useState(false)

  const checkPermissions = useCallback(async () => {
    setChecking(true)
    setCheckError(false)
    try {
      const response = await fetch('/api/spotify/auth/status', { cache: 'no-store' })
      if (!response.ok) throw new Error('Permission status unavailable')
      setPermissionStatus(await response.json())
    } catch {
      setCheckError(true)
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void checkPermissions()
    setAuthorizationComplete(new URLSearchParams(window.location.search).get('spotify') === 'connected')
  }, [checkPermissions])

  useEffect(() => {
    const storedMode = window.localStorage.getItem('dashboard.layout')
    if (layoutOptions.some((option) => option.id === storedMode)) setLayoutMode(storedMode as LayoutMode)
    setLayoutReady(true)
  }, [])

  useEffect(() => {
    if (layoutReady) window.localStorage.setItem('dashboard.layout', layoutMode)
  }, [layoutMode, layoutReady])

  const statusMessage = permissionStatus?.status === 'complete'
    ? copy.settings.permissionComplete
    : permissionStatus?.status === 'missing'
      ? copy.settings.permissionMissing
      : copy.settings.permissionUnverified
  const statusIcon = permissionStatus?.status === 'complete'
    ? faCircleCheck
    : permissionStatus?.status === 'missing'
      ? faCircleXmark
      : faCircleQuestion

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, section: SettingsSection) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowRight' && event.key !== 'ArrowUp' && event.key !== 'ArrowLeft') return
    event.preventDefault()
    const nextSection = section === 'general' ? 'spotify' : 'general'
    setActiveSection(nextSection)
    document.getElementById(`${nextSection}-settings-tab`)?.focus()
  }

  return (
    <main className={styles.shell}>
      <div className={styles.frame}>
        <header className={styles.header}>
          <Link className={styles.backLink} href="/dashboard">
            <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
            <span>{copy.settings.backToDashboard}</span>
          </Link>
          <h1>{copy.settings.title}</h1>
        </header>

        <div className={styles.layout}>
          <nav className={styles.navigation} aria-label={copy.settings.sections} role="tablist" aria-orientation="vertical">
            <button
              className={styles.navigationButton}
              type="button"
              role="tab"
              id="general-settings-tab"
              aria-selected={activeSection === 'general'}
              aria-controls="general-settings-panel"
              aria-label={copy.settings.generalSection}
              title={copy.settings.generalSection}
              tabIndex={activeSection === 'general' ? 0 : -1}
              onClick={() => setActiveSection('general')}
              onKeyDown={(event) => handleTabKeyDown(event, 'general')}
            >
              <FontAwesomeIcon icon={faGear} aria-hidden="true" />
            </button>
            <button
              className={styles.navigationButton}
              type="button"
              role="tab"
              id="spotify-settings-tab"
              aria-selected={activeSection === 'spotify'}
              aria-controls="spotify-settings-panel"
              aria-label={copy.settings.spotifySection}
              title={copy.settings.spotifySection}
              tabIndex={activeSection === 'spotify' ? 0 : -1}
              onClick={() => setActiveSection('spotify')}
              onKeyDown={(event) => handleTabKeyDown(event, 'spotify')}
            >
              <FontAwesomeIcon icon={faSpotify} aria-hidden="true" />
            </button>
          </nav>

          <section
            className={styles.panel}
            id="general-settings-panel"
            role="tabpanel"
            aria-labelledby="general-settings-tab"
            tabIndex={0}
            hidden={activeSection !== 'general'}
          >
            <div className={styles.dashboardLayout}>
              <div className={styles.dashboardLayoutCopy}>
                <p className={styles.eyebrow}>{copy.dashboard.title}</p>
                <h2>{copy.dashboard.layout}</h2>
              </div>
              <label className={styles.layoutPicker}>
                <span>{copy.dashboard.layout}</span>
                <select
                  aria-label={copy.dashboard.chooseLayout}
                  value={layoutMode}
                  onChange={(event) => setLayoutMode(event.target.value as LayoutMode)}
                >
                  {layoutOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section
            className={styles.panel}
            id="spotify-settings-panel"
            role="tabpanel"
            aria-labelledby="spotify-settings-tab"
            tabIndex={0}
            hidden={activeSection !== 'spotify'}
          >
            <div className={styles.panelHeader}>
              <div className={styles.spotifyMark} aria-hidden="true">
                <FontAwesomeIcon icon={faSpotify} />
              </div>
              <div className={styles.titleGroup}>
                <p className={styles.eyebrow}>{copy.settings.spotifySection}</p>
                <h2 id="spotify-settings-heading">{copy.settings.spotifyTitle}</h2>
                <p className={styles.description}>{copy.settings.spotifyDescription}</p>
              </div>
              <span className={`${styles.connection} ${permissionStatus?.connected ? styles.isConnected : ''}`}>
                <span aria-hidden="true" />
                {permissionStatus?.connected ? copy.settings.connected : copy.settings.notConnected}
              </span>
            </div>

            {authorizationComplete && (
              <p className={styles.notice} role="status">{copy.settings.authorizationComplete}</p>
            )}

            <div className={styles.statusBlock} aria-live="polite">
              <div className={`${styles.statusIcon} ${permissionStatus?.status === 'complete' ? styles.isComplete : permissionStatus?.status === 'missing' ? styles.hasMissing : ''}`} aria-hidden="true">
                <FontAwesomeIcon icon={checking ? faRotate : statusIcon} spin={checking} />
              </div>
              <div className={styles.statusCopy}>
                <strong>{checking ? copy.settings.checkingPermissions : checkError ? copy.settings.permissionCheckFailed : statusMessage}</strong>
                {permissionStatus?.status === 'missing' && !checking && (
                  <p>{copy.settings.missingPermissions}: {permissionStatus.missingScopes.join(', ')}</p>
                )}
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.secondaryButton} type="button" onClick={() => void checkPermissions()} disabled={checking}>
                <FontAwesomeIcon icon={faRotate} aria-hidden="true" spin={checking} />
                <span>{checking ? copy.settings.checkingPermissions : copy.settings.checkPermissions}</span>
              </button>
              <a className={styles.primaryButton} href="/api/spotify/auth/start">
                <FontAwesomeIcon icon={faSpotify} aria-hidden="true" />
                <span>{copy.settings.reauthorize}</span>
              </a>
            </div>

            <div className={styles.scopeSection}>
              <h3>{copy.settings.grantedPermissions}</h3>
              <ul className={styles.scopeList}>
                {(permissionStatus?.expectedScopes ?? []).map((scope) => {
                  const granted = permissionStatus?.grantedScopes.includes(scope) ?? false
                  const missing = permissionStatus?.missingScopes.includes(scope) ?? false
                  const scopeIcon = granted ? faCircleCheck : missing ? faCircleXmark : faCircleQuestion
                  return (
                    <li className={granted ? styles.scopeGranted : missing ? styles.scopeMissing : ''} key={scope}>
                      <FontAwesomeIcon icon={scopeIcon} aria-hidden="true" />
                      <code>{scope}</code>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}