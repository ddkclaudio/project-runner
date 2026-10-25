'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IconSearch, IconCheck } from '@tabler/icons-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMinimumLoading } from '@/hooks/useMinimumLoading';
import { cx } from '@/utils';
import styles from './SwitcherDropdown.module.css';
import type { SwitcherAction, SwitcherItem } from './types';

export interface SwitcherPanelProps {
  panelLabel: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  items: SwitcherItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  actions?: SwitcherAction[];
  filterItems?: (items: SwitcherItem[], query: string) => SwitcherItem[];
  getEmptyMessage?: (query: string) => string;
  /** `floating` = dropdown fixo; `embedded` = painel inline (sheet mobile). */
  variant?: 'floating' | 'embedded';
  /** When true, list shows skeletons (search disabled) */
  loading?: boolean;
  loadingCount?: number;
  className?: string;
  autoFocus?: boolean;
  style?: React.CSSProperties;
  onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
}

export function defaultFilter(items: SwitcherItem[], query: string): SwitcherItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const text = item.searchText ?? (typeof item.label === 'string' ? item.label : '');
    return text.toLowerCase().includes(q);
  });
}

function SwitcherSkeletonRows({ count }: { count: number }) {
  return (
    <div className={styles.list} role="status" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cx(styles.item, styles.itemSkeleton)} aria-hidden="true">
          <Skeleton width={14} height={14} shape="round" />
          <Skeleton height={12} width={`${52 + (i % 3) * 12}%`} shape="pill" />
        </div>
      ))}
    </div>
  );
}

export function SwitcherPanel({
  panelLabel,
  searchPlaceholder,
  searchAriaLabel,
  items,
  selectedId,
  onSelect,
  actions = [],
  filterItems = defaultFilter,
  getEmptyMessage = (query) =>
    query ? `Nenhum resultado para "${query}"` : 'Nenhum item encontrado.',
  variant = 'floating',
  loading = false,
  loadingCount = 5,
  className,
  autoFocus = false,
  style,
  onMouseDown,
}: SwitcherPanelProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const showSkeleton = useMinimumLoading(loading);
  const filtered = useMemo(() => filterItems(items, query), [items, query, filterItems]);

  useEffect(() => {
    if (autoFocus && !showSkeleton) {
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [autoFocus, showSkeleton]);

  return (
    <div
      className={cx(variant === 'floating' ? styles.panel : styles.panelEmbedded, className)}
      role="dialog"
      aria-label={panelLabel}
      aria-busy={showSkeleton || undefined}
      style={style}
      onMouseDown={onMouseDown}
    >
      <div className={styles.search}>
        <IconSearch size={13} className={styles.searchIcon} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.searchInput}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          aria-label={searchAriaLabel}
          disabled={showSkeleton}
        />
      </div>

      {showSkeleton ? (
        <SwitcherSkeletonRows count={loadingCount} />
      ) : (
        <div className={styles.list} role="listbox">
          {filtered.length === 0 ? (
            <p className={styles.empty}>{getEmptyMessage(query)}</p>
          ) : (
            filtered.map((item) => {
              const isSelected = selectedId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={cx(styles.item, isSelected && styles.itemActive)}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => onSelect(item.id)}
                >
                  {item.leading && <span className={styles.itemLeading}>{item.leading}</span>}
                  <span className={styles.itemLabel}>{item.label}</span>
                  {item.trailing}
                  {isSelected && (
                    <IconCheck size={14} className={styles.checkIcon} aria-hidden="true" />
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      {!showSkeleton && actions.length > 0 && (
        <>
          <div className={styles.separator} role="separator" />
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={styles.actionItem}
              onClick={action.onClick}
            >
              {action.icon && <span className={styles.actionIcon}>{action.icon}</span>}
              <span className={styles.actionLabel}>{action.label}</span>
            </button>
          ))}
        </>
      )}
    </div>
  );
}
