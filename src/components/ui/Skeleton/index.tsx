import React from 'react';
import { cx } from '@/utils';
import styles from './Skeleton.module.css';

/* ── Primitive ─────────────────────────────────────────────────────────────── */

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  /** round = avatar/circle; pill = soft bar; block = default */
  shape?: 'block' | 'round' | 'pill';
}

function toCssSize(v: string | number | undefined) {
  if (v == null) return undefined;
  return typeof v === 'number' ? `${v}px` : v;
}

/** Bloco animado base (shimmer alinhado aos tokens do tema). */
function SkeletonBone({
  width,
  height,
  shape = 'block',
  className,
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      className={cx(
        styles.bone,
        shape === 'round' && styles.round,
        shape === 'pill' && styles.pill,
        className,
      )}
      style={{
        width: toCssSize(width),
        height: toCssSize(height),
        ...style,
      }}
      aria-hidden="true"
      {...rest}
    />
  );
}

/* ── Text line ─────────────────────────────────────────────────────────────── */

function SkeletonText({
  lines = 1,
  lastWidth = '62%',
  className,
}: {
  lines?: number;
  lastWidth?: string | number;
  className?: string;
}) {
  return (
    <div className={cx(styles.textStack, className)}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonBone
          key={i}
          height={12}
          shape="pill"
          width={i === lines - 1 && lines > 1 ? lastWidth : '100%'}
          className={styles.textLine}
        />
      ))}
    </div>
  );
}

/* ── Presets (só dados: tabela / grid / canvas, sem título/subtítulo) ──────── */

function SkeletonTable({
  rows = 6,
  cols = 4,
  className,
}: {
  rows?: number;
  cols?: number;
  className?: string;
}) {
  return (
    <div
      className={cx(styles.table, className)}
      role="status"
      aria-label="Carregando"
      style={{ ['--skeleton-cols' as string]: cols }}
    >
      <div className={styles.tableHead}>
        {Array.from({ length: cols }, (_, i) => (
          <SkeletonBone key={i} height={10} width={i === 0 ? '70%' : '50%'} shape="pill" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className={styles.tableRow}>
          {Array.from({ length: cols }, (_, c) => (
            <SkeletonBone
              key={c}
              height={12}
              width={c === 0 ? '78%' : c === cols - 1 ? '42%' : '55%'}
              shape="pill"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function SkeletonCards({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cx(styles.cards, className)} role="status" aria-label="Carregando">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.card}>
          <SkeletonBone height={14} width="70%" shape="pill" />
          <SkeletonBone height={11} width="45%" shape="pill" />
          <div className={styles.cardMeta}>
            <SkeletonBone height={20} width={64} shape="pill" />
            <SkeletonBone height={20} width={48} shape="pill" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Grid de status cards (dashboard do projeto). */
function SkeletonStatusCards({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div className={cx(styles.statusGrid, className)} role="status" aria-label="Carregando">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.statusCard}>
          <SkeletonBone height={12} width="55%" shape="pill" />
          <SkeletonBone height={20} width="40%" shape="pill" />
        </div>
      ))}
    </div>
  );
}

/** Área do canvas (React Flow), só o painel, sem header. */
function SkeletonFluid({ className }: { className?: string }) {
  return (
    <div
      className={cx(styles.fluid, className)}
      role="status"
      aria-busy="true"
      aria-label="Carregando"
    >
      <div className={styles.fluidBody}>
        <SkeletonBone className={styles.fluidPane} />
      </div>
    </div>
  );
}

export const Skeleton = Object.assign(SkeletonBone, {
  Text: SkeletonText,
  Table: SkeletonTable,
  Cards: SkeletonCards,
  StatusCards: SkeletonStatusCards,
  Fluid: SkeletonFluid,
  /** @deprecated Use Skeleton.Table */
  Page: SkeletonTable,
  /** @deprecated Use Skeleton.StatusCards */
  Dashboard: SkeletonStatusCards,
});
