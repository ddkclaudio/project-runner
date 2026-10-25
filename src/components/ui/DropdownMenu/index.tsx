'use client';

import React, { createContext, useContext, useRef, useLayoutEffect, useState } from 'react';
import { cx, clampToViewport } from '@/utils';
import styles from './DropdownMenu.module.css';

const AnchorCtx = createContext<React.RefObject<HTMLDivElement | null>>({ current: null });

export function DropdownMenuRoot({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <AnchorCtx.Provider value={ref}>
      <div ref={ref} className={cx(styles.root, className)}>
        {children}
      </div>
    </AnchorCtx.Provider>
  );
}

const PANEL_GAP = 8;
const PANEL_WIDTH = 260;
const PANEL_EST_HEIGHT = 320;

export function DropdownMenuPanel({
  className,
  children,
  role = 'menu',
  width: widthProp,
  estimatedHeight = PANEL_EST_HEIGHT,
  'aria-label': ariaLabel,
}: {
  className?: string;
  children: React.ReactNode;
  role?: string;
  /** Largura do painel (default 260). */
  width?: number;
  /** Altura estimada para flip acima/abaixo do âncora. */
  estimatedHeight?: number;
  'aria-label'?: string;
}) {
  const anchorRef = useContext(AnchorCtx);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const panelWidth = widthProp ?? PANEL_WIDTH;

  useLayoutEffect(() => {
    function place() {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.min(panelWidth, window.innerWidth - 16);
      let top = rect.bottom + PANEL_GAP;
      if (top + estimatedHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - estimatedHeight - PANEL_GAP);
      }
      const preferredLeft = rect.right - width;
      setPos(
        clampToViewport({
          left: preferredLeft,
          top,
          width,
          height: estimatedHeight,
        }),
      );
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef, panelWidth, estimatedHeight]);

  return (
    <div
      className={cx(styles.panel, className)}
      role={role}
      aria-label={ariaLabel}
      style={pos ? { top: pos.top, left: pos.left, width: pos.width } : undefined}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator() {
  return <div className={styles.separator} role="separator" />;
}

export function DropdownMenuSectionLabel({ children }: { children: React.ReactNode }) {
  return <div className={styles.sectionLabel}>{children}</div>;
}

export function DropdownMenuHeader({
  avatar,
  name,
  email,
}: {
  avatar: React.ReactNode;
  name: string;
  email: string;
}) {
  return (
    <div className={styles.header}>
      {avatar}
      <div className={styles.headerInfo}>
        <span className={styles.headerName}>{name}</span>
        <span className={styles.headerEmail}>{email}</span>
      </div>
    </div>
  );
}
