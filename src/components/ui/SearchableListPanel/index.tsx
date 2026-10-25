'use client';

import React, { useEffect, useRef } from 'react';
import { IconSearch } from '@tabler/icons-react';
import { cx } from '@/utils';
import styles from './SearchableListPanel.module.css';

interface SearchableListPanelProps<T> {
  query: string;
  onQueryChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  'aria-label'?: string;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  autoFocus?: boolean;
  className?: string;
}

export function SearchableListPanel<T>({
  query,
  onQueryChange,
  placeholder = 'Buscar…',
  emptyMessage = 'Nenhum resultado',
  'aria-label': ariaLabel,
  items,
  renderItem,
  autoFocus = true,
  className,
}: SearchableListPanelProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) setTimeout(() => inputRef.current?.focus(), 0);
  }, [autoFocus]);

  return (
    <div className={cx(styles.panel, className)} role="dialog" aria-label={ariaLabel}>
      <div className={styles.search}>
        <IconSearch size={13} className={styles.searchIcon} aria-hidden="true" />
        <input
          ref={inputRef}
          className={styles.input}
          placeholder={placeholder}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <div className={styles.list}>
        {items.length === 0 ? (
          <p className={styles.empty}>{emptyMessage}</p>
        ) : (
          items.map((item) => renderItem(item))
        )}
      </div>
    </div>
  );
}
