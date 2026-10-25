'use client';

import React, { useState, useCallback, useRef } from 'react';
import { IconChevronUp, IconChevronDown, IconSelector } from '@tabler/icons-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMinimumLoading } from '@/hooks/useMinimumLoading';
import { cx } from '@/utils';
import styles from './DataTable.module.css';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type SortDir = 'asc' | 'desc';

export interface TableColumn<Row> {
  key: string;
  label: string;
  /** Width hint, e.g. "40%" or "120px" */
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Optional tooltip text shown via an info icon in the header */
  info?: string;
  render: (row: Row) => React.ReactNode;
}

export interface DataTableProps<Row> {
  columns: TableColumn<Row>[];
  rows: Row[];
  /** Used for React keys. Default: "id" */
  keyField?: keyof Row;
  onRowClick?: (row: Row) => void;
  /** Render a trailing actions cell per row */
  rowActions?: (row: Row) => React.ReactNode;
  /** Optional extra class name per row */
  rowClassName?: (row: Row) => string | undefined;
  /** Shown when rows array is empty */
  emptyMessage?: string;
  /** When true, shows skeleton rows (holds ~500ms via useMinimumLoading) */
  loading?: boolean;
  /** Skeleton row count while loading. Default: 7 */
  loadingRows?: number;
  className?: string;
}

const SKELETON_WIDTHS = ['78%', '55%', '62%', '42%', '50%', '68%'] as const;

/* ── Sort icon ─────────────────────────────────────────────────────────────── */
function SortIcon({ dir }: { dir?: SortDir }) {
  if (dir === 'asc') return <IconChevronUp size={11} className={styles.sortIcon} />;
  if (dir === 'desc') return <IconChevronDown size={11} className={styles.sortIcon} />;
  return <IconSelector size={11} className={cx(styles.sortIcon, styles.sortIconIdle)} />;
}

/* ── Header cell - tooltip de explicação após 2s de hover ───────────────────── */
function HeaderCell<Row>({
  col,
  sortKey,
  sortDir,
  onSort,
}: {
  col: TableColumn<Row>;
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (k: string) => void;
}) {
  const [showTip, setShowTip] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onEnter() {
    if (!col.info) return;
    timer.current = setTimeout(() => setShowTip(true), 2000);
  }
  function onLeave() {
    if (timer.current) clearTimeout(timer.current);
    setShowTip(false);
  }

  return (
    <th
      className={cx(styles.th, col.sortable && styles.thSortable)}
      style={{ width: col.width, textAlign: col.align ?? 'left' }}
      onClick={col.sortable ? () => onSort(col.key) : undefined}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      aria-sort={sortKey === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <span className={styles.thInner}>
        {col.label}
        {col.sortable && <SortIcon dir={sortKey === col.key ? sortDir : undefined} />}
        {col.info && showTip && (
          <span className={styles.tooltip} role="tooltip">
            {col.info}
          </span>
        )}
      </span>
    </th>
  );
}

/* ── Component ─────────────────────────────────────────────────────────────── */
export function DataTable<Row>({
  columns,
  rows,
  keyField = 'id' as keyof Row,
  onRowClick,
  rowActions,
  rowClassName,
  emptyMessage = 'No data',
  loading = false,
  loadingRows = 7,
  className,
}: DataTableProps<Row>) {
  const showSkeleton = useMinimumLoading(loading);

  /* sort em um único estado para o ciclo de 3 fases ser atômico */
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);
  const sortKey = sort?.key ?? null;
  const sortDir = sort?.dir ?? 'asc';

  /* ciclo de 3 estados: 1º asc → 2º desc → 3º sem ordenação */
  const handleSort = useCallback((key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' }; // coluna nova → ascendente
      if (prev.dir === 'asc') return { key, dir: 'desc' }; // asc → desc
      return null; // desc → sem ordenação
    });
  }, []);

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey];
        const bv = (b as Record<string, unknown>)[sortKey];
        let cmp: number;
        if (typeof av === 'number' && typeof bv === 'number') {
          cmp = av - bv;
        } else {
          cmp = String(av ?? '').localeCompare(String(bv ?? ''), 'pt-BR', {
            numeric: true,
          });
        }
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : rows;

  return (
    <div
      className={cx(styles.container, className)}
      aria-busy={showSkeleton || undefined}
      {...(showSkeleton ? { role: 'status', 'aria-label': 'Carregando' } : {})}
    >
      <table className={styles.table}>
        <thead>
          <tr className={styles.headerRow}>
            {columns.map((col) => (
              <HeaderCell<Row>
                key={col.key}
                col={col}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={handleSort}
              />
            ))}
            {rowActions && <th className={styles.th} style={{ width: 40 }} />}
          </tr>
        </thead>
        <tbody>
          {showSkeleton ? (
            Array.from({ length: loadingRows }, (_, r) => (
              <tr key={`skeleton-${r}`} className={styles.row}>
                {columns.map((col, c) => (
                  <td
                    key={col.key}
                    className={styles.cell}
                    style={{ textAlign: col.align ?? 'left' }}
                  >
                    <Skeleton
                      height={12}
                      width={SKELETON_WIDTHS[(r + c) % SKELETON_WIDTHS.length]}
                      shape="pill"
                      className={styles.skeletonBone}
                    />
                  </td>
                ))}
                {rowActions && (
                  <td className={cx(styles.cell, styles.actionsCell)}>
                    <Skeleton
                      height={22}
                      width={22}
                      shape="round"
                      className={styles.skeletonBone}
                    />
                  </td>
                )}
              </tr>
            ))
          ) : sorted.length === 0 ? (
            <tr>
              <td className={styles.empty} colSpan={columns.length + (rowActions ? 1 : 0)}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sorted.map((row, i) => (
              <tr
                key={String(row[keyField] ?? i)}
                className={cx(styles.row, onRowClick && styles.rowClickable, rowClassName?.(row))}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={styles.cell}
                    style={{ textAlign: col.align ?? 'left' }}
                  >
                    {col.render(row)}
                  </td>
                ))}
                {rowActions && (
                  <td className={cx(styles.cell, styles.actionsCell)}>{rowActions(row)}</td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
