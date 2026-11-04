import styles from '@/pages/library.module.css';
import type { AppProgress } from '@/stores/app-progress';

export function AppProgressBar({ progress }: { progress: AppProgress }) {
  return (
    <div className={styles.appProgressHost} role="status" aria-live="polite">
      <div className={styles.appProgressPhase}>
        {progress.phase} · {progress.percent}%
      </div>
      <div className={styles.progress} aria-valuenow={progress.percent} role="progressbar">
        <span style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }} />
      </div>
    </div>
  );
}
