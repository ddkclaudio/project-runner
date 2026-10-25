import { IconSparkles } from '@tabler/icons-react';
import { appBadge, appName } from '@/lib/brand';
import { cx } from '@/utils';
import styles from './BrandMark.module.css';

export type BrandMarkSize = 'sm' | 'md';

interface BrandMarkProps {
  /** Texto principal. Default: NEXT_PUBLIC_APP_NAME. */
  name?: string;
  /** Badge à direita. Default: NEXT_PUBLIC_APP_BADGE (vazio esconde). */
  badge?: string | null;
  size?: BrandMarkSize;
  className?: string;
  iconSize?: number;
}

/** Pill de marca (ex.: login / register). */
export function BrandMark({ name, badge, size = 'sm', className, iconSize }: BrandMarkProps) {
  const resolvedName = name ?? appName();
  const resolvedBadge = badge === undefined ? appBadge() : badge;
  const resolvedIcon = iconSize ?? (size === 'md' ? 20 : 14);
  return (
    <div className={cx(styles.mark, styles[size], className)}>
      <IconSparkles size={resolvedIcon} className={styles.icon} aria-hidden />
      <span className={styles.name}>{resolvedName}</span>
      {resolvedBadge ? <span className={styles.badge}>{resolvedBadge}</span> : null}
    </div>
  );
}
