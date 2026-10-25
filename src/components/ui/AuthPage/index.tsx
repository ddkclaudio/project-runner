import { cx } from '@/utils';
import { useWindowDragHandlers, WindowControls } from '@/components/ui/WindowControls';
import styles from './AuthPage.module.css';

interface AuthPageProps {
  children: React.ReactNode;
  className?: string;
}

/** Shell full-viewport centralizado (login, register, etc.). */
export function AuthPage({ children, className }: AuthPageProps) {
  const drag = useWindowDragHandlers();
  return (
    <div className={cx(styles.page, className)}>
      <div
        className={styles.titlebar}
        data-tauri-drag-region
        onMouseDown={drag.onMouseDown}
        onDoubleClick={drag.onDoubleClick}
      >
        <span className={styles.titlebarSpacer} data-tauri-drag-region />
        <WindowControls />
      </div>
      {children}
    </div>
  );
}
