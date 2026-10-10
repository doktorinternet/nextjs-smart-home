'use client';

import { useCallback, useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWind } from '@fortawesome/free-solid-svg-icons';
import { AutoRefreshControl, useAutoFetch } from './useAutoFetch';
import { copy, formatCopy, locale } from '@/app/copy';

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
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(formatCopy(copy.electrolux.httpError, { status: response.status }));
        return;
      }
      if (!isStatus(result)) {
        setError(copy.electrolux.invalidStatus);
        return;
      }
      setStatus(result);
      setError(null);
    } catch {
      setError(copy.electrolux.unreachable);
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
          <p className="dashboard-eyebrow">{copy.electrolux.eyebrow}</p>
          <h2 id="air-quality-heading">{copy.electrolux.title}</h2>
        </div>
        <span className="dashboard-source">Pure A9</span>
        <AutoRefreshControl
          label={copy.electrolux.label}
          {...autoFetch}
          onChange={autoFetch.setEnabled}
          onRefresh={() => void refresh()}
          refreshLabel={copy.electrolux.refresh}
          refreshing={loading}
        />
      </div>
      <div className="dashboard-live-content" aria-live="polite">
        {loading && !status ? <p>{copy.electrolux.connecting}</p> : null}
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
            ) : <p>{copy.electrolux.noMetrics}</p>}
            {error ? <p className="dashboard-live-note">{formatCopy(copy.electrolux.updateFailed, { error })}</p> : null}
            <p className="dashboard-live-note">{formatCopy(copy.electrolux.updated, { time: new Date(status.updatedAt).toLocaleTimeString(locale) })}</p>
          </>
        ) : null}
      </div>
    </section>
  );
}
