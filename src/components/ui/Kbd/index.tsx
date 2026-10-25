import React from 'react';
import { cx } from '@/utils';
import styles from './Kbd.module.css';

export type KbdProps = {
  children: React.ReactNode;
  className?: string;
};

/** Visual badge for keyboard shortcuts (e.g. Ctrl K). */
export function Kbd({ children, className }: KbdProps) {
  return <kbd className={cx(styles.kbd, className)}>{children}</kbd>;
}
