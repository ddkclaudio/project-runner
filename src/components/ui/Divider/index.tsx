import { cx } from '@/utils';
import styles from './Divider.module.css';

interface DividerProps {
  children?: React.ReactNode;
  className?: string;
}

/** Divisor horizontal com label opcional (ex.: “ou”). */
export function Divider({ children, className }: DividerProps) {
  return (
    <div className={cx(styles.divider, className)} role="separator">
      {children != null ? <span className={styles.label}>{children}</span> : null}
    </div>
  );
}
