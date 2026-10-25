'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import styles from './BarChart.module.css';
import { formatNumber } from '@/utils';
import type { ChartDataset } from '@/types';

interface BarChartProps {
  dataset: ChartDataset;
}

type TipState = {
  x: number;
  y: number;
  value: number;
  index: number;
  flip: boolean;
} | null;

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const;

function tooltipLabel(dataset: ChartDataset, index: number): string {
  if (dataset.data.length === 12) {
    return MONTH_LABELS[index] ?? dataset.fromLabel;
  }
  if (index === 0 && dataset.fromLabel) return dataset.fromLabel;
  if (index === dataset.data.length - 1 && dataset.toLabel) return dataset.toLabel;
  return 'Valor';
}

function normalizeChartLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (t !== t.toUpperCase()) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

export function BarChart({ dataset }: BarChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef({ bw: 0, gap: 2, n: 0, max: 1, h: 54 });
  const [tip, setTip] = useState<TipState>(null);

  const draw = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const w = svg.clientWidth || 260;
    const h = 54;
    const n = dataset.data.length;
    const gap = 2;
    const bw = Math.max(1, Math.floor((w - gap * Math.max(n - 1, 0)) / Math.max(n, 1)));
    const max = Math.max(...dataset.data) || 1;
    layoutRef.current = { bw, gap, n, max, h };

    svg.innerHTML = dataset.data
      .map((v, i) => {
        const bh = Math.round((v / max) * (h - 4));
        const x = i * (bw + gap);
        const y = h - bh;
        return `<rect data-i="${i}" x="${x}" y="${y}" width="${bw}" height="${Math.max(bh, 1)}" rx="2" fill="var(--brand-green)" opacity="${v > 0 ? 0.9 : 0.25}"/>`;
      })
      .join('');
  }, [dataset.data]);

  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (svgRef.current) ro.observe(svgRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const resolveIndex = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return -1;
    const rect = svg.getBoundingClientRect();
    const { bw, gap, n } = layoutRef.current;
    if (n <= 0 || bw <= 0) return -1;
    const localX = clientX - rect.left;
    const i = Math.floor(localX / (bw + gap));
    if (i < 0 || i >= n) return -1;
    return i;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const card = cardRef.current;
    if (!card) return;
    const i = resolveIndex(e.clientX);
    if (i < 0) {
      setTip(null);
      return;
    }
    const cardRect = card.getBoundingClientRect();
    const x = e.clientX - cardRect.left;
    const y = e.clientY - cardRect.top;
    setTip({
      x,
      y,
      value: dataset.data[i] ?? 0,
      index: i,
      flip: x > cardRect.width * 0.62,
    });
  };

  const onPointerLeave = () => setTip(null);

  return (
    <div
      ref={cardRef}
      className={styles.card}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <p className={styles.label}>{normalizeChartLabel(dataset.label)}</p>
      <p className={styles.value}>{formatNumber(dataset.total)}</p>
      <svg ref={svgRef} className={styles.svg} aria-hidden="true" />
      <div className={styles.times}>
        <span>{dataset.fromLabel}</span>
        <span>{dataset.toLabel}</span>
      </div>
      {tip ? (
        <div
          className={`${styles.tooltip} ${tip.flip ? styles.tooltipFlip : ''}`}
          style={{
            left: tip.x,
            top: tip.y,
          }}
          role="tooltip"
        >
          <span className={styles.tooltipLabel}>{tooltipLabel(dataset, tip.index)}</span>
          <strong className={styles.tooltipValue}>{formatNumber(tip.value)}</strong>
        </div>
      ) : null}
    </div>
  );
}
