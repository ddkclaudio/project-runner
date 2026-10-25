'use client';

import React from 'react';
import { IconLayoutGrid, IconList, IconSearch } from '@tabler/icons-react';
import { Input } from '@/components/ui/Input';
import styles from './ViewToolbar.module.css';

export type ViewMode = 'grid' | 'list';

export interface ViewToolbarFilter {
  /** Unique key */
  key: string;
  /** Label shown in the pill */
  label: string;
  /** Extra content rendered inside the pill (e.g. dropdown) */
  content?: React.ReactNode;
  /** Whether this filter pill is currently active */
  active?: boolean;
  onClick?: () => void;
}

export interface ViewToolbarProps {
  /** Controlled search query */
  query?: string;
  onQueryChange?: (q: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;

  /** Extra filter pills rendered between search and view toggle */
  filters?: ViewToolbarFilter[];

  /** Whether to show the grid/list toggle buttons */
  showViewToggle?: boolean;
  view?: ViewMode;
  onViewChange?: (v: ViewMode) => void;

  /** Slot for arbitrary content on the right (e.g. "New" button) */
  rightSlot?: React.ReactNode;

  ariaLabel?: string;
}

export function ViewToolbar({
  query,
  onQueryChange,
  searchPlaceholder = 'Buscar...',
  searchAriaLabel,
  filters,
  showViewToggle = true,
  view,
  onViewChange,
  rightSlot,
  ariaLabel = 'Barra de ferramentas',
}: ViewToolbarProps) {
  return (
    <div className={styles.toolbar} role="toolbar" aria-label={ariaLabel}>
      <div className={styles.left}>
        {onQueryChange !== undefined && (
          <div className={styles.search}>
            <Input
              inputSize="sm"
              leftIcon={<IconSearch size={13} />}
              placeholder={searchPlaceholder}
              value={query ?? ''}
              onChange={(e) => onQueryChange(e.target.value)}
              clearable
              onClear={() => onQueryChange('')}
              aria-label={searchAriaLabel ?? searchPlaceholder}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        {filters?.map((f) =>
          f.content ? (
            <React.Fragment key={f.key}>{f.content}</React.Fragment>
          ) : (
            <button
              key={f.key}
              className={`${styles.pill} ${f.active ? styles.pillActive : ''}`}
              onClick={f.onClick}
              aria-pressed={f.active}
            >
              <span>{f.label}</span>
            </button>
          ),
        )}
      </div>

      <div className={styles.right}>
        {showViewToggle && onViewChange && (
          <>
            <button
              className={`${styles.viewToggle} ${view === 'grid' ? styles.viewToggleActive : ''}`}
              aria-label="Visualização em grade"
              aria-pressed={view === 'grid'}
              onClick={() => onViewChange('grid')}
            >
              <IconLayoutGrid size={17} aria-hidden="true" />
            </button>
            <button
              className={`${styles.viewToggle} ${view === 'list' ? styles.viewToggleActive : ''}`}
              aria-label="Visualização em lista"
              aria-pressed={view === 'list'}
              onClick={() => onViewChange('list')}
            >
              <IconList size={17} aria-hidden="true" />
            </button>
          </>
        )}

        {rightSlot}
      </div>
    </div>
  );
}
