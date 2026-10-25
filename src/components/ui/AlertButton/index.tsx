'use client';

import { IconBell } from '@tabler/icons-react';
import { cx } from '@/utils';
import styles from './AlertButton.module.css';

interface AlertButtonProps {
  /** Quantidade de alertas. `0` ou omitido esconde o badge. */
  count?: number;
  /** Máximo exibido antes de virar `99+`. Default: `99`. */
  max?: number;
  label?: string;
  onClick?: () => void;
  className?: string;
  icon?: React.ReactNode;
}

function formatCount(count: number, max: number): string {
  if (count > max) return `${max}+`;
  return String(count);
}

export function AlertButton({
  count = 0,
  max = 99,
  label = 'Alertas',
  onClick,
  className,
  icon,
}: AlertButtonProps) {
  const showBadge = count > 0;
  const ariaLabel = showBadge ? `${label}: ${count}` : label;

  return (
    <button
      type="button"
      className={cx(styles.root, className)}
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
    >
      {icon ?? <IconBell size={20} stroke={1.75} aria-hidden="true" />}
      {showBadge && <span className={styles.badge}>{formatCount(count, max)}</span>}
    </button>
  );
}
