'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import styles from './ContextMenu.module.css';

export interface ContextMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  style?: React.CSSProperties;
  onClose?: () => void;
}

export function ContextMenu({ items, style, onClose }: ContextMenuProps) {
  const menu = (
    <div
      className={styles.menu}
      style={style}
      role="menu"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className={`${styles.item} ${item.danger ? styles.danger : ''}`}
          role="menuitem"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            item.onClick?.();
            onClose?.();
          }}
        >
          <span className={styles.icon}>{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );

  // Portal evita containing block de transform/overflow (ItemCard hover, DataTable, main)
  if (typeof document === 'undefined') return null;
  return createPortal(menu, document.body);
}
