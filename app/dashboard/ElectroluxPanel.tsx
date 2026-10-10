'use client';

import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWind } from '@fortawesome/free-solid-svg-icons';
import { AutoRefreshControl, useAutoFetch } from './useAutoFetch';

type Status = { appliance: string; updatedAt: string; metrics: Array<{ label: string; value: string }> };

function isStatus(value: unknown): value is Status {
  if (typeof value !== 'object' || value === null) return false;
  const status = value as Record<string, unknown>;
  return typeof status.appliance === 'string' && typeof status.updatedAt === 'string'
    && Array.isArray(status.metrics)
    && status.metrics.every((metric) => typeof metric === 'object' && metric !== null
      && typeof (metric as Record<string, unknown>).label === 'string'
      && typeof (metric as Record<string, unknown>).value === 'string');
}

function apiErrorMessage(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const error = (value as Record<string, unknown>).error;
  return typeof error === 'string' && error.trim() ? error : null;
}

export default function ElectroluxPanel() {
  const autoFetch = useAutoFetch('dashboard.autoFetch.electrolux');
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/electrolux/status', { cache: 'no-store' });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(apiErrorMessage(result) ?? `Electrolux-tjänsten svarade med HTTP ${response.status}.`);
        return;
      }
      if (!isStatus(result)) {
        setError('Electrolux returnerade ogiltig statusinformation.');
        return;
      }
      setStatus(result);
      setError(null);
    } catch {
      setError('Det gick inte att nå den lokala Electrolux-tjänsten.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!autoFetch.ready || !autoFetch.enabled) return;
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(interval);
  }, [autoFetch.ready, autoFetch.enabled, refresh]);

  return (
    <section className="dashboard-module dashboard-live-card" aria-labelledby="air-quality-heading">
      <div className="dashboard-module-heading">
        <span className="dashboard-module-icon" aria-hidden="true"><FontAwesomeIcon icon={faWind} /></span>
        <div>
          <p className="dashboard-eyebrow">Inomhus</p>
          <h2 id="air-quality-heading">Luftkvalitet</h2>
        </div>
        <span className="dashboard-source">Pure A9</span>
        <AutoRefreshControl
          label="Electrolux-luftrenare"
          {...autoFetch}
          onChange={autoFetch.setEnabled}
          onRefresh={() => void refresh()}
          refreshLabel="Uppdatera status för Electrolux-luftrenaren"
          refreshing={loading}
        />
      </div>
      <div className="dashboard-live-content" aria-live="polite">
        {loading && !status ? <p>Ansluter till luftrenaren…</p> : null}
        {error && !status ? <p>{error}</p> : null}
        {status ? (
          <>
            <p className="dashboard-device-name">{status.appliance}</p>
            {status.metrics.length > 0 ? (
              <dl className="air-quality-metrics">
                {status.metrics.map((metric) => (
                  <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>
                ))}
              </dl>
            ) : <p>Ansluten, men inga mätvärden kunde hämtas.</p>}
            {error ? <p className="dashboard-live-note">Uppdateringen misslyckades: {error} Visar de senaste mätvärdena.</p> : null}
            <p className="dashboard-live-note">Uppdaterad {new Date(status.updatedAt).toLocaleTimeString('sv-SE')}</p>
          </>
        ) : null}
      </div>
    </section>
  );
}
