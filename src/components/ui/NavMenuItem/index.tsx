'use client';

import React from 'react';
import Link from 'next/link';
import { cx } from '@/utils';
import styles from './NavMenuItem.module.css';

export interface NavMenuItemProps {
  label: string;
  icon?: React.ReactNode;
  href?: string;
  active?: boolean;
  danger?: boolean;
  variant?: 'sidebar' | 'menu';
  title?: string;
  /** Small status pill next to the label (e.g. "deprecated"). */
  badge?: string;
  onClick?: () => void;
  className?: string;
  role?: string;
  'aria-current'?: 'page' | undefined;
  'aria-checked'?: boolean;
}

export function NavMenuItem({
  label,
  icon,
  href,
  active = false,
  danger = false,
  variant = 'menu',
  title,
  badge,
  onClick,
  className,
  role,
  'aria-current': ariaCurrent,
  'aria-checked': ariaChecked,
}: NavMenuItemProps) {
  const resolvedTitle = title ?? (badge ? `${label} (${badge})` : label);
  const classes = cx(
    variant === 'sidebar' ? styles.sidebarItem : styles.menuItem,
    active && (variant === 'sidebar' ? styles.sidebarActive : styles.menuActive),
    danger && styles.danger,
    className,
  );

  const content = (
    <>
      {icon && (
        <span className={variant === 'sidebar' ? styles.sidebarIcon : styles.menuIcon}>{icon}</span>
      )}
      <span className={variant === 'sidebar' ? styles.sidebarLabel : styles.menuLabel}>
        {label}
      </span>
      {badge ? <span className={styles.badge}>{badge}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={classes}
        title={resolvedTitle}
        aria-current={ariaCurrent}
        onClick={onClick}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      title={resolvedTitle}
      role={role}
      aria-current={ariaCurrent}
      aria-checked={ariaChecked}
      onClick={onClick}
    >
      {content}
    </button>
  );
}
