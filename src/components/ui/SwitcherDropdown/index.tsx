'use client';

import React, { useEffect, useLayoutEffect, useState } from 'react';
import { IconSelector } from '@tabler/icons-react';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMinimumLoading } from '@/hooks/useMinimumLoading';
import { useSearchDropdown } from '@/hooks/useSearchDropdown';
import { cx, clampToViewport } from '@/utils';
import { SwitcherPanel, defaultFilter } from './SwitcherPanel';
import type { SwitcherAction, SwitcherItem } from './types';
import styles from './SwitcherDropdown.module.css';

export type { SwitcherItem, SwitcherAction } from './types';
export { SwitcherPanel, defaultFilter } from './SwitcherPanel';
export type { SwitcherPanelProps } from './SwitcherPanel';

const PANEL_GAP = 8;
const PANEL_MIN_WIDTH = 300;
const PANEL_EST_HEIGHT = 360;

export interface SwitcherDropdownProps {
  'aria-label': string;
  panelLabel: string;
  searchPlaceholder: string;
  searchAriaLabel: string;
  items: SwitcherItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  trigger: React.ReactNode;
  actions?: SwitcherAction[];
  filterItems?: (items: SwitcherItem[], query: string) => SwitcherItem[];
  getEmptyMessage?: (query: string) => string;
  showSelector?: boolean;
  mutedSelector?: boolean;
  /** When true, trigger shows skeleton and cannot open the panel */
  loading?: boolean;
  className?: string;
}

export function SwitcherDropdown({
  'aria-label': ariaLabel,
  panelLabel,
  searchPlaceholder,
  searchAriaLabel,
  items,
  selectedId,
  onSelect,
  trigger,
  actions = [],
  filterItems = defaultFilter,
  getEmptyMessage = (query) =>
    query ? `Nenhum resultado para "${query}"` : 'Nenhum item encontrado.',
  showSelector = true,
  mutedSelector = false,
  loading = false,
  className,
}: SwitcherDropdownProps) {
  const { open, close, toggle, wrapperRef } = useSearchDropdown();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const showSkeleton = useMinimumLoading(loading);

  useEffect(() => {
    if (showSkeleton && open) close();
  }, [showSkeleton, open, close]);

  useLayoutEffect(() => {
    if (!open || showSkeleton) return;

    function place() {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.min(PANEL_MIN_WIDTH, window.innerWidth - 24);
      let top = rect.bottom + PANEL_GAP;
      if (top + PANEL_EST_HEIGHT > window.innerHeight - 8) {
        top = Math.max(8, rect.top - PANEL_EST_HEIGHT - PANEL_GAP);
      }
      const clamped = clampToViewport({
        left: rect.left,
        top,
        width,
        height: PANEL_EST_HEIGHT,
        pad: 12,
      });
      setPos({ top: clamped.top, left: clamped.left });
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, showSkeleton, wrapperRef]);

  function handleSelect(id: string) {
    onSelect(id);
    close();
  }

  function handleToggle() {
    if (showSkeleton) return;
    toggle();
  }

  return (
    <div ref={wrapperRef} className={cx(styles.root, className)}>
      <button
        type="button"
        className={cx(
          styles.trigger,
          open && !showSkeleton && styles.triggerOpen,
          showSkeleton && styles.triggerLoading,
        )}
        onClick={handleToggle}
        disabled={showSkeleton}
        aria-haspopup="listbox"
        aria-expanded={showSkeleton ? false : open}
        aria-busy={showSkeleton || undefined}
        aria-label={ariaLabel}
      >
        {showSkeleton ? (
          <>
            <Skeleton width={14} height={14} shape="round" className={styles.triggerIconBone} />
            <Skeleton height={12} width={88} shape="pill" className={styles.triggerLabelBone} />
          </>
        ) : (
          <>
            {trigger}
            {showSelector && (
              <IconSelector
                size={12}
                className={cx(styles.selectorIcon, mutedSelector && styles.selectorIconMuted)}
                aria-hidden="true"
              />
            )}
          </>
        )}
      </button>

      {open && !showSkeleton && (
        <SwitcherPanel
          panelLabel={panelLabel}
          searchPlaceholder={searchPlaceholder}
          searchAriaLabel={searchAriaLabel}
          items={items}
          selectedId={selectedId}
          onSelect={handleSelect}
          actions={actions.map((action) => ({
            ...action,
            onClick: () => {
              close();
              action.onClick();
            },
          }))}
          filterItems={filterItems}
          getEmptyMessage={getEmptyMessage}
          variant="floating"
          style={pos ? { top: pos.top, left: pos.left } : undefined}
        />
      )}
    </div>
  );
}
