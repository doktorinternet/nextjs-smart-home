'use client';

import { useCallback, useEffect, useState } from 'react';
import { AutoFetchSwitch, useAutoFetch } from './useAutoFetch';

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

export default function ElectroluxPanel() {
  const autoFetch = useAutoFetch('dashboard.autoFetch.electrolux');
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/electrolux/status', { cache: 'no-store' });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = typeof result === 'object' && result !== null
          && typeof (result as Record<string, unknown>).error === 'string'
          ? (result as Record<string, string>).error : 'Air quality data is unavailable';
        throw new Error(message);
      }
      if (!isStatus(result)) throw new Error('Electrolux returned invalid status data');
      setStatus(result);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Air quality data is unavailable');
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
        <span className="dashboard-module-icon" aria-hidden="true">◌</span>
        <div>
          <p className="dashboard-eyebrow">At home</p>
          <h2 id="air-quality-heading">Air quality</h2>
        </div>
        <span className="dashboard-source">Pure A9</span>
        <div className="dashboard-header-controls">
          <AutoFetchSwitch label="Electrolux purifier" {...autoFetch} onChange={autoFetch.setEnabled} />
          <button className="dashboard-header-refresh" type="button" onClick={() => void refresh()} disabled={loading} aria-label="Refresh Electrolux purifier status">Refresh</button>
        </div>
      </div>
      <div className="dashboard-live-content" aria-live="polite">
        {loading && !status ? <p>Connecting to air purifier…</p> : null}
        {autoFetch.ready && !autoFetch.enabled && !loading && !status ? <p>Automatic updates are off. Refresh to load purifier status.</p> : null}
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
            ) : <p>Connected; no supported readings were returned.</p>}
            {error ? <p className="dashboard-live-note">Refresh failed; showing the last readings.</p> : null}
            <p className="dashboard-live-note">Updated {new Date(status.updatedAt).toLocaleTimeString()}</p>
          </>
        ) : null}
      </div>
    </section>
  );
}
