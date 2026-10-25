import { cx } from '@/utils';
import styles from './Topbar.module.css';

interface TopbarProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

/** Shell sticky do header da aplicação (esquerda / centro / direita). */
export function Topbar({ left, center, right, className }: TopbarProps) {
  return (
    <header className={cx(styles.topbar, className)} role="banner">
      {left != null && <div className={styles.left}>{left}</div>}
      {center != null && <div className={styles.center}>{center}</div>}
      {right != null && <div className={styles.right}>{right}</div>}
    </header>
  );
}
