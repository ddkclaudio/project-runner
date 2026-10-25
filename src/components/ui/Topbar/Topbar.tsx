import { cx } from '@/utils';
import { useWindowDragHandlers, WindowControls } from '@/components/ui/WindowControls';
import styles from './Topbar.module.css';

interface TopbarProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  /** Mostra min/max/close (default true). */
  windowControls?: boolean;
}

/** Shell sticky do header da aplicação (esquerda / centro / direita). */
export function Topbar({ left, center, right, className, windowControls = true }: TopbarProps) {
  const drag = useWindowDragHandlers();
  return (
    <header
      className={cx(styles.topbar, className)}
      role="banner"
      data-tauri-drag-region
      onMouseDown={drag.onMouseDown}
      onDoubleClick={drag.onDoubleClick}
    >
      {left != null && <div className={styles.left}>{left}</div>}
      {center != null && <div className={styles.center}>{center}</div>}
      <div className={styles.right}>
        {right}
        {windowControls ? <WindowControls /> : null}
      </div>
    </header>
  );
}
