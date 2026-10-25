'use client';

import { useId, useMemo } from 'react';
import { formatNumber } from '@/utils';
import type { PieChartSlice } from '@/types';
import styles from './PieChart.module.css';

export interface PieChartProps {
  slices: PieChartSlice[];
  /** Título acima do gráfico. */
  label?: string;
  /** Valor grande (default: soma das fatias). */
  totalLabel?: string;
  size?: number;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

const FALLBACK_COLORS = [
  'var(--brand-green)',
  'color-mix(in srgb, var(--brand-green) 55%, #1a3a2a)',
  'color-mix(in srgb, var(--text-primary) 55%, var(--brand-green))',
  'color-mix(in srgb, var(--status-warning, #c97800) 80%, transparent)',
  'color-mix(in srgb, var(--text-muted) 70%, var(--brand-green))',
  'color-mix(in srgb, var(--brand-green) 35%, #0d2b1f)',
];

export function PieChart({ slices, label, totalLabel, size = 160 }: PieChartProps) {
  const gradId = useId().replace(/:/g, '');
  const total = useMemo(() => slices.reduce((sum, s) => sum + Math.max(0, s.value), 0), [slices]);

  const arcs = useMemo(() => {
    if (total <= 0) return [];
    let angle = 0;
    return slices
      .filter((s) => s.value > 0)
      .map((slice, i) => {
        const sweep = (slice.value / total) * 360;
        const start = angle;
        const end = angle + sweep;
        angle = end;
        // Fatia única = círculo completo
        const path =
          sweep >= 359.9
            ? `M ${size / 2} ${size / 2 - size * 0.38} A ${size * 0.38} ${size * 0.38} 0 1 1 ${
                size / 2 - 0.01
              } ${size / 2 - size * 0.38}`
            : describeArc(size / 2, size / 2, size * 0.38, start, end);
        return {
          ...slice,
          path,
          color: slice.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
          pct: Math.round((slice.value / total) * 100),
        };
      });
  }, [slices, total, size]);

  const stroke = Math.max(18, Math.round(size * 0.14));

  return (
    <div className={styles.card}>
      {label ? <p className={styles.label}>{label}</p> : null}
      <p className={styles.value}>{totalLabel ?? formatNumber(total)}</p>

      <div className={styles.body}>
        <svg
          className={styles.svg}
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={label ?? 'Gráfico de pizza'}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size * 0.38}
            fill="none"
            stroke="var(--bg-active)"
            strokeWidth={stroke}
          />
          {arcs.length === 0 ? null : arcs.length === 1 && arcs[0].pct >= 99 ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={size * 0.38}
              fill="none"
              stroke={arcs[0].color}
              strokeWidth={stroke}
            />
          ) : (
            arcs.map((arc) => (
              <path
                key={`${gradId}-${arc.id}`}
                d={arc.path}
                fill="none"
                stroke={arc.color}
                strokeWidth={stroke}
                strokeLinecap="butt"
              />
            ))
          )}
        </svg>

        <ul className={styles.legend}>
          {arcs.map((arc) => (
            <li key={arc.id} className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: arc.color }} />
              <span className={styles.legendLabel}>{arc.label}</span>
              <span className={styles.legendValue}>
                {formatNumber(arc.value)} · {arc.pct}%
              </span>
            </li>
          ))}
          {arcs.length === 0 && <li className={styles.legendEmpty}>Sem dados para o período</li>}
        </ul>
      </div>
    </div>
  );
}
