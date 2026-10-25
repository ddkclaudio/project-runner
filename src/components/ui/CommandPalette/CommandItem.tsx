import React from 'react';
import { cx } from '@/utils';
import { displayShortcutKeys } from '@/lib/hotkeys';
import styles from './CommandItem.module.css';

/* ── Kbd badge ──────────────────────────────────────────────────────────────── */
function KbdBadge({ keys }: { keys: string[] }) {
  const display = displayShortcutKeys(keys);
  return (
    <span className={styles.kbdGroup} aria-label={`Atalho: ${display.join('+')}`}>
      {display.map((k) => (
        <kbd key={k} className={styles.kbd}>
          {k}
        </kbd>
      ))}
    </span>
  );
}

/* ── CommandItem ────────────────────────────────────────────────────────────── */
export interface CommandItemProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string[];
  isActive: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

export function CommandItem({
  id,
  label,
  icon,
  shortcut,
  isActive,
  onClick,
  onMouseEnter,
}: CommandItemProps) {
  return (
    <button
      className={cx(styles.item, isActive && styles.itemActive)}
      role="option"
      id={`cmd-item-${id}`}
      aria-selected={isActive}
      data-active={isActive}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.label}>{label}</span>
      {shortcut && <KbdBadge keys={shortcut} />}
    </button>
  );
}
