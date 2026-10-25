'use client';

export { default as gridCardStyles } from './gridCard.module.css';
import React, { useRef } from 'react';
import { IconDotsVertical } from '@tabler/icons-react';
import { ContextMenu, type ContextMenuItem } from '@/components/ui/ContextMenu';
import { useContextMenu } from '@/hooks/useContextMenu';
import { clampToViewport, cx } from '@/utils';
import styles from './ItemCard.module.css';

export interface ItemCardActions {
  label: string;
  items: ContextMenuItem[];
}

interface ItemCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  highlight?: boolean;
  actions?: ItemCardActions;
  'aria-label'?: string;
}

export function ItemCard({
  children,
  onClick,
  className,
  highlight,
  actions,
  'aria-label': ariaLabel,
}: ItemCardProps) {
  const { isOpen, position, openAt, close } = useContextMenu();
  const cardRef = useRef<HTMLDivElement>(null);

  function handleKebabClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const preferredTop = rect.bottom + 4;
    const preferredLeft = rect.right - 160;
    const clamped = clampToViewport({
      left: preferredLeft,
      top: preferredTop,
      width: 160,
      height: 160,
    });
    // Menu is position:fixed, use viewport coords
    openAt({ top: clamped.top, left: clamped.left });
  }

  function handleCardClick(e: React.MouseEvent) {
    if (!onClick) return;
    // Clique no kebab/menu não deve abrir o item
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('[role="menu"], [aria-haspopup="menu"]')) return;
    onClick();
  }

  return (
    <div
      ref={cardRef}
      className={cx(
        styles.card,
        highlight && styles.cardHighlight,
        isOpen && styles.cardOpen,
        className,
      )}
      onClick={handleCardClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {children}

      {actions && (
        <>
          <button
            className={styles.kebab}
            onClick={handleKebabClick}
            aria-label={actions.label}
            aria-haspopup="menu"
            aria-expanded={isOpen}
          >
            <IconDotsVertical size={14} aria-hidden="true" />
          </button>
          {isOpen && (
            <ContextMenu
              style={{ top: position.top, left: position.left }}
              onClose={close}
              items={actions.items}
            />
          )}
        </>
      )}
    </div>
  );
}
