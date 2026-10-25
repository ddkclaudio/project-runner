import { cx } from '@/utils';
import styles from './Topbar.module.css';

interface TopbarSeparatorProps {
  className?: string;
}

/** Separador visual `/` do breadcrumb do topbar. */
export function TopbarSeparator({ className }: TopbarSeparatorProps) {
  return (
    <span className={cx(styles.sep, className)} aria-hidden="true">
      /
    </span>
  );
}
