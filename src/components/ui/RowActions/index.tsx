'use client';

import React from 'react';
import { IconDotsVertical } from '@tabler/icons-react';
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu';
import { useContextMenu } from '@/hooks/useContextMenu';
import { clampToViewport } from '@/utils';
import styles from './RowActions.module.css';

export interface RowActionsProps {
  label: string;
  items: ContextMenuItem[];
  menuOffset?: { x?: number; y?: number };
}

const MENU_WIDTH = 180;

export function RowActions({ label, items, menuOffset }: RowActionsProps) {
  const { isOpen, position, openAt, close } = useContextMenu();

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    const btn = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const preferredLeft = btn.right - MENU_WIDTH + (menuOffset?.x ?? 0);
    const preferredTop = btn.bottom + (menuOffset?.y ?? 4);
    const clamped = clampToViewport({
      left: preferredLeft,
      top: preferredTop,
      width: MENU_WIDTH,
      height: items.length * 40 + 16,
    });
    openAt({ top: clamped.top, left: clamped.left });
  }

  return (
    <div className={styles.wrap}>
      <button className={styles.kebab} onClick={handleClick} aria-label={label}>
        <IconDotsVertical size={14} />
      </button>
      {isOpen && (
        <ContextMenu
          style={{ top: position.top, left: position.left }}
          onClose={close}
          items={items}
        />
      )}
    </div>
  );
}
