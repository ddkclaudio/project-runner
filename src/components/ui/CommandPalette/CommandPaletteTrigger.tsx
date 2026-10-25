'use client';

import { IconSearch } from '@tabler/icons-react';
import { cx } from '@/utils';
import styles from './CommandPaletteTrigger.module.css';

interface CommandPaletteTriggerProps {
  onClick: () => void;
  className?: string;
  hideOnMobile?: boolean;
}

export function CommandPaletteTrigger({
  onClick,
  className,
  hideOnMobile = false,
}: CommandPaletteTriggerProps) {
  return (
    <button
      type="button"
      className={cx(styles.trigger, hideOnMobile && styles.hideOnMobile, className)}
      onClick={onClick}
      aria-label="Abrir paleta de comandos"
      aria-keyshortcuts="Control+K"
    >
      <IconSearch size={13} className={styles.icon} aria-hidden="true" />
      <span className={styles.text}>Buscar…</span>
      <kbd className={styles.kbd}>Ctrl K</kbd>
    </button>
  );
}
