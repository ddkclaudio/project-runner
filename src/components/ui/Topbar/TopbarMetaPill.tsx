import { cx } from '@/utils';
import styles from './Topbar.module.css';

export type TopbarMetaPillTone = 'muted' | 'amber';

interface TopbarMetaPillProps {
  children: React.ReactNode;
  tone?: TopbarMetaPillTone;
  className?: string;
}

/** Pill compacto para plano, status ou badge no trigger do switcher. */
export function TopbarMetaPill({ children, tone = 'muted', className }: TopbarMetaPillProps) {
  return (
    <span
      className={cx(
        styles.metaPill,
        tone === 'amber' ? styles.metaPillAmber : styles.metaPillMuted,
        className,
      )}
    >
      {children}
    </span>
  );
}

interface TopbarBranchLabelProps {
  children: React.ReactNode;
  className?: string;
}

export function TopbarBranchLabel({ children, className }: TopbarBranchLabelProps) {
  return <span className={cx(styles.branchName, className)}>{children}</span>;
}
