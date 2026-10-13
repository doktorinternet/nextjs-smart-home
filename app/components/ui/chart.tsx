'use client';

import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { locale } from '@/app/copy';
import styles from './chart.module.css';

type ChartConfig = Record<string, { label: string; color: string; unit?: string }>;

export function ChartContainer({ config, children, className, initialDimension }: {
  config: ChartConfig;
  children: ReactNode;
  className?: string;
  initialDimension?: { width: number; height: number };
}) {
  const variables = Object.fromEntries(Object.entries(config).map(([key, value]) => [`--color-${key}`, value.color]));
  return <div className={className} style={variables as CSSProperties}><ResponsiveContainer width="100%" height="100%" initialDimension={initialDimension}>{children as ReactElement}</ResponsiveContainer></div>;
}

export function ChartTooltipContent({ active, payload, label, config }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string; payload?: Record<string, number | string> }>; label?: number | string; config: ChartConfig }) {
  if (!active || !payload?.length) return null;
  return <div className={styles.tooltip}><p>{label !== undefined ? new Date(label).toLocaleString(locale) : ''}</p>{payload.map((entry) => {
    const name = entry.name ?? '';
    const definition = config[name];
    const value = entry.payload?.[`${name}Label`] ?? entry.value;
    return <p key={name} style={{ color: entry.color }}>{definition?.label ?? name}: {value} {definition?.unit ?? ''}</p>;
  })}</div>;
}
