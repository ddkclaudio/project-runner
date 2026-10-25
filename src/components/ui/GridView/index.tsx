'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMinimumLoading } from '@/hooks/useMinimumLoading';
import { cx } from '@/utils';
import styles from './GridView.module.css';

export interface GridViewProps<Item> {
  items: Item[];
  keyField: keyof Item;
  renderItem: (item: Item) => React.ReactNode;
  /** Shown when items array is empty */
  emptyMessage?: string;
  /** Override grid column layout via CSS grid-template-columns */
  columns?: string;
  /** When true, shows skeleton cards (holds ~500ms via useMinimumLoading) */
  loading?: boolean;
  /** Skeleton card count while loading. Default: 6 */
  loadingCount?: number;
  className?: string;
}

export function GridView<Item>({
  items,
  keyField,
  renderItem,
  emptyMessage = 'Nenhum item encontrado.',
  columns,
  loading = false,
  loadingCount = 6,
  className,
}: GridViewProps<Item>) {
  const showSkeleton = useMinimumLoading(loading);

  return (
    <div
      className={cx(styles.grid, className)}
      style={columns ? { gridTemplateColumns: columns } : undefined}
      role={showSkeleton ? 'status' : 'list'}
      aria-busy={showSkeleton || undefined}
      aria-label={showSkeleton ? 'Carregando' : undefined}
    >
      {showSkeleton ? (
        Array.from({ length: loadingCount }, (_, i) => (
          <div key={`skeleton-${i}`} className={styles.skeletonCard} aria-hidden="true">
            <Skeleton height={14} width="70%" shape="pill" />
            <Skeleton height={11} width="45%" shape="pill" />
            <div className={styles.skeletonMeta}>
              <Skeleton height={20} width={64} shape="pill" />
              <Skeleton height={20} width={48} shape="pill" />
            </div>
          </div>
        ))
      ) : items.length === 0 ? (
        <p className={styles.empty}>{emptyMessage}</p>
      ) : (
        items.map((item) => (
          <div key={String(item[keyField])} className={styles.item} role="listitem">
            {renderItem(item)}
          </div>
        ))
      )}
    </div>
  );
}
