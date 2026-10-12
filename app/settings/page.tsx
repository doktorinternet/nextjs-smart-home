'use client'

import { useCallback, useEffect, useState } from 'react'
import { faArrowLeft, faCircleCheck, faCircleQuestion, faCircleXmark, faRotate } from '@fortawesome/free-solid-svg-icons'
import { faSpotify } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Link from 'next/link'
import { copy } from '@/app/copy'
import styles from './settings.module.css'

type PermissionStatus = {
  status: 'unverified' | 'complete' | 'missing'
  connected: boolean
  expectedScopes: string[]
  grantedScopes: string[]
  missingScopes: string[]
}

export default function SettingsPage() {
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
              id="spotify-settings-tab"
              aria-selected="true"
              aria-controls="spotify-settings-panel"
              aria-label={copy.settings.spotifySection}
              title={copy.settings.spotifySection}
            >
              <FontAwesomeIcon icon={faSpotify} aria-hidden="true" />
            </button>
          </nav>

          <section
            className={styles.panel}
            id="spotify-settings-panel"
            role="tabpanel"
            aria-labelledby="spotify-settings-tab"
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