import { cx } from '@/utils';
import styles from './StatusBadge.module.css';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'muted';

interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

export function StatusBadge({ label, tone = 'neutral', className }: StatusBadgeProps) {
  return <span className={cx(styles.badge, styles[tone], className)}>{label}</span>;
}
